// ════════════════════════════════════════════════════════════════════
// Binance WebSocket.
// Спот: !miniTicker@arr (все тикеры: цена/объём/открытие) + depth-диффы.
// Фьючерсы: bookTicker (цены реального времени) + depth-диффы; объёмы 24ч —
// прокси с других бирж (fapi REST недоступен с этого IP, тикер-стримы закрыты).
// ════════════════════════════════════════════════════════════════════

import type { BookEngine } from './books'
import type { TickerHub } from './exchanges'
import type { RawTicker } from './types'

const WS_URL_FUT = 'wss://fstream.binance.com/ws'
const WS_URL_SPOT = 'wss://stream.binance.com:9443/ws'

/** сколько символов фьючерсов слушать по bookTicker */
const FUT_TICKER_LIMIT = 160
/** сколько стаканов слушать depth-диффами */
const DEPTH_LIMIT = 45

interface BookState {
  bids: Map<number, number>
  asks: Map<number, number>
  updatedAt: number
  lastScan: number
}

export class BinanceWs {
  // спот
  private spotBooks = new Map<string, BookState>()
  private spotBatch: RawTicker[] = []
  private wsS: WebSocket | null = null
  private lastMsgS = 0
  private spotSubs = new Set<string>()

  // фьючерсы
  private futBooks = new Map<string, BookState>()
  private futPrices = new Map<string, { bid: number; ask: number; updatedAt: number }>()
  private futTickerSubs = new Set<string>()
  private wsF: WebSocket | null = null
  private lastMsgF = 0
  private futDepthSubs = new Set<string>()

  private msgCount = 0
  private startedAt = Date.now()

  constructor(private hub: TickerHub, private booksEngine: BookEngine) {}

  start() {
    this.connect('F')
    this.connect('S')

    // батчи тикеров каждые 1.5с
    setInterval(() => {
      if (this.spotBatch.length > 0) {
        this.hub.feedExternal('BINANCE', 'S', this.spotBatch)
        this.spotBatch = []
      }
      if (this.futPrices.size > 0) {
        const rows: RawTicker[] = []
        const now = Date.now()
        for (const [s, p] of this.futPrices) {
          if (now - p.updatedAt > 120_000) { this.futPrices.delete(s); continue }
          rows.push({ symbol: s, price: (p.bid + p.ask) / 2, open24h: 0, vol24h: 0, change24hPct: NaN, partial: true })
        }
        if (rows.length > 0) this.hub.feedExternal('BINANCE', 'F', rows)
      }
    }, 1500)

    // подписки
    setInterval(() => this.syncDepthSubscriptions('F'), 30_000)
    setInterval(() => this.syncDepthSubscriptions('S'), 30_000)
    setInterval(() => this.syncFutTickerSet(), 60_000)
    // объёмы фьючерсов — прокси с соседних бирж
    setInterval(() => this.refreshFutMeta(), 30_000)
    setTimeout(() => this.refreshFutMeta(), 12_000)
    // скан стен
    setInterval(() => this.scanWalls('F'), 5000)
    setInterval(() => this.scanWalls('S'), 5000)
    // первичные подписки
    setTimeout(() => { this.syncFutTickerSet(); this.syncDepthSubscriptions('F'); this.syncDepthSubscriptions('S') }, 3000)
    setTimeout(() => { this.syncFutTickerSet(); this.syncDepthSubscriptions('F'); this.syncDepthSubscriptions('S') }, 10000)
  }

  private connect(m: 'F' | 'S') {
    const url = m === 'F' ? WS_URL_FUT : WS_URL_SPOT
    console.log(`[BINANCE_${m} ws] connecting…`)
    const ws = new WebSocket(url)
    if (m === 'F') this.wsF = ws
    else this.wsS = ws

    ws.onopen = () => {
      console.log(`[BINANCE_${m} ws] connected`)
      if (m === 'S') {
        ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: ['!miniTicker@arr'], id: 1 }))
      }
    }

    ws.onmessage = (ev) => {
      if (m === 'F') this.lastMsgF = Date.now()
      else this.lastMsgS = Date.now()
      this.msgCount += 1
      let d: any
      try { d = JSON.parse(String(ev.data)) } catch { return }

      // массив мини-тикеров (спот, весь рынок)
      if (Array.isArray(d)) {
        for (const t of d) {
          if (typeof t?.s !== 'string' || !t.s.endsWith('USDT')) continue
          const price = Number(t.c)
          const open = Number(t.o)
          const vol = Number(t.q)
          if (!(price > 0) || !(vol >= 0)) continue
          this.spotBatch.push({
            symbol: t.s, price, open24h: open, vol24h: vol,
            change24hPct: open > 0 ? ((price - open) / open) * 100 : 0,
          })
        }
        return
      }

      // фьючерсный bookTicker: лучшие bid/ask в реальном времени
      if (d?.e === 'bookTicker' && typeof d?.s === 'string') {
        const bid = Number(d.b); const ask = Number(d.a)
        if (bid > 0 && ask > 0) {
          this.futPrices.set(d.s, { bid, ask, updatedAt: Date.now() })
        }
        return
      }

      // дифф стакана (fut и spot)
      if (d?.e === 'depthUpdate' && typeof d?.s === 'string') {
        this.applyDiff(m, d.s, d.b ?? [], d.a ?? [])
      }
    }

    ws.onerror = () => console.error(`[BINANCE_${m} ws] error`)
    ws.onclose = () => {
      console.log(`[BINANCE_${m} ws] closed, reconnect in 4s`)
      if (m === 'F') this.wsF = null
      else this.wsS = null
      setTimeout(() => this.connect(m), 4000)
    }
  }

  // ─── Стаканы из диффов ─────────────────────────────────────────────

  private bookMap(m: 'F' | 'S'): Map<string, BookState> {
    return m === 'F' ? this.futBooks : this.spotBooks
  }

  private applyDiff(m: 'F' | 'S', symbol: string, bids: [string, string][], asks: [string, string][]) {
    if (!symbol.endsWith('USDT')) return
    const map = this.bookMap(m)
    let b = map.get(symbol)
    if (!b) { b = { bids: new Map(), asks: new Map(), updatedAt: 0, lastScan: 0 }; map.set(symbol, b) }
    const apply = (arr: [string, string][], side: Map<number, number>) => {
      for (const l of arr) {
        const price = Number(l[0]); const size = Number(l[1])
        if (!Number.isFinite(price) || !Number.isFinite(size)) continue
        if (size <= 0) side.delete(price)
        else side.set(price, size)
      }
    }
    apply(bids, b.bids)
    apply(asks, b.asks)
    b.updatedAt = Date.now()
  }

  /** Подписки depth-диффов по watch-сету движка */
  private syncDepthSubscriptions(m: 'F' | 'S') {
    const ws = m === 'F' ? this.wsF : this.wsS
    if (!ws || ws.readyState !== 1) return
    const want = this.booksEngine.getWatch('BINANCE', m).slice(0, DEPTH_LIMIT)
    const cur = m === 'F' ? this.futDepthSubs : this.spotSubs
    const wantSet = new Set(want)
    const add: string[] = []
    const remove: string[] = []
    for (const s of wantSet) if (!cur.has(s)) add.push(`${s.toLowerCase()}@depth@100ms`)
    for (const s of cur) if (!wantSet.has(s)) remove.push(`${s.toLowerCase()}@depth@100ms`)
    if (add.length > 0) ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: add, id: Date.now() % 100000 }))
    if (remove.length > 0) ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: remove, id: (Date.now() + 1) % 100000 }))
    if (m === 'F') this.futDepthSubs = wantSet
    else this.spotSubs = wantSet
    if (add.length > 0 || remove.length > 0) {
      console.log(`[BINANCE_${m} ws] depth subs: +${add.length} -${remove.length}, total ${wantSet.size}`)
    }
  }

  /** Набор фьючерсных символов для bookTicker: собственные + соседи */
  private syncFutTickerSet() {
    const ws = this.wsF
    if (!ws || ws.readyState !== 1) return
    // кандидаты из соседних фьючерсных рынков (реальные объёмы)
    const byVol = new Map<string, number>()
    for (const id of ['BYBIT_F', 'OKX_F', 'GATE_F', 'BITGET_F', 'KUKOIN_F', 'HL_F', 'ASTER_F']) {
      const p = this.hub.pollers.find((x) => x.id === id)
      if (!p) continue
      for (const t of p.rows.values()) {
        if (t.vol24h < 2e6) continue
        byVol.set(t.symbol, Math.max(byVol.get(t.symbol) ?? 0, t.vol24h))
      }
    }
    // собственные строки (объёмы уже проксированы) — приоритет
    const own = this.hub.pollers.find((x) => x.id === 'BINANCE_F')
    if (own) {
      for (const t of own.rows.values()) {
        byVol.set(t.symbol, Math.max(byVol.get(t.symbol) ?? 0, t.vol24h))
      }
    }
    const want = [...byVol.entries()].sort((a, b) => b[1] - a[1]).slice(0, FUT_TICKER_LIMIT).map(([s]) => s)
    const wantSet = new Set(want)
    const add: string[] = []
    const remove: string[] = []
    for (const s of wantSet) if (!this.futTickerSubs.has(s)) add.push(`${s.toLowerCase()}@bookTicker`)
    for (const s of this.futTickerSubs) if (!wantSet.has(s)) remove.push(`${s.toLowerCase()}@bookTicker`)
    if (add.length > 0) ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: add, id: Date.now() % 100000 }))
    if (remove.length > 0) ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: remove, id: (Date.now() + 1) % 100000 }))
    this.futTickerSubs = wantSet
    if (add.length > 0 || remove.length > 0) {
      console.log(`[BINANCE_F ws] bookTicker subs: +${add.length} -${remove.length}, total ${wantSet.size}`)
    }
  }

  /** Объёмы/открытия фьючерсов: прокси с самой ликвидной соседней биржи */
  private refreshFutMeta() {
    const own = this.hub.pollers.find((x) => x.id === 'BINANCE_F')
    if (!own) return
    const byVol = new Map<string, { vol: number; pct: number }>()
    for (const id of ['BYBIT_F', 'OKX_F', 'GATE_F', 'BITGET_F', 'KUKOIN_F', 'HL_F', 'ASTER_F']) {
      const p = this.hub.pollers.find((x) => x.id === id)
      if (!p) continue
      for (const t of p.rows.values()) {
        const prev = byVol.get(t.symbol)
        if (!prev || t.vol24h > prev.vol) byVol.set(t.symbol, { vol: t.vol24h, pct: t.change24hPct })
      }
    }
    const rows: RawTicker[] = []
    for (const [symbol, meta] of byVol) {
      if (meta.vol < 1e6) continue
      const t = own.rows.get(`BINANCE:F:${symbol}`)
      const price = t?.price ?? 0
      rows.push({
        symbol, price, // price=0 → не перезаписывает существующую
        open24h: price > 0 ? price / (1 + meta.pct / 100) : 0,
        vol24h: meta.vol,
        change24hPct: meta.pct,
        metaOnly: true,
      })
    }
    if (rows.length > 0) this.hub.feedExternal('BINANCE', 'F', rows)
  }

  /** Скан стен по собранным стаканам */
  private scanWalls(m: 'F' | 'S') {
    const now = Date.now()
    const map = this.bookMap(m)
    const baseline = now - this.startedAt < 60_000
    for (const [symbol, b] of map) {
      if (now - b.updatedAt > 60_000 || now - b.lastScan < 5000) continue
      b.lastScan = now
      const bids = [...b.bids.entries()].filter(([, s]) => s > 0).sort((x, y) => y[0] - x[0]).slice(0, 500)
      const asks = [...b.asks.entries()].filter(([, s]) => s > 0).sort((x, y) => x[0] - y[0]).slice(0, 500)
      if (bids.length === 0 || asks.length === 0) continue
      this.booksEngine.feedBook('BINANCE', m, symbol, {
        bids: bids.map(([price, size]) => ({ price, size })),
        asks: asks.map(([price, size]) => ({ price, size })),
      }, baseline)
    }
  }

  /** Здоровье для монитора */
  health(m: 'F' | 'S'): { status: 'online' | 'degraded' | 'offline'; booksLive: number; msgs: number; lastMsg: number } {
    const since = Date.now() - (m === 'F' ? this.lastMsgF : this.lastMsgS)
    const status = since < 15_000 ? 'online' : since < 60_000 ? 'degraded' : 'offline'
    return {
      status,
      booksLive: status === 'online' ? this.bookMap(m).size : 0,
      msgs: this.msgCount,
      lastMsg: m === 'F' ? this.lastMsgF : this.lastMsgS,
    }
  }
}

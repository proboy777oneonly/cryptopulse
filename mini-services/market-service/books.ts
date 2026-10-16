// ════════════════════════════════════════════════════════════════════
// Стаканы: REST-поллинг (кроме Binance) + внешние WS-источники
// (Binance — binance-ws.ts, KuCoin spot — инкрементный WS здесь).
// Детектор крупных лимитных заявок (стен).
// ════════════════════════════════════════════════════════════════════

import { kucoinFutMultiplier, type TickerHub } from './exchanges'
import { jget, type ConnectRow, type Ex, type Mkt, type WallRow } from './types'

export interface Level { price: number; size: number } // size в базовой монете

const WALL_FLOOR_USD = 250_000
const WALL_DEPTH_PCT = 8
const WATCH_LIMIT = 40
const WATCH_LIMIT_HL = 28
const BOOK_CYCLE_MS = 8000
const BOOK_CYCLE_BYBIT_MS = 12000
const BOOK_CYCLE_KUKOIN_F_MS = 10000
const BOOK_CYCLE_HL_MS = 12000
const GROW_REEMIT_RATIO = 1.6
const GROW_REEMIT_COOLDOWN = 60_000
const WALL_REAPPEAR_MS = 20_000

interface BookCombo {
  ex: Ex
  m: Mkt
  id: string
  fetchBook: (symbol: string) => Promise<{ bids: Level[]; asks: Level[] }>
  cycleMs: number
}

// ─── Нормализация символов для конкретной биржи ──────────────────────

function toExchangeSymbol(symbol: string, ex: Ex, m: Mkt): string {
  const base = symbol.replace(/USDT$/, '')
  switch (ex) {
    case 'BINANCE': case 'BYBIT': case 'BITGET': case 'ASTER':
      return symbol
    case 'OKX':
      return m === 'F' ? `${base}-USDT-SWAP` : `${base}-USDT`
    case 'GATE':
      return `${base}_USDT`
    case 'KUKOIN':
      return m === 'F' ? `${base === 'BTC' ? 'XBT' : base}USDTM` : `${base}-USDT`
    case 'HL':
      return base
    default:
      return symbol
  }
}

// ─── Множители контрактов Gate (quanto) ──────────────────────────────

let gateMult = new Map<string, number>()

async function refreshGateContracts() {
  try {
    const d = await jget('https://api.gateio.ws/api/v4/futures/usdt/contracts', 15_000)
    const map = new Map<string, number>()
    for (const c of d as any[]) {
      if (typeof c?.name === 'string') map.set(c.name, Number(c.quanto_multiplier) || 1)
    }
    gateMult = map
    console.log(`[GATE] contracts: ${map.size} multipliers loaded`)
  } catch (e) {
    console.error('[GATE] contracts fetch failed:', (e as Error).message)
  }
}

// ─── REST-адаптеры стаканов (Binance — через WS) ─────────────────────

const BOOK_COMBOS: BookCombo[] = [
  {
    ex: 'BYBIT', m: 'F', id: 'BYBIT_F', cycleMs: BOOK_CYCLE_BYBIT_MS,
    fetchBook: async (sym) => {
      const d = await jget(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${sym}&limit=50`)
      const r = d?.result ?? {}
      return { bids: (r.b ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.a ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'BYBIT', m: 'S', id: 'BYBIT_S', cycleMs: BOOK_CYCLE_BYBIT_MS,
    fetchBook: async (sym) => {
      const d = await jget(`https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${sym}&limit=50`)
      const r = d?.result ?? {}
      return { bids: (r.b ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.a ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'OKX', m: 'F', id: 'OKX_F', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const s = toExchangeSymbol(sym, 'OKX', 'F')
      const d = await jget(`https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(s)}&sz=100`)
      const r = d?.data?.[0] ?? {}
      return { bids: (r.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'OKX', m: 'S', id: 'OKX_S', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const s = toExchangeSymbol(sym, 'OKX', 'S')
      const d = await jget(`https://www.okx.com/api/v5/market/books?instId=${encodeURIComponent(s)}&sz=100`)
      const r = d?.data?.[0] ?? {}
      return { bids: (r.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'GATE', m: 'F', id: 'GATE_F', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const s = toExchangeSymbol(sym, 'GATE', 'F')
      const mult = gateMult.get(s) ?? 1
      const d = await jget(`https://api.gateio.ws/api/v4/futures/usdt/order_book?contract=${s}&limit=50`)
      return {
        bids: (d.bids ?? []).map((l: any) => ({ price: +l.p, size: +l.s * mult })),
        asks: (d.asks ?? []).map((l: any) => ({ price: +l.p, size: +l.s * mult })),
      }
    },
  },
  {
    ex: 'GATE', m: 'S', id: 'GATE_S', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const s = toExchangeSymbol(sym, 'GATE', 'S')
      const d = await jget(`https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${s}&limit=50`)
      return {
        bids: (d.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })),
        asks: (d.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })),
      }
    },
  },
  {
    ex: 'BITGET', m: 'F', id: 'BITGET_F', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const d = await jget(`https://api.bitget.com/api/v2/mix/market/orderbook?symbol=${sym}&productType=USDT-FUTURES&limit=50`)
      const r = d?.data ?? {}
      return { bids: (r.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'BITGET', m: 'S', id: 'BITGET_S', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const d = await jget(`https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${sym}&type=step0&limit=50`)
      const r = d?.data ?? {}
      return { bids: (r.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (r.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
  {
    ex: 'KUKOIN', m: 'F', id: 'KUKOIN_F', cycleMs: BOOK_CYCLE_KUKOIN_F_MS,
    fetchBook: async (sym) => {
      const s = toExchangeSymbol(sym, 'KUKOIN', 'F')
      const mult = kucoinFutMultiplier(s)
      const d = await jget(`https://api-futures.kucoin.com/api/v1/level2/depth100?symbol=${s}`)
      const r = d?.data ?? {}
      return {
        bids: (r.bids ?? []).map((l: any[]) => ({ price: +l[0], size: +l[1] * mult })),
        asks: (r.asks ?? []).map((l: any[]) => ({ price: +l[0], size: +l[1] * mult })),
      }
    },
  },
  {
    ex: 'ASTER', m: 'F', id: 'ASTER_F', cycleMs: BOOK_CYCLE_MS,
    fetchBook: async (sym) => {
      const d = await jget(`https://fapi.asterdex.com/fapi/v1/depth?symbol=${sym}&limit=50`)
      return { bids: (d.bids ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })), asks: (d.asks ?? []).map((l: any) => ({ price: +l[0], size: +l[1] })) }
    },
  },
]

// ─── Состояние стен ──────────────────────────────────────────────────

interface WallState {
  firstSeen: number
  lastSeen: number
  lastEmit: number
  notional: number
  distPct: number
  vol24h: number
  comboId: string
}

export interface WsHealth {
  status: 'online' | 'degraded' | 'offline'
  booksLive: number
  booksTotal: number
  msgsPerSec: number
  lastMsg: number
}

export class BookEngine {
  private walls = new Map<string, WallState>()
  private watch = new Map<string, string[]>() // comboId → symbols
  private comboHealth = new Map<string, { lastOk: number; startedAt: number; booksOk: number }>()
  /** здоровье WS-источников (BINANCE_F/S) обновляется binance-ws.ts */
  wsHealth = new Map<string, WsHealth>()
  onWalls: ((rows: WallRow[]) => void) | null = null
  wallCount = 0
  errors = 0

  constructor(private hub: TickerHub) {
    for (const c of BOOK_COMBOS) {
      this.comboHealth.set(c.id, { lastOk: 0, startedAt: Date.now(), booksOk: 0 })
    }
    this.comboHealth.set('KUKOIN_S', { lastOk: 0, startedAt: Date.now(), booksOk: 0 })
    for (const id of ['BINANCE_F', 'BINANCE_S', 'HL_F']) {
      this.comboHealth.set(id, { lastOk: 0, startedAt: Date.now(), booksOk: 0 })
    }
  }

  start() {
    void refreshGateContracts()
    setInterval(() => void refreshGateContracts(), 60 * 60 * 1000)
    BOOK_COMBOS.forEach((c, i) => setTimeout(() => this.runComboLoop(c), 1500 + i * 700))
    setTimeout(() => this.runKucoinSpotWs(), 4000)
    setInterval(() => this.refreshWatchSets(), 60_000)
    this.refreshWatchSets()
    // ускоренное обновление watch-сетов после старта (пока наполняются тикеры)
    setTimeout(() => this.refreshWatchSets(), 12_000)
    setTimeout(() => this.refreshWatchSets(), 40_000)
    // пульс живых стен: клиент видит возраст и «простоёт» стены в стакане
    setInterval(() => this.heartbeatWalls(), 10_000)
  }

  /** Пере-отправка живых стен: молодые — каждые ~10с, старые — каждые ~30с */
  private heartbeatWalls() {
    const now = Date.now()
    const emits: WallRow[] = []
    for (const [key, st] of this.walls.entries()) {
      const age = now - st.firstSeen
      const alive = now - st.lastSeen < 45_000
      if (!alive) continue
      const interval = age < 90_000 ? 11_000 : 31_000
      if (now - st.lastEmit < interval) continue
      const [ex, m, symbol, side, priceStr] = key.split('|')
      emits.push({
        id: this.wallId(ex as Ex, m as Mkt, symbol, side as 'BID' | 'ASK', Number(priceStr)),
        ex: ex as Ex, m: m as Mkt, symbol, side: side as 'BID' | 'ASK',
        price: Number(priceStr),
        notionalUsd: st.notional,
        distPct: st.distPct,
        vol24h: st.vol24h,
        ts: now,
        firstSeen: st.firstSeen,
      })
      st.lastEmit = now
    }
    if (emits.length > 0) {
      this.wallCount += emits.length
      this.onWalls?.(emits)
    }
  }

  /** Watch-сет для внешних WS-модулей (Binance) */
  getWatch(ex: Ex, m: Mkt): string[] {
    return this.watch.get(`${ex}_${m}`) ?? []
  }

  /** Публичная точка входа для внешних WS-источников */
  feedBook(ex: Ex, m: Mkt, symbol: string, book: { bids: Level[]; asks: Level[] }, baseline = false) {
    this.detectWalls(ex, m, symbol, book, baseline)
  }

  refreshWatchSets() {
    for (const c of BOOK_COMBOS) {
      const limit = c.ex === 'HL' ? WATCH_LIMIT_HL : WATCH_LIMIT
      const p = this.hub.pollers.find((x) => x.id === c.id)
      if (!p) continue
      const syms = [...p.rows.values()]
        .filter((t) => t.vol24h >= 500_000)
        .sort((a, b) => b.vol24h - a.vol24h)
        .slice(0, limit)
        .map((t) => t.symbol)
      this.watch.set(c.id, syms)
    }
    // Binance F/S и HL F — watch-сеты из WS-тикеров
    for (const id of ['BINANCE_F', 'BINANCE_S', 'HL_F']) {
      const p = this.hub.pollers.find((x) => x.id === id)
      if (!p) continue
      const limit = id === 'HL_F' ? 28 : 45
      const syms = [...p.rows.values()]
        .filter((t) => t.vol24h >= 500_000)
        .sort((a, b) => b.vol24h - a.vol24h)
        .slice(0, limit)
        .map((t) => t.symbol)
      this.watch.set(id, syms)
      const h = this.wsHealth.get(id)
      if (h) h.booksTotal = syms.length
    }
    // KuCoin spot WS отдельно (100 символов)
    const ks = this.hub.pollers.find((x) => x.id === 'KUKOIN_S')
    if (ks) {
      this.watch.set('KUKOIN_S', [...ks.rows.values()]
        .filter((t) => t.vol24h >= 3e6)
        .sort((a, b) => b.vol24h - a.vol24h)
        .slice(0, 100)
        .map((t) => t.symbol))
    }
  }

  private async runComboLoop(c: BookCombo) {
    while (true) {
      const symbols = this.watch.get(c.id) ?? []
      const h = this.comboHealth.get(c.id)!
      let ok = 0
      for (let i = 0; i < symbols.length; i += 6) {
        const batch = symbols.slice(i, i + 6)
        const results = await Promise.allSettled(batch.map((s) => c.fetchBook(s)))
        results.forEach((r, j) => {
          if (r.status === 'fulfilled' && r.value.bids.length > 0 && r.value.asks.length > 0) {
            ok += 1
            this.detectWalls(c.ex, c.m, batch[j], r.value, false)
          } else if (r.status === 'rejected') {
            this.errors += 1
          }
        })
        await sleep(350)
      }
      h.booksOk = ok
      if (ok > 0) h.lastOk = Date.now()
      await sleep(c.cycleMs)
    }
  }

  /** Поиск стен в стакане */
  private detectWalls(ex: Ex, m: Mkt, symbol: string, book: { bids: Level[]; asks: Level[] }, baseline: boolean) {
    const bestBid = book.bids[0]?.price ?? 0
    const bestAsk = book.asks[0]?.price ?? 0
    if (bestBid <= 0 || bestAsk <= 0) return
    const mid = (bestBid + bestAsk) / 2
    if (!Number.isFinite(mid) || mid <= 0) return

    const vol = this.hub.pollers.find((p) => p.combo.ex === ex && p.combo.m === m)?.rows.get(`${ex}:${m}:${symbol}`)?.vol24h ?? 0
    const now = Date.now()
    const found: { side: 'BID' | 'ASK'; price: number; notional: number; distPct: number }[] = []

    for (const side of ['BID', 'ASK'] as const) {
      const levels = side === 'BID' ? book.bids : book.asks
      for (const l of levels) {
        if (!Number.isFinite(l.price) || !Number.isFinite(l.size) || l.size <= 0) continue
        const dist = side === 'BID' ? ((mid - l.price) / mid) * 100 : ((l.price - mid) / mid) * 100
        if (dist < -0.01 || dist > WALL_DEPTH_PCT) continue
        const notional = l.price * l.size
        if (notional < WALL_FLOOR_USD) continue
        found.push({ side, price: l.price, notional, distPct: Math.max(0, dist) })
      }
    }
    if (found.length === 0) return

    const emits: WallRow[] = []
    for (const w of found) {
      const priceStr = w.price.toPrecision(10)
      const key = `${ex}|${m}|${symbol}|${w.side}|${priceStr}`
      const st = this.walls.get(key)
      if (!st) {
        this.walls.set(key, { firstSeen: now, lastSeen: now, lastEmit: 0, notional: w.notional, distPct: w.distPct, vol24h: vol, comboId: `${ex}_${m}` })
        if (!baseline) {
          emits.push(this.toRow(ex, m, symbol, w, vol, now))
          this.walls.get(key)!.lastEmit = now
        }
      } else {
        st.lastSeen = now
        if (vol > 0) st.vol24h = vol
        st.distPct = w.distPct
        // рост стены — повторный сигнал
        if (w.notional >= st.notional * GROW_REEMIT_RATIO && now - st.lastEmit > GROW_REEMIT_COOLDOWN) {
          emits.push(this.toRow(ex, m, symbol, w, vol, now))
          st.lastEmit = now
        }
        if (w.notional > st.notional) st.notional = w.notional
      }
    }

    // подчистка исчезнувших стен
    if (this.walls.size > 30_000) {
      for (const [k, st] of [...this.walls.entries()]) {
        if (now - st.lastSeen > WALL_REAPPEAR_MS * 3) this.walls.delete(k)
      }
    }

    if (emits.length > 0) {
      this.wallCount += emits.length
      this.onWalls?.(emits)
    }
  }

  /** Стабильный id стены — клиент дедуплицирует события по нему */
  private wallId(ex: Ex, m: Mkt, symbol: string, side: 'BID' | 'ASK', price: number): string {
    return `w_${ex}_${m}_${symbol}_${side}_${price.toPrecision(10)}`
  }

  private toRow(ex: Ex, m: Mkt, symbol: string, w: { side: 'BID' | 'ASK'; price: number; notional: number; distPct: number }, vol: number, now: number): WallRow {
    const st = this.walls.get(`${ex}|${m}|${symbol}|${w.side}|${w.price.toPrecision(10)}`)
    return {
      id: this.wallId(ex, m, symbol, w.side, w.price),
      ex, m, symbol, side: w.side,
      price: w.price,
      notionalUsd: w.notional,
      distPct: Math.round(w.distPct * 100) / 100,
      vol24h: vol,
      ts: now,
      firstSeen: st?.firstSeen ?? now,
    }
  }

  // ─── KuCoin spot: WS с инкрементами стакана ──────────────────────

  private kucoinBooks = new Map<string, { bids: Map<number, number>; asks: Map<number, number>; updatedAt: number }>()
  private kucoinWsLastMsg = 0
  private kucoinSubscribed: string[] = []
  private kucoinScanAt = 0

  private async runKucoinSpotWs() {
    while (true) {
      try {
        await this.kucoinWsSession()
      } catch (e) {
        console.error('[KUKOIN_S ws] session error:', (e as Error).message)
      }
      await sleep(5000)
    }
  }

  private async kucoinWsSession(): Promise<void> {
    const bullet = await jget('https://api.kucoin.com/api/v1/bullet-public', 10_000, { method: 'POST' })
    const token: string = bullet?.data?.token
    const endpoint: string = bullet?.data?.instanceServers?.[0]?.endpoint
    const pingInterval: number = bullet?.data?.instanceServers?.[0]?.pingInterval ?? 18
    if (!token || !endpoint) throw new Error('bad bullet-public response')

    const ws = new WebSocket(`${endpoint}?token=${token}&acceptUserMessage=true&connectId=cp${Date.now()}`)
    const h = this.comboHealth.get('KUKOIN_S')!
    const symToKu = (s: string) => `${s.replace(/USDT$/, '')}-USDT`
    const baselineUntil = Date.now() + 60_000

    return new Promise<void>((resolve, reject) => {
      const pinger = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ id: Date.now(), type: 'ping' }))
      }, Math.max(5, pingInterval - 5) * 1000)

      const scanTimer = setInterval(() => {
        const now = Date.now()
        for (const [symbol, book] of this.kucoinBooks) {
          if (now - book.updatedAt > 30_000) continue
          const bids = [...book.bids.entries()].filter(([, s]) => s > 0).sort((a, b) => b[0] - a[0])
          const asks = [...book.asks.entries()].filter(([, s]) => s > 0).sort((a, b) => a[0] - b[0])
          if (bids.length === 0 || asks.length === 0) continue
          this.detectWalls('KUKOIN', 'S', symbol, {
            bids: bids.slice(0, 400).map(([price, size]) => ({ price, size })),
            asks: asks.slice(0, 400).map(([price, size]) => ({ price, size })),
          }, now < baselineUntil)
          h.lastOk = now
        }
      }, 8000)

      const gc = setInterval(() => {
        const cutoff = Date.now() - 180_000
        for (const book of this.kucoinBooks.values()) {
          if (book.updatedAt < cutoff) { book.bids.clear(); book.asks.clear() }
        }
      }, 60_000)

      const subTimer = setInterval(() => {
        if (ws.readyState !== 1) return
        const want = this.watch.get('KUKOIN_S') ?? []
        const wantSet = new Set(want)
        const curSet = new Set(this.kucoinSubscribed)
        const add = want.filter((s) => !curSet.has(s))
        const remove = curSet.size > 0 && [...curSet].filter((s) => !wantSet.has(s)).length > 20
        if (add.length === 0 && !remove) return
        this.kucoinSubscribed = [...want]
        if (remove) {
          for (let i = 0; i < want.length; i += 50) {
            const chunk = want.slice(i, i + 50).map(symToKu).join(',')
            ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/level2:${chunk}`, response: false }))
          }
        } else {
          for (let i = 0; i < add.length; i += 50) {
            const chunk = add.slice(i, i + 50).map(symToKu).join(',')
            ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/level2:${chunk}`, response: false }))
          }
        }
      }, 15_000)

      const cleanup = () => {
        clearInterval(pinger); clearInterval(scanTimer); clearInterval(gc); clearInterval(subTimer)
      }

      ws.onopen = () => {
        console.log('[KUKOIN_S ws] connected')
        h.lastOk = Date.now()
        const want = this.watch.get('KUKOIN_S') ?? []
        this.kucoinSubscribed = [...want]
        for (let i = 0; i < want.length; i += 50) {
          const chunk = want.slice(i, i + 50).map(symToKu).join(',')
          ws.send(JSON.stringify({ id: Date.now(), type: 'subscribe', topic: `/market/level2:${chunk}`, response: false }))
        }
      }

      ws.onmessage = (ev) => {
        this.kucoinWsLastMsg = Date.now()
        h.lastOk = Date.now()
        try {
          const d = JSON.parse(String(ev.data))
          if (d?.type !== 'message' || !d?.data?.changes) return
          const kuSym: string = d.data.symbol ?? d.subject ?? ''
          if (!kuSym) return
          const symbol = `${kuSym.replace('-USDT', '')}USDT`
          let book = this.kucoinBooks.get(symbol)
          if (!book) { book = { bids: new Map(), asks: new Map(), updatedAt: 0 }; this.kucoinBooks.set(symbol, book) }
          const apply = (arr: unknown, map: Map<number, number>) => {
            for (const l of arr as [string, string][]) {
              const p = Number(l[0]); const s = Number(l[1])
              if (!Number.isFinite(p) || !Number.isFinite(s)) continue
              if (s <= 0) map.delete(p)
              else map.set(p, s)
            }
          }
          apply(d.data.changes.bids ?? [], book.bids)
          apply(d.data.changes.asks ?? [], book.asks)
          book.updatedAt = Date.now()
        } catch { /* ignore */ }
      }

      ws.onerror = () => { cleanup(); reject(new Error('ws error')) }
      ws.onclose = () => { cleanup(); resolve() }
    })
  }

  /** Строки состояния коннектов для монитора */
  connectRows(): ConnectRow[] {
    const now = Date.now()
    const rows: ConnectRow[] = []

    // WS-источники (BINANCE F/S — binance-ws.ts, HL F — hl-ws.ts)
    for (const id of ['BINANCE_F', 'BINANCE_S', 'HL_F']) {
      const wh = this.wsHealth.get(id)
      if (!wh) continue
      const [exStr, mStr] = id.split('_')
      rows.push({
        id, exchange: exStr as ConnectRow['exchange'], market: mStr as ConnectRow['market'],
        status: wh.status,
        latencyMs: 1, // WS — данные приходят сами
        msgsPerSec: wh.msgsPerSec,
        booksLive: wh.booksLive,
        booksTotal: wh.booksTotal,
        uptime: Math.round((now - (this.comboHealth.get(id)?.startedAt ?? now)) / 1000),
        lastMsg: wh.lastMsg,
      })
    }

    for (const c of BOOK_COMBOS) {
      const h = this.comboHealth.get(c.id)!
      const p = this.hub.pollers.find((x) => x.id === c.id)!
      const lastData = Math.max(h.lastOk, p.lastOk)
      const sinceData = now - lastData
      const status: ConnectRow['status'] = sinceData < c.cycleMs * 3 ? 'online' : sinceData < c.cycleMs * 6 ? 'degraded' : 'offline'
      const watchList = this.watch.get(c.id) ?? []
      rows.push({
        id: c.id, exchange: c.ex, market: c.m, status,
        latencyMs: Math.round(p.latencyMs || 0),
        msgsPerSec: p.msgsPerSec,
        booksLive: status === 'online' ? h.booksOk : 0,
        booksTotal: watchList.length,
        uptime: Math.round((now - h.startedAt) / 1000),
        lastMsg: lastData,
      })
    }
    // KuCoin spot — из WS-здоровья
    const ksh = this.comboHealth.get('KUKOIN_S')!
    const ksPoller = this.hub.pollers.find((x) => x.id === 'KUKOIN_S')!
    const sinceWs = now - this.kucoinWsLastMsg
    const ksStatus: ConnectRow['status'] = sinceWs < 30_000 ? 'online' : sinceWs < 120_000 ? 'degraded' : 'offline'
    rows.push({
      id: 'KUKOIN_S', exchange: 'KUKOIN', market: 'S', status: ksStatus,
      latencyMs: Math.round(ksPoller.latencyMs),
      msgsPerSec: ksPoller.msgsPerSec,
      booksLive: ksStatus === 'online' ? this.kucoinBooks.size : 0,
      booksTotal: (this.watch.get('KUKOIN_S') ?? []).length,
      uptime: Math.round((now - ksh.startedAt) / 1000),
      lastMsg: Math.max(this.kucoinWsLastMsg, ksPoller.lastOk),
    })
    return rows
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

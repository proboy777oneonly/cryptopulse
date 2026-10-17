// ════════════════════════════════════════════════════════════════════
// Hyperliquid WebSocket: allMids (цены всех монет) + l2Book (стаканы)
// Обходит REST rate-limit (429) и даёт данные в реальном времени.
// ════════════════════════════════════════════════════════════════════

import type { BookEngine, Level } from './books'
import type { TickerHub } from './exchanges'
import type { Mkt } from './types'

const WS_URL = 'wss://api.hyperliquid.xyz/ws'

interface HlBook {
  bids: Level[]
  asks: Level[]
  updatedAt: number
  lastScan: number
}

export class HlWs {
  private ws: WebSocket | null = null
  private mids = new Map<string, number>()
  private books = new Map<string, HlBook>()
  private subscribed = new Set<string>()
  private lastMsg = 0
  private msgCount = 0
  private startedAt = Date.now()
  private batch: { symbol: string; price: number }[] = []

  constructor(private hub: TickerHub, private booksEngine: BookEngine) {}

  start() {
    this.connect()
    // цены — батчем каждые 1.5с
    setInterval(() => {
      if (this.batch.length === 0) return
      const rows = this.batch.splice(0, 2000).map((b) => ({ symbol: b.symbol, price: b.price, vol24h: 0, open24h: 0, change24hPct: NaN, partial: true }))
      this.hub.feedExternal('HL', 'F', rows)
    }, 1500)
    // подписки на стаканы
    setInterval(() => this.syncSubscriptions(), 30_000)
    // скан стен
    setInterval(() => this.scanWalls(), 5000)
  }

  private connect() {
    console.log('[HL ws] connecting…')
    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = () => {
      console.log('[HL ws] connected')
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }))
      setTimeout(() => this.syncSubscriptions(), 2000)
      setTimeout(() => this.syncSubscriptions(), 9000)
    }

    ws.onmessage = (ev) => {
      this.lastMsg = Date.now()
      this.msgCount += 1
      let d: any
      try { d = JSON.parse(String(ev.data)) } catch { return }
      if (d?.channel === 'allMids' && d?.data?.mids) {
        for (const [sym, px] of Object.entries(d.data.mids) as [string, string][]) {
          if (!/^[A-Za-z0-9]{2,10}$/.test(sym)) continue
          this.mids.set(sym, Number(px))
          this.batch.push({ symbol: sym, price: Number(px) })
        }
      } else if (d?.channel === 'l2Book' && d?.data?.levels && typeof d?.data?.coin === 'string') {
        const coin: string = d.data.coin
        const bids: Level[] = (d.data.levels[0] ?? []).map((l: any) => ({ price: Number(l.px), size: Number(l.sz) }))
        const asks: Level[] = (d.data.levels[1] ?? []).map((l: any) => ({ price: Number(l.px), size: Number(l.sz) }))
        let b = this.books.get(coin)
        if (!b) { b = { bids: [], asks: [], updatedAt: 0, lastScan: 0 }; this.books.set(coin, b) }
        b.bids = bids
        b.asks = asks
        b.updatedAt = Date.now()
      }
    }

    ws.onerror = () => console.error('[HL ws] error')
    ws.onclose = () => {
      console.log('[HL ws] closed, reconnect in 4s')
      this.ws = null
      setTimeout(() => this.connect(), 4000)
    }
  }

  private syncSubscriptions() {
    const ws = this.ws
    if (!ws || ws.readyState !== 1) return
    const want = new Set(this.booksEngine.getWatch('HL', 'F').map((s) => s.replace(/USDT$/, '')))
    const add = [...want].filter((c) => !this.subscribed.has(c))
    const remove = [...this.subscribed].filter((c) => !want.has(c))
    for (const coin of add) ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin } }))
    for (const coin of remove) ws.send(JSON.stringify({ method: 'unsubscribe', subscription: { type: 'l2Book', coin } }))
    this.subscribed = want
    if (add.length > 0 || remove.length > 0) {
      console.log(`[HL ws] book subs: +${add.length} -${remove.length}, total ${want.size}`)
    }
  }

  private scanWalls() {
    const now = Date.now()
    const baseline = now - this.startedAt < 60_000
    for (const [coin, b] of this.books) {
      if (now - b.updatedAt > 60_000 || now - b.lastScan < 5000) continue
      b.lastScan = now
      if (b.bids.length === 0 || b.asks.length === 0) continue
      this.booksEngine.feedBook('HL', 'F', `${coin}USDT`, { bids: b.bids, asks: b.asks }, baseline)
    }
  }

  health(_m: Mkt): { status: 'online' | 'degraded' | 'offline'; booksLive: number; msgs: number; lastMsg: number } {
    const since = Date.now() - this.lastMsg
    const status = since < 15_000 ? 'online' : since < 60_000 ? 'degraded' : 'offline'
    return { status, booksLive: status === 'online' ? this.books.size : 0, msgs: this.msgCount, lastMsg: this.lastMsg }
  }
}

import { COINS, futuresExchanges, spotExchanges, type CoinDef } from './coins'
import type { ExchangeId, MarketType, Surge, TickerSnapshot } from './types'

function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

interface Listing {
  ex: ExchangeId
  m: MarketType
  sym: string
  bias: number
}

/**
 * Симулятор рынка: случайное блуждание «истинной» цены монеты + отклонения
 * листингов по биржам (порождает арбитраж), всплески (surge) для движений,
 * границы минутных/5-минутных свечей.
 */
export class MarketSim {
  coins: CoinDef[] = COINS
  truePrice = new Map<string, number>()
  open24h = new Map<string, number>()
  vol24h = new Map<string, number>()
  coinHistory = new Map<string, number[]>()
  tickers = new Map<string, TickerSnapshot>()
  listings: Listing[] = []
  surges: Surge[] = []
  private lastMinute = 0
  private lastFiveMin = 0
  onChangeCandle: ((sym: string) => void) | null = null

  constructor() {
    for (const c of this.coins) {
      const initChange = gauss() * (c.category === 'major' ? 0.02 : 0.035)
      this.truePrice.set(c.symbol, c.basePrice)
      this.open24h.set(c.symbol, c.basePrice / (1 + initChange))
      this.vol24h.set(c.symbol, c.volBase * (0.6 + Math.random() * 0.9))
      this.coinHistory.set(c.symbol, [])

      for (const ex of futuresExchanges(c)) this.listings.push({ ex, m: 'F', sym: c.symbol, bias: gauss() * 0.0006 })
      for (const ex of spotExchanges(c)) this.listings.push({ ex, m: 'S', sym: c.symbol, bias: gauss() * 0.0009 })
    }
    // Прогрев истории для спарклайнов
    for (let i = 0; i < 90; i++) this.step(true)
    this.lastMinute = Math.floor(Date.now() / 60000)
    this.lastFiveMin = Math.floor(Date.now() / 300000)
  }

  /** Один тик симуляции (вызывается раз в секунду). */
  step(warmup = false) {
    const now = Date.now()
    const minute = Math.floor(now / 60000)
    const fiveMin = Math.floor(now / 300000)
    const newMinute = !warmup && minute !== this.lastMinute
    const newFiveMin = !warmup && fiveMin !== this.lastFiveMin
    this.lastMinute = minute
    this.lastFiveMin = fiveMin

    // ── Всплески (для движений): держим 1–3 одновременно
    if (this.surges.length < 3 && Math.random() < 0.05) {
      const pool = this.coins.filter((c) => c.category === 'meme' || c.category === 'mid' || (Math.random() < 0.35 && c.category === 'large'))
      if (pool.length > 0) {
        const c = pool[Math.floor(Math.random() * pool.length)]
        const dir = Math.random() < 0.5 ? 1 : -1
        const magnitude = 0.04 + Math.random() * 0.09 // 4–13% всего
        const steps = 8 + Math.floor(Math.random() * 30)
        this.surges.push({ symbol: c.symbol, dir: dir as 1 | -1, stepsLeft: steps, perStep: magnitude / steps })
      }
    }

    const surgeBySym = new Map<string, number>()
    for (let i = this.surges.length - 1; i >= 0; i--) {
      const s = this.surges[i]
      surgeBySym.set(s.symbol, (surgeBySym.get(s.symbol) ?? 0) + s.perStep * s.dir)
      s.stepsLeft -= 1
      if (s.stepsLeft <= 0) this.surges.splice(i, 1)
    }

    // ── Истинные цены и объёмы
    for (const c of this.coins) {
      const surge = surgeBySym.get(c.symbol) ?? 0
      const drift = gauss() * c.volatility
      const prev = this.truePrice.get(c.symbol)!
      const next = Math.max(prev * (1 + drift + surge), c.basePrice * 0.05)
      this.truePrice.set(c.symbol, next)

      const vol = this.vol24h.get(c.symbol)! * (1 + gauss() * 0.008)
      this.vol24h.set(c.symbol, Math.min(Math.max(vol, c.volBase * 0.25), c.volBase * 2.5))

      if (!warmup) {
        const hist = this.coinHistory.get(c.symbol)!
        hist.push(next)
        if (hist.length > 120) hist.shift()
      }
    }

    // ── Листинги: цена = истинная × (1 + bias + шум)
    for (const l of this.listings) {
      const tp = this.truePrice.get(l.sym)!
      // bias медленно возвращается к нулю, изредка скачет (арбитражные окна)
      l.bias = l.bias * 0.996 + gauss() * 0.00018
      if (Math.random() < 0.0008) l.bias += gauss() * 0.006
      const noise = gauss() * 0.00035
      const price = tp * (1 + l.bias + noise)

      const key = `${l.ex}:${l.m}:${l.sym}`
      const open24 = this.open24h.get(l.sym)!
      const vol = this.vol24h.get(l.sym)!
      let t = this.tickers.get(key)
      if (!t) {
        t = {
          key, exchange: l.ex, market: l.m, symbol: l.sym,
          price, open24h: open24, open1m: price, open5m: price,
          vol24h: vol, change24hPct: 0, change1mPct: 0, change5mPct: 0, bias: l.bias,
        }
        this.tickers.set(key, t)
      }
      t.price = price
      t.vol24h = vol
      t.bias = l.bias
      t.open24h = open24
      if (newMinute) {
        t.open1m = price
        this.onChangeCandle?.(l.sym)
      }
      if (newFiveMin) t.open5m = price
      t.change24hPct = ((price - t.open24h) / t.open24h) * 100
      t.change1mPct = ((price - t.open1m) / t.open1m) * 100
      t.change5mPct = ((price - t.open5m) / t.open5m) * 100
    }
  }

  ticker(ex: ExchangeId, m: MarketType, sym: string): TickerSnapshot | undefined {
    return this.tickers.get(`${ex}:${m}:${sym}`)
  }

  coinsOn(ex: ExchangeId, m: MarketType): string[] {
    return this.listings.filter((l) => l.ex === ex && l.m === m).map((l) => l.sym)
  }

  sparkline(sym: string): number[] {
    return this.coinHistory.get(sym) ?? []
  }
}

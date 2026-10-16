// ════════════════════════════════════════════════════════════════════
// Адаптеры тикеров бирж (REST) + менеджер состояния.
// Binance F/S питается WebSocket'ом (binance-ws.ts), не REST.
// ════════════════════════════════════════════════════════════════════

import {
  comboId, EX_COMBO, jget,
  type Combo, type Ex, type Mkt, type MoverRow, type RawTicker, type SpreadRow, type TickerRow,
} from './types'

// ─── Утилиты ─────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 'BTC-USDT' | 'BTC_USDT' | 'BTCUSDT' | 'BTC-USDT-SWAP' | 'XBTUSDTM' | 'BTC' → 'BTCUSDT' */
export function normSymbol(raw: string, ex: Ex): string | null {
  let s = String(raw).toUpperCase()
  if (ex === 'OKX') {
    if (s.endsWith('-USDT-SWAP')) s = s.slice(0, -10)
    else if (s.endsWith('-USDT')) s = s.slice(0, -5)
    else return null
  } else if (ex === 'GATE') {
    if (!s.endsWith('_USDT')) return null
    s = s.slice(0, -5)
  } else if (ex === 'KUKOIN') {
    if (s.endsWith('-USDT')) s = s.slice(0, -5)
    else if (s.endsWith('USDTM')) s = s.slice(0, -5)
    else return null
    if (s === 'XBT') s = 'BTC'
  } else if (ex === 'HL') {
    if (!/^[A-Z0-9]{2,10}$/.test(s)) return null
    return s + 'USDT'
  } else {
    if (!s.endsWith('USDT')) return null
    s = s.slice(0, -4)
  }
  if (!s || s.length > 16) return null
  return s + 'USDT'
}

const isLiquid = (t: RawTicker): boolean =>
  t.price > 0 && t.vol24h > 50_000 && Number.isFinite(t.change24hPct)

// ─── REST-адаптеры (кроме BINANCE) ───────────────────────────────────

export interface PollerDef {
  combo: Combo
  intervalMs: number
  fetchRows: () => Promise<RawTicker[]>
}

export const POLLERS: PollerDef[] = []

function def(ex: Ex, m: Mkt, intervalMs: number, fetchRows: () => Promise<RawTicker[]>) {
  POLLERS.push({ combo: { ex, m }, intervalMs, fetchRows })
}

// BYBIT F — линейные перпы
def('BYBIT', 'F', 3200, async () => {
  const d = await jget('https://api.bybit.com/v5/market/tickers?category=linear')
  return (d?.result?.list ?? [])
    .filter((x: any) => typeof x.symbol === 'string' && x.symbol.endsWith('USDT'))
    .map((x: any) => ({ symbol: x.symbol, price: num(x.lastPrice), open24h: num(x.prevPrice24h), vol24h: num(x.turnover24h), change24hPct: num(x.price24hPcnt) * 100 }))
})

// BYBIT S — спот
def('BYBIT', 'S', 3600, async () => {
  const d = await jget('https://api.bybit.com/v5/market/tickers?category=spot')
  return (d?.result?.list ?? [])
    .filter((x: any) => typeof x.symbol === 'string' && x.symbol.endsWith('USDT'))
    .map((x: any) => ({ symbol: x.symbol, price: num(x.lastPrice), open24h: num(x.prevPrice24h), vol24h: num(x.turnover24h), change24hPct: num(x.price24hPcnt) * 100 }))
})

// OKX F — свопы
def('OKX', 'F', 3400, async () => {
  const d = await jget('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
  return (d?.data ?? [])
    .filter((x: any) => typeof x.instId === 'string' && x.instId.endsWith('-USDT-SWAP'))
    .map((x: any) => {
      const price = num(x.last)
      const open = num(x.open24h)
      return { symbol: x.instId, price, open24h: open, vol24h: num(x.volCcy24h) * price, change24hPct: open > 0 ? ((price - open) / open) * 100 : 0 }
    })
})

// OKX S — спот
def('OKX', 'S', 3800, async () => {
  const d = await jget('https://www.okx.com/api/v5/market/tickers?instType=SPOT')
  return (d?.data ?? [])
    .filter((x: any) => typeof x.instId === 'string' && x.instId.endsWith('-USDT'))
    .map((x: any) => {
      const price = num(x.last)
      const open = num(x.open24h)
      return { symbol: x.instId, price, open24h: open, vol24h: num(x.volCcy24h), change24hPct: open > 0 ? ((price - open) / open) * 100 : 0 }
    })
})

// GATE F — фьючерсы USDT
def('GATE', 'F', 6500, async () => {
  const d = await jget('https://api.gateio.ws/api/v4/futures/usdt/tickers')
  return (d as any[])
    .filter((x) => typeof x.contract === 'string' && x.contract.endsWith('_USDT'))
    .map((x) => {
      const price = num(x.last)
      const pct = num(x.change_percentage)
      return { symbol: x.contract, price, open24h: price / (1 + pct / 100), vol24h: num(x.volume_24h_quote), change24hPct: pct }
    })
})

// GATE S — спот
def('GATE', 'S', 7000, async () => {
  const d = await jget('https://api.gateio.ws/api/v4/spot/tickers')
  return (d as any[])
    .filter((x) => typeof x.currency_pair === 'string' && x.currency_pair.endsWith('_USDT'))
    .map((x) => {
      const price = num(x.last)
      const pct = num(x.change_percentage)
      return { symbol: x.currency_pair, price, open24h: price / (1 + pct / 100), vol24h: num(x.quote_volume), change24hPct: pct }
    })
})

// BITGET F — микс USDT-FUTURES
def('BITGET', 'F', 5200, async () => {
  const d = await jget('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES')
  return (d?.data ?? [])
    .filter((x: any) => typeof x.symbol === 'string' && x.symbol.endsWith('USDT'))
    .map((x: any) => ({ symbol: x.symbol, price: num(x.lastPr), open24h: num(x.open24h), vol24h: num(x.usdtVolume), change24hPct: num(x.change24h) * 100 }))
})

// BITGET S — спот
def('BITGET', 'S', 5600, async () => {
  const d = await jget('https://api.bitget.com/api/v2/spot/market/tickers')
  return (d?.data ?? [])
    .filter((x: any) => typeof x.symbol === 'string' && x.symbol.endsWith('USDT'))
    .map((x: any) => {
      const price = num(x.lastPr)
      const pct = num(x.change24h) * 100
      return { symbol: x.symbol, price, open24h: price / (1 + pct / 100), vol24h: num(x.quoteVolume), change24hPct: pct }
    })
})

// KUKOIN F — фьючерсы (api-futures.kucoin.com)
let kucoinFutMult = new Map<string, number>()
def('KUKOIN', 'F', 9000, async () => {
  const d = await jget('https://api-futures.kucoin.com/api/v1/contracts/active')
  const out: RawTicker[] = []
  const mults = new Map<string, number>()
  for (const c of d?.data ?? []) {
    if (c?.status !== 'Open' || c?.quoteCurrency !== 'USDT' || !/^(\w+)USDTM$/.test(c.symbol ?? '')) continue
    mults.set(c.symbol, num(c.multiplier) || 1)
    // symbol остаётся сырым (XBTUSDTM) — нормализацию делает feed()
    out.push({ symbol: String(c.symbol), price: num(c.lastTradePrice), open24h: num(c.lastTradePrice) / (1 + num(c.priceChgPct)), vol24h: num(c.turnoverOf24h), change24hPct: num(c.priceChgPct) * 100 })
  }
  kucoinFutMult = mults
  return out
})

export function kucoinFutMultiplier(contract: string): number {
  return kucoinFutMult.get(contract) ?? 1
}

// KUKOIN S — спот
def('KUKOIN', 'S', 6000, async () => {
  const d = await jget('https://api.kucoin.com/api/v1/market/allTickers')
  return (d?.data?.ticker ?? [])
    .filter((x: any) => typeof x.symbol === 'string' && x.symbol.endsWith('-USDT'))
    .map((x: any) => ({ symbol: x.symbol, price: num(x.last), open24h: num(x.open), vol24h: num(x.volValue), change24hPct: num(x.changeRate) * 100 }))
})

// HL F — Hyperliquid перпы (цены — WS allMids в hl-ws.ts; REST редко обновляет vol/open)
def('HL', 'F', 45_000, async () => {
  const d = await jget('https://api.hyperliquid.xyz/info', 12_000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  })
  const [meta, ctxs] = d as [any, any[]]
  const out: RawTicker[] = []
  const uni = meta?.universe ?? []
  for (let i = 0; i < uni.length; i++) {
    const ctx = ctxs?.[i]
    if (!ctx) continue
    // name остаётся сырым (BTC) — нормализацию делает feed()
    const name = String(uni[i]?.name ?? '')
    if (!name) continue
    const price = num(ctx.markPx)
    const prev = num(ctx.prevDayPx)
    out.push({ symbol: name, price, open24h: prev, vol24h: num(ctx.dayNtlVlm), change24hPct: prev > 0 ? ((price - prev) / prev) * 100 : 0 })
  }
  return out
})

// ASTER F — Aster перпы
def('ASTER', 'F', 5200, async () => {
  const d = await jget('https://fapi.asterdex.com/fapi/v1/ticker/24hr')
  return (d as any[])
    .filter((x) => typeof x.symbol === 'string' && x.symbol.endsWith('USDT'))
    .map((x) => ({ symbol: x.symbol, price: num(x.lastPrice), open24h: num(x.openPrice), vol24h: num(x.quoteVolume), change24hPct: num(x.priceChangePercent) }))
})

// ─── Менеджер состояния тикеров ──────────────────────────────────────

export interface PollerState {
  def: PollerDef | null // null = питается внешним источником (WS)
  id: string
  combo: Combo
  rows: Map<string, TickerRow> // key → row
  lastOk: number
  lastErr: number
  latencyMs: number
  msgsPerSec: number
  errStreak: number
  lastRowCount: number
  startedAt: number
  rowAccum: number
  rowAccumAt: number
}

export class TickerHub {
  pollers: PollerState[] = EX_COMBO.map((c) => ({
    def: POLLERS.find((p) => comboId(p.combo) === comboId(c)) ?? null,
    id: comboId(c),
    combo: c,
    rows: new Map(),
    lastOk: 0, lastErr: 0, latencyMs: 0, msgsPerSec: 0, errStreak: 0, lastRowCount: 0,
    startedAt: Date.now(), rowAccum: 0, rowAccumAt: Date.now(),
  }))
  onMovers: ((rows: MoverRow[]) => void) | null = null
  errors = 0

  byId(id: string): PollerState | undefined {
    return this.pollers.find((p) => p.id === id)
  }

  start() {
    let i = 0
    for (const p of this.pollers) {
      if (!p.def) continue // BINANCE — через WS
      const pollerDef = p.def
      const run = async () => {
        try {
          const t0 = Date.now()
          const raw = await pollerDef.fetchRows()
          p.latencyMs = Date.now() - t0
          this.feed(p, raw, false)
          p.lastOk = Date.now()
          p.lastRowCount = raw.length
          p.rowAccum += raw.length
          p.errStreak = 0
        } catch (e) {
          p.lastErr = Date.now()
          p.errStreak += 1
          this.errors += 1
          console.error(`[${p.id}] poll error:`, (e as Error).message)
        }
        const backoff = p.errStreak > 4 ? 2.5 : 1
        setTimeout(run, pollerDef.intervalMs * backoff + Math.random() * 400)
      }
      setTimeout(run, 300 + i * 250)
      i += 1
    }
  }

  /** Публичная точка входа для WS-источников (Binance) */
  feedExternal(ex: Ex, m: Mkt, raw: RawTicker[]) {
    const p = this.pollers.find((x) => x.combo.ex === ex && x.combo.m === m)
    if (p) this.feed(p, raw, true)
  }

  /** Обновление строк + минутные открытия свечей */
  private feed(p: PollerState, raw: RawTicker[], incremental: boolean) {
    const now = Date.now()
    const minute = Math.floor(now / 60_000)
    const fiveMin = Math.floor(now / 300_000)

    const { ex, m } = p.combo
    const seen = new Set<string>()
    const movers: MoverRow[] = []

    for (const r of raw) {
      const symbol = normSymbol(r.symbol, ex)
      if (!symbol) continue
      if (!r.partial && !r.metaOnly && !isLiquid(r)) continue
      const key = `${ex}:${m}:${symbol}`
      seen.add(key)
      let t = p.rows.get(key)
      if (!t) {
        if (r.partial) continue // частичные обновления — только для известных символов
        t = {
          key, ex, m, symbol,
          price: r.price, open24h: r.open24h, vol24h: r.vol24h, change24hPct: r.change24hPct,
          open1m: r.price, open5m: r.price, change1mPct: 0, change5mPct: 0, updatedAt: now,
        }
        p.rows.set(key, t)
      }
      // минутные/5-минутные открытия — по факту пересечения границы строки
      if (Math.floor(t.updatedAt / 60_000) !== minute) t.open1m = r.price > 0 ? r.price : t.price
      if (Math.floor(t.updatedAt / 300_000) !== fiveMin) t.open5m = r.price > 0 ? r.price : t.price
      if (!r.metaOnly && r.price > 0) t.price = r.price
      if (r.vol24h > 0) t.vol24h = r.vol24h
      if (r.open24h > 0) t.open24h = r.open24h
      t.change24hPct = Number.isFinite(r.change24hPct)
        ? r.change24hPct
        : (t.open24h > 0 ? ((t.price - t.open24h) / t.open24h) * 100 : t.change24hPct)
      t.updatedAt = now
      t.change1mPct = t.open1m > 0 ? ((t.price - t.open1m) / t.open1m) * 100 : 0
      t.change5mPct = t.open5m > 0 ? ((t.price - t.open5m) / t.open5m) * 100 : 0

      // movers: движения + топы 24ч
      if (
        Math.abs(t.change1mPct) >= 0.15 ||
        Math.abs(t.change5mPct) >= 0.4 ||
        (t.vol24h >= 20e6 && (t.change24hPct >= 4 || t.change24hPct <= -4))
      ) {
        movers.push({ ...t })
      }
    }

    // удаляем пропавшие символы (только для полных опросов)
    if (!incremental && p.rows.size > seen.size + 200) {
      for (const k of [...p.rows.keys()]) if (!seen.has(k)) p.rows.delete(k)
    }

    // msgsPerSec
    const dt = (now - p.rowAccumAt) / 1000
    if (dt >= 5) {
      p.msgsPerSec = Math.round(p.rowAccum / dt)
      p.rowAccum = 0
      p.rowAccumAt = now
    }

    if (movers.length > 0 && this.onMovers) {
      this.onMovers(movers.slice(0, 1200))
    }
  }

  /** Топ роста/падения 24ч (ликвидные) */
  topLists(): { gainers: MoverRow[]; losers: MoverRow[] } {
    const bySymbol = new Map<string, TickerRow>()
    for (const p of this.pollers) {
      for (const t of p.rows.values()) {
        if (t.vol24h < 20e6) continue
        const prev = bySymbol.get(t.symbol)
        if (!prev || t.vol24h > prev.vol24h) bySymbol.set(t.symbol, t)
      }
    }
    const arr = [...bySymbol.values()]
    return {
      gainers: [...arr].sort((a, b) => b.change24hPct - a.change24hPct).slice(0, 10).map(stripRow),
      losers: [...arr].sort((a, b) => a.change24hPct - b.change24hPct).slice(0, 10).map(stripRow),
    }
  }

  /** Межбиржевые спреды для режима F и S */
  spreads(): { F: SpreadRow[]; S: SpreadRow[] } {
    const res: { F: SpreadRow[]; S: SpreadRow[] } = { F: [], S: [] }
    for (const mode of ['F', 'S'] as Mkt[]) {
      const bySymbol = new Map<string, Map<Ex, TickerRow>>()
      for (const p of this.pollers) {
        if (p.combo.m !== mode) continue
        const fresh = Date.now() - p.lastOk < 90_000
        if (!fresh && p.rows.size === 0) continue
        for (const t of p.rows.values()) {
          if (t.vol24h < 5e6) continue
          let perEx = bySymbol.get(t.symbol)
          if (!perEx) { perEx = new Map(); bySymbol.set(t.symbol, perEx) }
          perEx.set(t.ex, t)
        }
      }
      const out: SpreadRow[] = []
      for (const [symbol, perEx] of bySymbol) {
        if (perEx.size < 2) continue
        let minP = Infinity, maxP = -Infinity
        let minEx: Ex | null = null, maxEx: Ex | null = null
        let vol = 0
        for (const [ex, t] of perEx) {
          if (t.price <= 0) continue
          if (t.price < minP) { minP = t.price; minEx = ex }
          if (t.price > maxP) { maxP = t.price; maxEx = ex }
          vol = Math.max(vol, t.vol24h)
        }
        if (!minEx || !maxEx || minEx === maxEx || minP <= 0) continue
        const spreadPct = ((maxP - minP) / minP) * 100
        if (spreadPct < 0.08 || spreadPct > 60) continue
        out.push({ symbol, buyEx: minEx, buyPrice: minP, sellEx: maxEx, sellPrice: maxP, spreadPct: Math.round(spreadPct * 100) / 100, vol24h: vol })
      }
      res[mode] = out.sort((a, b) => b.spreadPct - a.spreadPct).slice(0, 80)
    }
    return res
  }

  symbolsCount(): number {
    let n = 0
    for (const p of this.pollers) n += p.rows.size
    return n
  }

  /** Текущее множество символов комбинации (для диффа листингов) */
  snapshotSymbols(ex: Ex, m: Mkt): string[] {
    const p = this.pollers.find((x) => x.combo.ex === ex && x.combo.m === m)
    if (!p) return []
    return [...p.rows.values()].map((t) => t.symbol)
  }

  /** Объём 24ч конкретного символа (0 если нет) */
  symbolVol(ex: Ex, m: Mkt, symbol: string): number {
    const p = this.pollers.find((x) => x.combo.ex === ex && x.combo.m === m)
    return p?.rows.get(`${ex}:${m}:${symbol}`)?.vol24h ?? 0
  }
}

function stripRow(t: TickerRow): MoverRow {
  return {
    key: t.key, ex: t.ex, m: t.m, symbol: t.symbol,
    price: t.price, open24h: t.open24h, open1m: t.open1m, open5m: t.open5m,
    vol24h: t.vol24h, change24hPct: t.change24hPct, change1mPct: t.change1mPct, change5mPct: t.change5mPct,
  }
}

/** Список символов комбинации для комбобокса клиента */
export function symbolRows(hub: TickerHub, ex: Ex, m: Mkt) {
  const p = hub.pollers.find((x) => x.combo.ex === ex && x.combo.m === m)
  if (!p) return []
  return [...p.rows.values()]
    .sort((a, b) => b.vol24h - a.vol24h)
    .slice(0, 800)
    .map((t) => ({ symbol: t.symbol, price: t.price, vol24h: t.vol24h, change24hPct: t.change24hPct }))
}

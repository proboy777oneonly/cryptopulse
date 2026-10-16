import { NextRequest, NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════
// Прокси свечей (klines) для вкладки «Обзор рынка».
// BINANCE / BYBIT / OKX · F+S · серверный фетч (без CORS).
// Кэш + фолбэк-источники + circuit breaker (бан 418/429 на апстриме).
// ════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

export interface Candle {
  t: number // open time, ms
  o: number
  h: number
  l: number
  c: number
  v: number // quote volume (USDT)
}

type Ex = 'BINANCE' | 'BYBIT' | 'OKX'
type Mkt = 'F' | 'S'

const INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])

const BYBIT_IV: Record<string, string> = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' }
const OKX_IV: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' }

// ── кэш ────────────────────────────────────────────────────────────────
const cache = new Map<string, { at: number; candles: Candle[] }>()

function cacheTtlMs(interval: string): number {
  if (interval === '1m') return 25_000
  if (interval === '5m' || interval === '15m') return 90_000
  return 180_000
}

// ── circuit breaker по хосту апстрима ──────────────────────────────────
const hostHealth = new Map<string, { fails: number; bannedUntil: number }>()
const BAN_MS = 10 * 60_000

function hostBanned(url: string): boolean {
  try {
    const h = new URL(url).host
    const st = hostHealth.get(h)
    return !!st && Date.now() < st.bannedUntil
  } catch {
    return false
  }
}

function noteFail(url: string) {
  try {
    const h = new URL(url).host
    const st = hostHealth.get(h) ?? { fails: 0, bannedUntil: 0 }
    st.fails += 1
    if (st.fails >= 3) {
      st.bannedUntil = Date.now() + BAN_MS
      st.fails = 0
    }
    hostHealth.set(h, st)
  } catch { /* ignore */ }
}

function noteOk(url: string) {
  try {
    hostHealth.delete(new URL(url).host)
  } catch { /* ignore */ }
}

// ── спецификации источников ────────────────────────────────────────────

interface SourceSpec {
  url: string
  parse: (d: unknown) => Candle[]
}

function binanceSpec(apiBase: string, symbol: string, interval: string, limit: number): SourceSpec {
  return {
    url: `${apiBase}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    parse: (d: unknown) => {
      const rows = d as unknown[][]
      if (!Array.isArray(rows)) return []
      return rows.map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[7] ?? r[5]) }))
    },
  }
}

function bybitSpec(category: 'linear' | 'spot', symbol: string, interval: string, limit: number): SourceSpec {
  return {
    url: `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${encodeURIComponent(symbol)}&interval=${BYBIT_IV[interval]}&limit=${Math.min(limit, 1000)}`,
    parse: (d: unknown) => {
      const rows = (d as { result?: { list?: unknown[][] } })?.result?.list ?? []
      // Bybit отдаёт новые сверху — сортируем по времени
      return rows
        .map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) }))
        .sort((a, b) => a.t - b.t)
    },
  }
}

function okxSpec(instId: string, bar: string, limit: number, quoteIdx: number): SourceSpec {
  return {
    url: `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${Math.min(limit, 300)}`,
    // OKX: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm], новые сверху
    parse: (d: unknown) => {
      const rows = (d as { data?: unknown[][] })?.data ?? []
      return rows
        .map((r) => ({
          t: Number(r[0]),
          o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]),
          v: Number(r[quoteIdx] ?? r[5]),
        }))
        .filter((c) => Number.isFinite(c.t) && c.o > 0)
        .sort((a, b) => a.t - b.t)
    },
  }
}

/** источники по убыванию приоритета; фолбэк — тот же актив на другом рынке */
function buildSources(ex: Ex, m: Mkt, symbol: string, interval: string, limit: number): SourceSpec[] {
  if (ex === 'BINANCE') {
    const fapi = 'https://fapi.binance.com/fapi/v1'
    const sapi = 'https://api.binance.com/api/v3'
    // при бане fapi аварийно берём спот-свечи (график почти не отличается)
    return m === 'F'
      ? [binanceSpec(fapi, symbol, interval, limit), binanceSpec(sapi, symbol, interval, limit)]
      : [binanceSpec(sapi, symbol, interval, limit), binanceSpec(fapi, symbol, interval, limit)]
  }
  if (ex === 'BYBIT') {
    return m === 'F'
      ? [bybitSpec('linear', symbol, interval, limit), bybitSpec('spot', symbol, interval, limit)]
      : [bybitSpec('spot', symbol, interval, limit), bybitSpec('linear', symbol, interval, limit)]
  }
  if (ex === 'OKX') {
    const base = symbol.replace(/USDT$/, '')
    if (!base || base === symbol) return []
    const swap = okxSpec(`${base}-USDT-SWAP`, OKX_IV[interval], limit, 7)
    const spot = okxSpec(`${base}-USDT`, OKX_IV[interval], limit, 6)
    return m === 'F' ? [swap, spot] : [spot, swap]
  }
  return []
}

function normalize(candles: Candle[]): Candle[] {
  const sorted = candles.sort((a, b) => a.t - b.t)
  const seen = new Set<number>()
  return sorted.filter((c) => Number.isFinite(c.t) && c.o > 0 && (seen.has(c.t) ? false : (seen.add(c.t), true)))
}

async function fetchSource(spec: SourceSpec, timeoutMs = 10_000): Promise<Candle[] | null> {
  if (hostBanned(spec.url)) return null
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(spec.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) CryptoPulse/3.4', Accept: 'application/json' },
      cache: 'no-store',
    })
    if (res.status === 429 || res.status === 418) {
      noteFail(spec.url)
      return null
    }
    if (!res.ok) return null
    const json = await res.json()
    const candles = spec.parse(json)
    if (candles.length === 0) return null
    noteOk(spec.url)
    return normalize(candles)
  } catch {
    noteFail(spec.url)
    return null
  } finally {
    clearTimeout(to)
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ex = (sp.get('ex') ?? '') as Ex
  const m = (sp.get('m') ?? 'F') as Mkt
  const symbol = (sp.get('symbol') ?? '').toUpperCase()
  const interval = sp.get('interval') ?? '1h'
  const limit = Math.max(50, Math.min(500, Number(sp.get('limit') ?? 400) || 400))

  if (!['BINANCE', 'BYBIT', 'OKX'].includes(ex) || !['F', 'S'].includes(m)) {
    return NextResponse.json({ error: 'bad exchange/market' }, { status: 400 })
  }
  if (!/^[A-Z0-9]{4,20}$/.test(symbol) || !symbol.endsWith('USDT')) {
    return NextResponse.json({ error: 'bad symbol' }, { status: 400 })
  }
  if (!INTERVALS.has(interval)) {
    return NextResponse.json({ error: 'bad interval' }, { status: 400 })
  }

  const key = `${ex}|${m}|${symbol}|${interval}|${limit}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < cacheTtlMs(interval)) {
    return NextResponse.json({ candles: hit.candles, cached: true })
  }

  const sources = buildSources(ex, m, symbol, interval, limit)
  if (sources.length === 0) {
    return NextResponse.json({ error: 'unsupported' }, { status: 400 })
  }

  // по источникам по очереди; отдаём кэш-полустухлое, если все пали
  for (const spec of sources) {
    const candles = await fetchSource(spec)
    if (candles) {
      cache.set(key, { at: Date.now(), candles })
      if (cache.size > 300) {
        const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
        for (const [k] of entries.slice(0, 100)) cache.delete(k)
      }
      return NextResponse.json({ candles })
    }
  }
  if (hit) {
    return NextResponse.json({ candles: hit.candles, cached: true, stale: true })
  }
  return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 })
}

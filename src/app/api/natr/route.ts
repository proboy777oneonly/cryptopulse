import { NextRequest, NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════
// NATR (нормализованная волатильность) для списка монет.
// Один batched-запрос к бирже → (high24h − low24h) / last × 100.
// BINANCE / BYBIT / OKX · F+S · серверный кэш 60с.
// ════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

type Ex = 'BINANCE' | 'BYBIT' | 'OKX'
type Mkt = 'F' | 'S'

const cache = new Map<string, { at: number; data: Record<string, number> }>()
const TTL = 60_000

interface Row {
  symbol: string
  high: number
  low: number
  last: number
}

async function fetchRows(ex: Ex, m: Mkt): Promise<Row[]> {
  const url =
    ex === 'BINANCE'
      ? m === 'F'
        ? 'https://fapi.binance.com/fapi/v1/ticker/24hr'
        : 'https://api.binance.com/api/v3/ticker/24hr'
      : ex === 'BYBIT'
        ? `https://api.bybit.com/v5/market/tickers?category=${m === 'F' ? 'linear' : 'spot'}`
        : `https://www.okx.com/api/v5/market/tickers?instType=${m === 'F' ? 'SWAP' : 'SPOT'}`

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) CryptoPulse/3.7', Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()

    if (ex === 'BINANCE') {
      const rows = json as { symbol?: string; highPrice?: string; lowPrice?: string; lastPrice?: string }[]
      if (!Array.isArray(rows)) return []
      return rows
        .filter((r) => r.symbol?.endsWith('USDT') && /^[A-Z0-9]+$/.test(r.symbol))
        .map((r) => ({ symbol: r.symbol!, high: Number(r.highPrice), low: Number(r.lowPrice), last: Number(r.lastPrice) }))
    }
    if (ex === 'BYBIT') {
      const rows = (json as { result?: { list?: { symbol?: string; highPrice24h?: string; lowPrice24h?: string; lastPrice?: string }[] } })?.result?.list ?? []
      return rows
        .filter((r) => r.symbol?.endsWith('USDT') && /^[A-Z0-9]+$/.test(r.symbol))
        .map((r) => ({ symbol: r.symbol!, high: Number(r.highPrice24h), low: Number(r.lowPrice24h), last: Number(r.lastPrice) }))
    }
    // OKX
    const rows = (json as { data?: { instId?: string; high24h?: string; low24h?: string; last?: string }[] })?.data ?? []
    return rows
      .filter((r) => r.instId?.endsWith('-USDT') || r.instId?.endsWith('-USDT-SWAP'))
      .map((r) => {
        const base = r.instId!.replace('-USDT-SWAP', '').replace('-USDT', '')
        return { symbol: `${base}USDT`, high: Number(r.high24h), low: Number(r.low24h), last: Number(r.last) }
      })
  } catch {
    return []
  } finally {
    clearTimeout(to)
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ex = (sp.get('ex') ?? '') as Ex
  const m = (sp.get('m') ?? 'F') as Mkt
  if (!['BINANCE', 'BYBIT', 'OKX'].includes(ex) || !['F', 'S'].includes(m)) {
    return NextResponse.json({ error: 'bad exchange/market' }, { status: 400 })
  }

  const key = `${ex}_${m}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ natr: hit.data })
  }

  const rows = await fetchRows(ex, m)
  const natr: Record<string, number> = {}
  for (const r of rows) {
    if (r.last > 0 && r.high > r.low) {
      const v = ((r.high - r.low) / r.last) * 100
      if (Number.isFinite(v) && v >= 0 && v < 500) natr[r.symbol] = Math.round(v * 100) / 100
    }
  }
  const size = Object.keys(natr).length
  if (size > 0) cache.set(key, { at: Date.now(), data: natr })
  if (cache.size > 12) {
    for (const [k] of [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 4)) cache.delete(k)
  }
  return NextResponse.json({ natr, source: size > 0 ? 'live' : 'empty' })
}

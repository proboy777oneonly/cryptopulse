// ════════════════════════════════════════════════════════════════════
// Общие типы market-сервиса
// ════════════════════════════════════════════════════════════════════

export type Ex = 'BINANCE' | 'BYBIT' | 'OKX' | 'GATE' | 'BITGET' | 'KUKOIN' | 'HL' | 'ASTER'
export type Mkt = 'F' | 'S'

export interface Combo {
  ex: Ex
  m: Mkt
}

/** Сырая строка тикера после парсинга ответа биржи */
export interface RawTicker {
  symbol: string // сырой символ биржи (BTCUSDT / BTC-USDT / XBTUSDTM / BTC)
  price: number
  open24h: number
  vol24h: number // quote USDT
  change24hPct: number
  /** частичное обновление (только цена) — vol/open не перезаписываются */
  partial?: boolean
  /** обновление метаданных (vol/open/pct) — цена не перезаписывается */
  metaOnly?: boolean
}

/** Строка тикера с трекингом открытия свечей */
export interface TickerRow extends RawTicker {
  key: string // `${ex}:${m}:${symbol}`
  ex: Ex
  m: Mkt
  open1m: number
  open5m: number
  change1mPct: number
  change5mPct: number
  updatedAt: number
}

/** Строка для клиента — движений/топов */
export interface MoverRow {
  key: string
  ex: Ex
  m: Mkt
  symbol: string
  price: number
  open24h: number
  open1m: number
  open5m: number
  vol24h: number
  change24hPct: number
  change1mPct: number
  change5mPct: number
}

export interface SpreadRow {
  symbol: string
  buyEx: Ex
  buyPrice: number
  sellEx: Ex
  sellPrice: number
  spreadPct: number
  vol24h: number
}

export interface WallRow {
  id: string
  ex: Ex
  m: Mkt
  symbol: string
  side: 'BID' | 'ASK'
  price: number
  notionalUsd: number
  distPct: number
  vol24h: number
  ts: number
}

export interface ConnectRow {
  id: string
  exchange: Ex
  market: Mkt
  status: 'online' | 'degraded' | 'offline'
  latencyMs: number
  msgsPerSec: number
  booksLive: number
  booksTotal: number
  uptime: number
  lastMsg: number
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  category: string
  impact: 'high' | 'medium' | 'low'
  source: string
  link: string
  time: number
  affects: string[]
}

export interface ServiceStats {
  ticks: number
  walls: number
  movers: number
  spreads: number
  news: number
  errors: number
  startedAt: number
  wsClients: number
  symbols: number
  sys: {
    appVersion: string
    nodeVersion: string
    platform: string
    cpuModel: string
    cpuCores: number
    cpuLoadPct: number[]
    loadAvg: number[]
    eventLoopLagMs: number
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    systemMemTotal: number
    systemMemFree: number
    processPid: number
    uptime: number
    serverTime: string
  }
}

export const EX_COMBO: Combo[] = [
  { ex: 'BINANCE', m: 'F' }, { ex: 'BINANCE', m: 'S' },
  { ex: 'BYBIT', m: 'F' }, { ex: 'BYBIT', m: 'S' },
  { ex: 'OKX', m: 'F' }, { ex: 'OKX', m: 'S' },
  { ex: 'GATE', m: 'F' }, { ex: 'GATE', m: 'S' },
  { ex: 'BITGET', m: 'F' }, { ex: 'BITGET', m: 'S' },
  { ex: 'KUKOIN', m: 'F' }, { ex: 'KUKOIN', m: 'S' },
  { ex: 'HL', m: 'F' },
  { ex: 'ASTER', m: 'F' },
]

export function comboId(c: Combo): string {
  return `${c.ex}_${c.m}`
}

/** HTTP GET JSON с таймаутом */
export async function jget(url: string, timeoutMs = 10_000, init?: RequestInit): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) CryptoPulse/3.0', ...(init?.headers ?? {}) },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}

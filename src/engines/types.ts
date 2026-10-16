// ─── Общие типы домена ────────────────────────────────────────────────

export type ExchangeId = 'BINANCE' | 'BYBIT' | 'OKX' | 'GATE' | 'BITGET' | 'KUKOIN' | 'HL' | 'ASTER'
export type MarketType = 'F' | 'S'
export type DensityMode = 'ALL' | 'F' | 'S'
export type MoveDirection = 'both' | 'up' | 'down'
export type MovePeriod = '1m' | '5m' | '24h'

export interface ExchangeMeta {
  id: ExchangeId
  name: string
  color: string
}

export const EXCHANGES: ExchangeMeta[] = [
  { id: 'BINANCE', name: 'Binance', color: '#F0B90B' },
  { id: 'BYBIT', name: 'Bybit', color: '#F7A600' },
  { id: 'OKX', name: 'OKX', color: '#E2E8F0' },
  { id: 'GATE', name: 'Gate', color: '#17E5A1' },
  { id: 'BITGET', name: 'Bitget', color: '#00E5D0' },
  { id: 'KUKOIN', name: 'KuCoin', color: '#24D6A0' },
  { id: 'HL', name: 'Hyperliquid', color: '#9DF2D8' },
  { id: 'ASTER', name: 'Aster', color: '#C8F169' },
]

export const EX_MAP: Record<ExchangeId, ExchangeMeta> = Object.fromEntries(
  EXCHANGES.map((e) => [e.id, e]),
) as Record<ExchangeId, ExchangeMeta>

export function exName(id: ExchangeId): string {
  return EX_MAP[id]?.name ?? id
}

// ─── Рынок ─────────────────────────────────────────────────────────────

export interface TickerSnapshot {
  key: string // `${ex}:${m}:${sym}`
  exchange: ExchangeId
  market: MarketType
  symbol: string
  price: number
  open24h: number
  open1m: number
  open5m: number
  vol24h: number
  change24hPct: number
  change1mPct: number
  change5mPct: number
  bias: number
}

export interface Surge {
  symbol: string
  dir: 1 | -1
  stepsLeft: number
  perStep: number
}

// ─── Плотности ────────────────────────────────────────────────────────

export interface DensityMarketSettings {
  minVolume24h: number
  minOrderUsd: number
  bidDepthPct: number
  askDepthPct: number
  lifetimeSec: number
  soundId: string
  volumePct: number
  voice: boolean
}

export interface DensityTickerOverride {
  enabled: boolean
  minVolume24h?: number
  minOrderUsd?: number
  note?: string
}

export interface DensityWindowConfig {
  id: string
  exchange: ExchangeId
  mode: DensityMode
  enabled: boolean
  f: DensityMarketSettings
  s: DensityMarketSettings
  tickers: Record<string, DensityTickerOverride>
  blacklistF: string[]
  blacklistS: string[]
}

export interface DensityEvent {
  id: string
  windowId: string
  exchange: ExchangeId
  market: MarketType
  symbol: string
  side: 'BID' | 'ASK'
  direction: 'LONG' | 'SHORT'
  volumeUsd: number
  strengthPct: number
  levelPrice: number
  createdAt: number
  expiresAt: number
  lifetimeSec: number
}

// ─── Движения ─────────────────────────────────────────────────────────

export interface MovementMarketToggles {
  BINANCE_F: boolean
  BINANCE_S: boolean
  BYBIT_F: boolean
  BYBIT_S: boolean
  OKX_F: boolean
  OKX_S: boolean
}

export interface MoveCoinRule {
  symbol: string
  pct: number
}

export interface MovementWindowConfig {
  id: string
  name: string
  enabled: boolean
  period: MovePeriod
  direction: MoveDirection
  thresholdPct: number
  minVol24h: number
  cooldownSec: number
  markets: MovementMarketToggles
  coinRules: MoveCoinRule[]
}

export interface MovementAlert {
  id: string
  windowId: string
  exchange: ExchangeId
  market: MarketType
  symbol: string
  period: MovePeriod
  changePct: number
  price: number
  vol24h: number
  time: number
}

// ─── Арбитраж ─────────────────────────────────────────────────────────

export interface ArbitrageConfig {
  minSpreadPct: number
  minVol24h: number
  mode: MarketType
  exchanges: Record<ExchangeId, boolean>
}

export interface ArbOpportunity {
  id: string
  symbol: string
  market: MarketType
  buyExchange: ExchangeId
  buyPrice: number
  sellExchange: ExchangeId
  sellPrice: number
  spreadPct: number
  vol24h: number
  time: number
}

// ─── Новости ──────────────────────────────────────────────────────────

export type NewsCategory = 'Макро' | 'Регулирование' | 'ETF' | 'Дефай' | 'Биржи' | 'Безопасность' | 'Технологии' | 'Аирдропы'
export type NewsImpact = 'high' | 'medium' | 'low'

export interface NewsItem {
  id: string
  title: string
  summary: string
  category: NewsCategory
  impact: NewsImpact
  source: string
  time: number
  affects: string[]
}

// ─── Уведомления ──────────────────────────────────────────────────────

export type NotifType = 'density' | 'movement' | 'arbitrage' | 'news' | 'system'
export type NotifSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface AppNotification {
  id: string
  type: NotifType
  severity: NotifSeverity
  title: string
  message: string
  time: number
  windowId?: string
  read: boolean
}

// ─── Fear & Greed ─────────────────────────────────────────────────────

export interface FearGreed {
  value: number
  history: number[]
  source: 'live' | 'demo'
}

export const FG_LABEL = (v: number): string => {
  if (v <= 24) return 'Экстремальный страх'
  if (v <= 44) return 'Страх'
  if (v <= 55) return 'Нейтрально'
  if (v <= 74) return 'Жадность'
  return 'Экстремальная жадность'
}

// ─── Статистика движков ───────────────────────────────────────────────

export interface EngineStats {
  ticks: number
  densities: number
  movements: number
  arbitrages: number
  news: number
  errors: number
  startedAt: number
  wsClients: number
}

export interface ConnectRow {
  id: string
  exchange: ExchangeId
  market: MarketType
  status: 'online' | 'degraded' | 'offline'
  latencyMs: number
  msgsPerSec: number
  booksLive: number
  booksTotal: number
  uptime: number
  lastMsg: number
}

// ─── Утилиты ──────────────────────────────────────────────────────────

let _uid = 0
export function uid(prefix = 'id'): string {
  _uid += 1
  return `${prefix}_${Date.now().toString(36)}_${_uid}`
}

export function fmtUsd(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function fmtPrice(v: number): string {
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (v >= 1) return v.toFixed(2)
  if (v >= 0.01) return v.toFixed(4)
  if (v >= 0.0001) return v.toFixed(6)
  return v.toExponential(2)
}

export function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export function fmtTime(t: number): string {
  const d = new Date(t)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function fmtTimeSec(t: number): string {
  const d = new Date(t)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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

/** Порог подсветки объёма заявки цветом */
export interface VolumeTier {
  /** от этой суммы (USD) применяется цвет */
  minUsd: number
  color: string
}

/** Дефолт: до $5M — обычный цвет текста, от $5M — фиолетовый, от $10M — зелёный */
export const DEFAULT_VOL_TIERS: VolumeTier[] = [
  { minUsd: 5e6, color: '#a78bfa' },
  { minUsd: 10e6, color: '#34d399' },
]

/** Цвет объёма по тирам; undefined — стандартный цвет темы */
export function volumeTierColor(tiers: VolumeTier[] | undefined, volUsd: number): string | undefined {
  if (!tiers || tiers.length === 0) return undefined
  let color: string | undefined
  for (const t of tiers) {
    if (volUsd >= t.minUsd) color = t.color
  }
  return color
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
  /** Пороги подсветки объёма заявки (окно, для F и S сразу) */
  volTiers?: VolumeTier[]
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
  /** Момент появления стены в стакане (возраст = now - createdAt) */
  createdAt: number
  /** Событие живо, пока стена подтверждается сервером (+TTL) */
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
  /** Позиция перетаскиваемого окна (px относительно полотна) */
  x?: number
  y?: number
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

/** Режим арбитража: рынок покупки → рынок продажи */
export type ArbMode = 'FF' | 'FS' | 'SF' | 'SS'

export const ARB_MODES: { id: ArbMode; label: string; buy: MarketType; sell: MarketType; desc: string }[] = [
  { id: 'FF', label: 'F-F', buy: 'F', sell: 'F', desc: 'фьючерсы → фьючерсы' },
  { id: 'FS', label: 'F-S', buy: 'F', sell: 'S', desc: 'покупка фьючерс → продажа спот' },
  { id: 'SF', label: 'S-F', buy: 'S', sell: 'F', desc: 'покупка спот → продажа фьючерс' },
  { id: 'SS', label: 'S-S', buy: 'S', sell: 'S', desc: 'спот → спот' },
]

export function arbModeMeta(m: ArbMode): { buy: MarketType; sell: MarketType; desc: string } {
  return ARB_MODES.find((x) => x.id === m) ?? ARB_MODES[0]
}

/** Нормализация старых режимов 'F'/'S' из localStorage */
export function normalizeArbMode(m: unknown): ArbMode {
  if (m === 'FS' || m === 'SF' || m === 'SS') return m
  if (m === 'S') return 'SS'
  return 'FF'
}

export interface ArbitrageConfig {
  minSpreadPct: number
  minVol24h: number
  mode: ArbMode
  cooldownSec: number
  exchanges: Record<ExchangeId, boolean>
}

export interface ArbOpportunity {
  id: string
  symbol: string
  buyMarket: MarketType
  sellMarket: MarketType
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
  /** Перевод на русский (LLM, появляется асинхронно) */
  titleRu?: string
  summaryRu?: string
  category: NewsCategory
  impact: NewsImpact
  source: string
  time: number
  affects: string[]
  link?: string
}

// ─── Уведомления ──────────────────────────────────────────────────────

export type NotifType = 'density' | 'movement' | 'arbitrage' | 'news' | 'listing' | 'system'
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
  /** Структурированные данные для плотных карточек (плотности/движения/арбитраж) */
  ticker?: string
  /** Дистанция до цены, % (плотности) */
  distPct?: number
  /** Размер заявки, USD (плотности) */
  volumeUsd?: number
  direction?: 'LONG' | 'SHORT'
  changePct?: number
  spreadPct?: number
  exchange?: ExchangeId
  market?: MarketType
  /** Оборот тикера за 24ч */
  vol24h?: number
}

// ─── Fear & Greed ─────────────────────────────────────────────────────

// ─── Листинг / Делистинг ─────────────────────────────────────────────

export interface ListingEvent {
  id: string
  kind: 'listing' | 'delisting'
  exchange: 'BINANCE' | 'BYBIT' | 'OKX'
  market: 'F' | 'S'
  symbols: string[]
  title: string
  url: string
  time: number
  source: 'announce' | 'live'
}

export interface FearGreed {
  value: number
  history: number[]
  source: 'live' | 'demo'
  yesterday?: number
  lastWeek?: number
  lastMonth?: number
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


// ─── Реальные данные market-сервиса ─────────────────────────────────

/** Строка спреда межбиржевого арбитража */
export interface SpreadRow {
  symbol: string
  buyEx: ExchangeId
  buyPrice: number
  sellEx: ExchangeId
  sellPrice: number
  spreadPct: number
  vol24h: number
}

/** Телеметрия market-сервиса (монитор) */
export interface ServiceSysStats {
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
  sys: ServiceSysStats
}

/** Строка символа для комбобокса */
export interface SymbolRow {
  symbol: string
  price: number
  vol24h: number
  change24hPct: number
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

/** Возраст в компактном виде: 45с / 4:12 / 1:04:05 */
export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}с`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`
  const h = Math.floor(m / 60)
  return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
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

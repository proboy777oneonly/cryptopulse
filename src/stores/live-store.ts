import { create } from 'zustand'
import type {
  AppNotification, ArbOpportunity, ConnectRow, DensityEvent, EngineStats,
  FearGreed, ListingEvent, MovementAlert, NewsItem, ServiceStats, TickerSnapshot,
} from '@/engines/types'

export type DataMode = 'connecting' | 'live' | 'reconnecting'

export interface LiveState {
  tick: number
  sessionStart: number
  running: boolean
  dataMode: DataMode
  tickers: Record<string, TickerSnapshot>
  topMovers: { gainers: TickerSnapshot[]; losers: TickerSnapshot[] }
  densityEvents: Record<string, DensityEvent[]>
  movementAlerts: Record<string, MovementAlert[]>
  arbitrageOpps: ArbOpportunity[]
  news: NewsItem[]
  listings: ListingEvent[]
  fearGreed: FearGreed
  notifications: AppNotification[]
  unread: number
  stats: EngineStats
  serviceStats: ServiceStats | null
  connects: ConnectRow[]
  notifSessionCount: number
}

export const useLive = create<LiveState>(() => ({
  tick: 0,
  sessionStart: Date.now(),
  running: false,
  dataMode: 'connecting',
  tickers: {},
  topMovers: { gainers: [], losers: [] },
  densityEvents: {},
  movementAlerts: {},
  arbitrageOpps: [],
  news: [],
  listings: [],
  fearGreed: { value: 54, history: [], source: 'demo' },
  notifications: [],
  unread: 0,
  stats: { ticks: 0, densities: 0, movements: 0, arbitrages: 0, news: 0, errors: 0, startedAt: Date.now(), wsClients: 0 },
  serviceStats: null,
  connects: [],
  notifSessionCount: 0,
}))

export function resetLive() {
  useLive.setState({
    tick: 0, sessionStart: Date.now(), running: false, dataMode: 'connecting', tickers: {},
    topMovers: { gainers: [], losers: [] },
    densityEvents: {}, movementAlerts: {}, arbitrageOpps: [], news: [],
    listings: [],
    fearGreed: { value: 54, history: [], source: 'demo' },
    notifications: [], unread: 0, notifSessionCount: 0,
    stats: { ticks: 0, densities: 0, movements: 0, arbitrages: 0, news: 0, errors: 0, startedAt: Date.now(), wsClients: 0 },
    serviceStats: null,
    connects: [],
  })
}

export function markAllRead() {
  const { notifications } = useLive.getState()
  useLive.setState({
    notifications: notifications.map((n) => ({ ...n, read: true })),
    unread: 0,
  })
}

export function markRead(id: string) {
  const { notifications, unread } = useLive.getState()
  const n = notifications.find((x) => x.id === id)
  if (!n || n.read) return
  useLive.setState({
    notifications: notifications.map((x) => (x.id === id ? { ...x, read: true } : x)),
    unread: Math.max(0, unread - 1),
  })
}

export function clearNotifications() {
  useLive.setState({ notifications: [], unread: 0 })
}

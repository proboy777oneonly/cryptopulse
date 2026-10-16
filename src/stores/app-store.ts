import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ArbitrageConfig, DensityMode, DensityTickerOverride, DensityWindowConfig,
  MovementWindowConfig, NotifType,
} from '@/engines/types'
import { DEFAULT_VOL_TIERS, EXCHANGES, uid } from '@/engines/types'

export type ThemeId = 'midnight' | 'terminal' | 'sunset' | 'crystal'

export interface ThemeMeta {
  id: ThemeId
  name: string
  desc: string
  effect: string
}

export const THEMES: ThemeMeta[] = [
  { id: 'midnight', name: 'Полночь', desc: 'Глубокая тёмная тема с звёздным небом и неоновым свечением карточек', effect: 'Частицы звёзд' },
  { id: 'terminal', name: 'Неон-терминал', desc: 'Хакерская атмосфера: сканлайны ЭЛТ, зелёный неон, моношрифт', effect: 'Сканлайны' },
  { id: 'sunset', name: 'Кибер-закат', desc: 'Плавная аврора из розово-оранжевых градиентов на тёмном фоне', effect: 'Аврора-градиент' },
  { id: 'crystal', name: 'Кристалл', desc: 'Светлая стеклянная тема с мягкими пастельными акцентами', effect: 'Стеклянные блобы' },
]

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  status: string
  avatarColor: string
  avatarEmoji: string
  createdAt: string
  lastLoginAt: string | null
}

export interface TypeNotifPrefs {
  toast: boolean
  sound: boolean
  voice: boolean
}

export interface EffectsPrefs {
  particles: boolean
  scanlines: boolean
  glow: boolean
  animations: boolean
  compact: boolean
}

export type ViewId = 'home' | 'densities' | 'arbitrage' | 'movements' | 'news' | 'listings' | 'notifications' | 'monitor' | 'users' | 'settings'

export interface AppState {
  user: SessionUser | null
  view: ViewId
  theme: ThemeId
  effects: EffectsPrefs
  volume: number
  soundByType: Record<NotifType, string>
  typePrefs: Record<NotifType, TypeNotifPrefs>
  voice: { voiceURI: string; rate: number; pitch: number; volume: number }
  toasts: { position: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'; duration: number }
  densityWindows: DensityWindowConfig[]
  movementWindows: MovementWindowConfig[]
  arbitrage: ArbitrageConfig
  syncState: 'idle' | 'saving' | 'saved' | 'error'
  lastSyncedAt: number | null

  setUser: (u: SessionUser | null) => void
  setView: (v: ViewId) => void
  setTheme: (t: ThemeId) => void
  setEffects: (p: Partial<EffectsPrefs>) => void
  setVolume: (v: number) => void
  setSoundForType: (t: NotifType, s: string) => void
  setTypePrefs: (t: NotifType, p: Partial<TypeNotifPrefs>) => void
  setVoice: (p: Partial<AppState['voice']>) => void
  setToasts: (p: Partial<AppState['toasts']>) => void
  setSyncState: (s: AppState['syncState'], at?: number) => void

  addDensityWindow: (exchange: string) => void
  removeDensityWindow: (id: string) => void
  updateDensityWindow: (id: string, patch: Partial<DensityWindowConfig>) => void
  setDensityMode: (id: string, mode: DensityMode) => void
  updateDensityMarket: (id: string, market: 'f' | 's', patch: Partial<DensityWindowConfig['f']>) => void
  addTickerOverride: (winId: string, sym: string) => void
  updateTickerOverride: (winId: string, sym: string, patch: Partial<DensityTickerOverride>) => void
  removeTickerOverride: (winId: string, sym: string) => void
  toggleBlacklist: (winId: string, market: 'F' | 'S', sym: string) => void
  sendTicker: (fromWinId: string, sym: string, targets: string[]) => void
  sendAllTickers: (fromWinId: string) => void

  addMovementWindow: () => void
  removeMovementWindow: (id: string) => void
  updateMovementWindow: (id: string, patch: Partial<MovementWindowConfig>) => void

  updateArbitrage: (patch: Partial<ArbitrageConfig>) => void
  hydrate: (data: Record<string, unknown>) => void
  resetAll: () => void
}

export function defaultDensityWindows(): DensityWindowConfig[] {
  return EXCHANGES.map((e) => ({
    id: `den-${e.id.toLowerCase()}`,
    exchange: e.id,
    mode: 'ALL' as DensityMode,
    enabled: true,
    f: { minVolume24h: 10e6, minOrderUsd: 1e6, bidDepthPct: 4, askDepthPct: 4, lifetimeSec: 30, soundId: 'ding', volumePct: 60, voice: false },
    s: { minVolume24h: 5e6, minOrderUsd: 500e3, bidDepthPct: 4, askDepthPct: 4, lifetimeSec: 30, soundId: 'ding', volumePct: 60, voice: false },
    tickers: {},
    blacklistF: [],
    blacklistS: [],
    volTiers: DEFAULT_VOL_TIERS.map((t) => ({ ...t })),
  }))
}

/** Старые сохранённые окна могут не иметь volTiers — накатываем дефолт */
function withVolTiers(wins: DensityWindowConfig[]): DensityWindowConfig[] {
  return wins.map((w) => ({
    ...w,
    volTiers: Array.isArray(w.volTiers) && w.volTiers.length > 0 ? w.volTiers : DEFAULT_VOL_TIERS.map((t) => ({ ...t })),
  }))
}

function defaultMovementWindow(): MovementWindowConfig {
  return {
    id: uid('mov'),
    name: 'Окно 1',
    enabled: true,
    period: '1m',
    direction: 'both',
    thresholdPct: 3,
    minVol24h: 100e6,
    cooldownSec: 60,
    markets: { BINANCE_F: true, BINANCE_S: false, BYBIT_F: true, BYBIT_S: false, OKX_F: true, OKX_S: false },
    coinRules: [],
  }
}

function defaultArbitrage(): ArbitrageConfig {
  return {
    minSpreadPct: 0.6,
    minVol24h: 10e6,
    mode: 'F',
    cooldownSec: 120,
    exchanges: Object.fromEntries(EXCHANGES.map((e) => [e.id, true])) as Record<string, boolean> as ArbitrageConfig['exchanges'],
  }
}

export function defaultState() {
  return {
    view: 'home' as ViewId,
    theme: 'midnight' as ThemeId,
    effects: { particles: true, scanlines: true, glow: true, animations: true, compact: false },
    volume: 60,
    soundByType: { density: 'ding', movement: 'alert', arbitrage: 'blip', news: 'chord', listing: 'bell', system: 'power' },
    typePrefs: {
      density: { toast: true, sound: true, voice: false },
      movement: { toast: true, sound: true, voice: true },
      arbitrage: { toast: true, sound: false, voice: false },
      news: { toast: true, sound: false, voice: false },
      listing: { toast: true, sound: true, voice: false },
      system: { toast: true, sound: true, voice: false },
    },
    voice: { voiceURI: '', rate: 1.05, pitch: 1, volume: 0.9 },
    toasts: { position: 'top-right' as const, duration: 5 },
    densityWindows: defaultDensityWindows(),
    movementWindows: [defaultMovementWindow()],
    arbitrage: defaultArbitrage(),
  }
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...defaultState(),
      user: null,
      syncState: 'idle',
      lastSyncedAt: null,

      setUser: (u) => set({ user: u }),
      setView: (v) => set({ view: v }),
      setTheme: (t) => set({ theme: t }),
      setEffects: (p) => set({ effects: { ...get().effects, ...p } }),
      setVolume: (v) => set({ volume: v }),
      setSoundForType: (t, s) => set({ soundByType: { ...get().soundByType, [t]: s } }),
      setTypePrefs: (t, p) => set({ typePrefs: { ...get().typePrefs, [t]: { ...get().typePrefs[t], ...p } } }),
      setVoice: (p) => set({ voice: { ...get().voice, ...p } }),
      setToasts: (p) => set({ toasts: { ...get().toasts, ...p } }),
      setSyncState: (s, at) => set({ syncState: s, ...(at !== undefined ? { lastSyncedAt: at } : {}) }),

      addDensityWindow: (exchange) => {
        const wins = get().densityWindows
        if (wins.length >= 8 || wins.some((w) => w.exchange === exchange)) return
        set({
          densityWindows: [
            ...wins,
            {
              id: uid('den'),
              exchange: exchange as DensityWindowConfig['exchange'],
              mode: 'ALL', enabled: true,
              f: { minVolume24h: 10e6, minOrderUsd: 1e6, bidDepthPct: 4, askDepthPct: 4, lifetimeSec: 30, soundId: 'ding', volumePct: 60, voice: false },
              s: { minVolume24h: 5e6, minOrderUsd: 500e3, bidDepthPct: 4, askDepthPct: 4, lifetimeSec: 30, soundId: 'ding', volumePct: 60, voice: false },
              tickers: {}, blacklistF: [], blacklistS: [],
              volTiers: DEFAULT_VOL_TIERS.map((t) => ({ ...t })),
            },
          ],
        })
      },

      removeDensityWindow: (id) => set({ densityWindows: get().densityWindows.filter((w) => w.id !== id) }),

      updateDensityWindow: (id, patch) =>
        set({ densityWindows: get().densityWindows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }),

      setDensityMode: (id, mode) =>
        set({ densityWindows: get().densityWindows.map((w) => (w.id === id ? { ...w, mode } : w)) }),

      updateDensityMarket: (id, market, patch) =>
        set({
          densityWindows: get().densityWindows.map((w) => (w.id === id ? { ...w, [market]: { ...w[market], ...patch } } : w)),
        }),

      addTickerOverride: (winId, sym) => {
        set({
          densityWindows: get().densityWindows.map((w) =>
            w.id === winId && !w.tickers[sym] ? { ...w, tickers: { ...w.tickers, [sym]: { enabled: true } } } : w,
          ),
        })
      },

      updateTickerOverride: (winId, sym, patch) =>
        set({
          densityWindows: get().densityWindows.map((w) =>
            w.id === winId && w.tickers[sym] ? { ...w, tickers: { ...w.tickers, [sym]: { ...w.tickers[sym], ...patch } } } : w,
          ),
        }),

      removeTickerOverride: (winId, sym) =>
        set({
          densityWindows: get().densityWindows.map((w) => {
            if (w.id !== winId) return w
            const next = { ...w.tickers }
            delete next[sym]
            return { ...w, tickers: next }
          }),
        }),

      toggleBlacklist: (winId, market, sym) =>
        set({
          densityWindows: get().densityWindows.map((w) => {
            if (w.id !== winId) return w
            const key = market === 'F' ? 'blacklistF' : 'blacklistS'
            const list = w[key]
            const next = list.includes(sym) ? list.filter((s) => s !== sym) : [...list, sym]
            return { ...w, [key]: next }
          }),
        }),

      sendTicker: (fromWinId, sym, targets) =>
        set({
          densityWindows: get().densityWindows.map((w) => {
            if (!targets.includes(w.id) || w.id === fromWinId) return w
            const src = get().densityWindows.find((x) => x.id === fromWinId)
            const ovr = src?.tickers[sym]
            if (w.blacklistF.includes(sym) || w.blacklistS.includes(sym)) return w
            return { ...w, tickers: { ...w.tickers, [sym]: ovr ? { ...ovr } : { enabled: true } } }
          }),
        }),

      sendAllTickers: (fromWinId) =>
        set({
          densityWindows: get().densityWindows.map((w) => {
            if (w.id === fromWinId) return w
            const src = get().densityWindows.find((x) => x.id === fromWinId)
            if (!src) return w
            const tickers = { ...w.tickers }
            for (const [sym, ovr] of Object.entries(src.tickers)) {
              if (!w.blacklistF.includes(sym) && !w.blacklistS.includes(sym)) tickers[sym] = { ...ovr }
            }
            return { ...w, tickers }
          }),
        }),

      addMovementWindow: () => {
        const wins = get().movementWindows
        if (wins.length >= 6) return
        set({
          movementWindows: [
            ...wins,
            { ...defaultMovementWindow(), name: `Окно ${wins.length + 1}`, id: uid('mov') },
          ],
        })
      },

      removeMovementWindow: (id) => set({ movementWindows: get().movementWindows.filter((w) => w.id !== id) }),

      updateMovementWindow: (id, patch) =>
        set({ movementWindows: get().movementWindows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }),

      updateArbitrage: (patch) => set({ arbitrage: { ...get().arbitrage, ...patch } }),

      hydrate: (data) => {
        const d = defaultState()
        set({
          ...(data as Partial<AppState>),
          view: d.view,
          user: get().user,
          syncState: get().syncState,
          lastSyncedAt: get().lastSyncedAt,
          // merge дефолтов с сохранённым — новые ключи (напр. listing) появляются у старых пользователей
          soundByType: { ...d.soundByType, ...(data.soundByType as AppState['soundByType'] ?? {}) },
          typePrefs: { ...d.typePrefs, ...(data.typePrefs as AppState['typePrefs'] ?? {}) },
          densityWindows: Array.isArray(data.densityWindows) && data.densityWindows.length > 0
            ? withVolTiers(data.densityWindows as DensityWindowConfig[])
            : d.densityWindows,
          movementWindows: Array.isArray(data.movementWindows) && data.movementWindows.length > 0 ? (data.movementWindows as MovementWindowConfig[]) : d.movementWindows,
          arbitrage: data.arbitrage ? { ...d.arbitrage, ...(data.arbitrage as ArbitrageConfig) } : d.arbitrage,
        })
      },

      resetAll: () => set({ ...defaultState() }),
    }),
    {
      name: 'cp-app-v1',
      partialize: (s) => {
        const { user, syncState, lastSyncedAt, ...rest } = s
        void user; void syncState; void lastSyncedAt
        return { ...rest, view: 'home' } as unknown as AppState
      },
      // deep-merge дефолтов уведомлений — чтобы новые типы (напр. listing)
      // появлялись у пользователей со старым localStorage
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          ...p,
          soundByType: { ...current.soundByType, ...(p.soundByType ?? {}) },
          typePrefs: { ...current.typePrefs, ...(p.typePrefs ?? {}) },
          densityWindows: Array.isArray(p.densityWindows) && p.densityWindows.length > 0
            ? withVolTiers(p.densityWindows)
            : current.densityWindows,
        }
      },
    },
  ),
)

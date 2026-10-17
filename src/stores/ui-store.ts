import { create } from 'zustand'

/**
 * Общее UI-состояние для контролов, живущих в шапке приложения.
 * Вкладки и HeaderActions читают/пишут эти поля, чтобы фильтры
 * работали из любого места.
 */
interface UiState {
  /** Новости */
  newsQuery: string
  newsOnlyHigh: boolean
  newsLang: 'ru' | 'en'
  /** Листинги */
  listingsQuery: string
  /** Уведомления */
  notifQuery: string
  notifOnlyUnread: boolean
  /** Арбитраж */
  arbQuery: string

  setNewsQuery: (v: string) => void
  setNewsOnlyHigh: (v: boolean) => void
  setNewsLang: (v: 'ru' | 'en') => void
  setListingsQuery: (v: string) => void
  setNotifQuery: (v: string) => void
  setNotifOnlyUnread: (v: boolean) => void
  setArbQuery: (v: string) => void
}

export const useUi = create<UiState>()((set) => ({
  newsQuery: '',
  newsOnlyHigh: false,
  newsLang: 'ru',
  listingsQuery: '',
  notifQuery: '',
  notifOnlyUnread: false,
  arbQuery: '',

  setNewsQuery: (v) => set({ newsQuery: v }),
  setNewsOnlyHigh: (v) => set({ newsOnlyHigh: v }),
  setNewsLang: (v) => set({ newsLang: v }),
  setListingsQuery: (v) => set({ listingsQuery: v }),
  setNotifQuery: (v) => set({ notifQuery: v }),
  setNotifOnlyUnread: (v) => set({ notifOnlyUnread: v }),
  setArbQuery: (v) => set({ arbQuery: v }),
}))

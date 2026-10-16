'use client'

import { useApp, type ViewId } from '@/stores/app-store'
import { HomeView } from './home'
import { DensitiesView } from './densities'
import { ArbitrageView } from './arbitrage'
import { MovementsView } from './movements'
import { NewsView, NotificationsView } from './news'
import { MonitorView, UsersView } from './monitor'
import { SettingsView } from './settings'

export function ViewsRouter() {
  const view = useApp((s) => s.view)
  const role = useApp((s) => s.user?.role)

  switch (view) {
    case 'densities':
      return <DensitiesView />
    case 'arbitrage':
      return <ArbitrageView />
    case 'movements':
      return <MovementsView />
    case 'news':
      return <NewsView />
    case 'notifications':
      return <NotificationsView />
    case 'monitor':
      return role === 'ADMIN' ? <MonitorView /> : <HomeView />
    case 'users':
      return role === 'ADMIN' ? <UsersView /> : <HomeView />
    case 'settings':
      return <SettingsView />
    default:
      return <HomeView />
  }
}

export type { ViewId }

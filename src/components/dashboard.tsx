'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChartCandlestick, Gauge, Home, Layers, Menu, MonitorSmartphone, Newspaper, Radar,
  Settings as SettingsIcon, Users2, Bell,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useApp, type ViewId } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { DashboardHeader, UserAvatar } from '@/components/header'
import { cn } from '@/lib/utils'
import { setHash } from '@/lib/nav'
import type { ReactElement } from 'react'

interface NavItem {
  id: ViewId
  label: string
  icon: ReactNode
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { id: 'home', label: 'Главная', icon: <Home className="h-[18px] w-[18px]" /> },
  { id: 'densities', label: 'Плотности', icon: <Layers className="h-[18px] w-[18px]" /> },
  { id: 'arbitrage', label: 'Арбитраж', icon: <Gauge className="h-[18px] w-[18px]" /> },
  { id: 'movements', label: 'Движения', icon: <ChartCandlestick className="h-[18px] w-[18px]" /> },
  { id: 'news', label: 'Новости', icon: <Newspaper className="h-[18px] w-[18px]" /> },
  { id: 'notifications', label: 'Уведомления', icon: <Bell className="h-[18px] w-[18px]" /> },
  { id: 'monitor', label: 'Монитор', icon: <MonitorSmartphone className="h-[18px] w-[18px]" />, adminOnly: true },
  { id: 'users', label: 'Пользователи', icon: <Users2 className="h-[18px] w-[18px]" />, adminOnly: true },
  { id: 'settings', label: 'Настройки', icon: <SettingsIcon className="h-[18px] w-[18px]" /> },
]

const VIEW_META: Record<ViewId, { title: string; subtitle: string }> = {
  home: { title: 'Главная', subtitle: 'Обзор рынка: топы, страх и жадность, последние сигналы' },
  densities: { title: 'Плотности', subtitle: 'Крупные лимитные заявки · одно окно = одна биржа' },
  arbitrage: { title: 'Арбитраж', subtitle: 'Межбиржевые спреды в реальном времени' },
  movements: { title: 'Движения', subtitle: 'Binance · Bybit · OKX · фьючерсы и спот' },
  news: { title: 'Новости', subtitle: 'События, влияющие на крипторынок' },
  notifications: { title: 'Уведомления', subtitle: 'Полный журнал сигналов сессии' },
  monitor: { title: 'Монитор', subtitle: 'Телеметрия сервера, движков и коннектов' },
  users: { title: 'Пользователи', subtitle: 'Управление аккаунтами и ролями' },
  settings: { title: 'Настройки', subtitle: 'Профиль, оформление, звуки и данные' },
}

export function Dashboard({ children }: { children: ReactElement }) {
  const user = useApp((s) => s.user)
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const unread = useLive((s) => s.unread)
  const running = useLive((s) => s.running)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Синхронизация вида с hash
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      if (NAV.some((n) => n.id === h)) setView(h as ViewId)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [setView])

  const go = (v: ViewId) => {
    setView(v)
    setHash(`#/${v}`)
    setMobileOpen(false)
  }

  const items = NAV.filter((n) => !n.adminOnly || user?.role === 'ADMIN')
  const meta = VIEW_META[view] ?? VIEW_META.home

  const navList = (onNav: (v: ViewId) => void) => (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Основная навигация">
      {items.map((n) => {
        const active = view === n.id
        return (
          <button
            key={n.id}
            onClick={() => onNav(n.id)}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border"
                style={{
                  background: 'color-mix(in srgb, var(--acc) 12%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--acc) 35%, transparent)',
                  boxShadow: '0 0 20px -8px var(--glow)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative transition-transform group-hover:scale-110" style={active ? { color: 'var(--acc)' } : undefined}>
              {n.icon}
            </span>
            <span className="relative flex-1 text-left">{n.label}</span>
            {n.id === 'notifications' && unread > 0 && (
              <span className="cp-num relative rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
            {n.adminOnly && (
              <span className="relative rounded-md border border-[color-mix(in_srgb,#f59e0b_40%,transparent)] bg-[color-mix(in_srgb,#f59e0b_10%,transparent)] px-1.5 py-0.5 text-[8px] font-black tracking-wider" style={{ color: '#f59e0b' }}>
                ADMIN
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )

  const sidebarFooter = (
    <div className="border-t border-[var(--border)] p-3">
      <div className="flex items-center gap-2 rounded-xl bg-[var(--muted)] px-3 py-2.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', running && 'cp-pulse-dot')} style={{ background: running ? 'var(--pos)' : 'var(--muted-foreground)' }} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-bold">{running ? 'Движки активны' : 'Остановка…'}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">8 бирж · F+S · DEMO</div>
        </div>
        <span className="cp-num text-[10px] font-bold text-[var(--muted-foreground)]">v2.4.1</span>
      </div>
    </div>
  )

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* ─── Десктопный сайдбар ─── */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] backdrop-blur-xl lg:flex" aria-label="Боковая панель">
        <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
          <div className="cp-glow-sm flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
            <Radar className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-black tracking-tight">CryptoPulse</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">screener pro</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">{navList(go)}</div>
        {sidebarFooter}
      </aside>

      {/* ─── Основная область ─── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Верхний скользящий бар при переключении вкладок */}
        <div key={view} className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden" aria-hidden>
          <div
            className="h-full w-1/4 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--acc), var(--acc-2), transparent)',
              boxShadow: '0 0 16px var(--glow)',
              animation: 'cp-slide-bar 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          />
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]" aria-label="Открыть меню">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[260px] border-[var(--border)] bg-[var(--card-solid)] p-0">
              <SheetTitle className="sr-only">Навигация</SheetTitle>
              <div className="flex h-16 items-center gap-2.5 border-b border-[var(--border)] px-5">
                <div className="cp-glow-sm flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
                  <Radar className="h-5 w-5 text-white" />
                </div>
                <div className="text-[15px] font-black">CryptoPulse</div>
              </div>
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <div className="flex-1 overflow-y-auto py-4">{navList(go)}</div>
                {sidebarFooter}
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            {user && <UserAvatar emoji={user.avatarEmoji} color={user.avatarColor} size={28} />}
            <span className="text-sm font-bold">CryptoPulse</span>
          </div>
        </div>

        <DashboardHeader title={meta.title} subtitle={meta.subtitle} />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="p-4 sm:p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, CheckCheck, ChevronDown, Clock, LogOut, Mail, Radar, Settings as SettingsIcon, ShieldCheck, Trash2, UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/stores/app-store'
import { clearNotifications, markAllRead, resetLive, useLive } from '@/stores/live-store'
import { toastSuccess } from '@/engines/notifier'
import { useUptime } from '@/components/ui-bits'
import { cn } from '@/lib/utils'
import type { NotifType } from '@/engines/types'

export const AVATAR_COLORS: Record<string, string> = {
  violet: '#8b5cf6', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
  cyan: '#06b6d4', fuchsia: '#d946ef', teal: '#14b8a6', orange: '#f97316',
}

const NOTIF_META: Record<NotifType, { label: string; color: string }> = {
  density: { label: 'Плотность', color: '#f59e0b' },
  movement: { label: 'Движение', color: '#10b981' },
  arbitrage: { label: 'Арбитраж', color: '#22d3ee' },
  news: { label: 'Новость', color: '#f472b6' },
  system: { label: 'Система', color: '#8b5cf6' },
}

export function UserAvatar({ emoji, color, size = 36 }: { emoji: string; color: string; size?: number }) {
  const bg = AVATAR_COLORS[color] ?? '#8b5cf6'
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-bold"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${bg}, ${bg}99)`, boxShadow: `0 4px 18px -6px ${bg}`, fontSize: size * 0.45 }}
      aria-label="Аватар пользователя"
    >
      {emoji}
    </div>
  )
}

// ─── Колокол уведомлений ──────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const notifications = useLive((s) => s.notifications)
  const unread = useLive((s) => s.unread)
  const setView = useApp((s) => s.setView)
  const recent = notifications.slice(0, 8)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)] transition-all hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)] hover:shadow-[0_0_16px_-4px_var(--glow)]"
          aria-label={`Уведомления (${unread} непрочитанных)`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="cp-num absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', boxShadow: '0 0 12px -2px var(--glow)' }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] rounded-2xl border-[var(--border)] bg-[var(--popover)] p-0" style={{ boxShadow: '0 24px 60px -20px var(--glow)' }}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Bell className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Уведомления
            {unread > 0 && <span className="cp-num rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: 'var(--acc)' }}>{unread}</span>}
          </div>
          <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
            <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
          </button>
        </div>
        <div className="max-h-[380px] overflow-y-auto p-2">
          {recent.length === 0 && (
            <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
              Пока пусто — сигналы появятся здесь
            </div>
          )}
          {recent.map((n) => {
            const meta = NOTIF_META[n.type]
            return (
              <button
                key={n.id}
                onClick={() => setView('notifications')}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--muted)]',
                  !n.read && 'bg-[color-mix(in_srgb,var(--acc)_7%,transparent)]',
                )}
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{n.title}</span>
                    <span className="cp-num shrink-0 text-[10px] text-[var(--muted-foreground)]">
                      {new Date(n.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">{n.message}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5">
          <button
            onClick={() => { if (recent.length > 0) { clearNotifications(); toastSuccess('Журнал очищен') } }}
            className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive)]"
          >
            <Trash2 className="h-3.5 w-3.5" /> Очистить
          </button>
          <button onClick={() => { setOpen(false); setView('notifications') }} className="text-xs font-semibold" style={{ color: 'var(--acc)' }}>
            Открыть журнал →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Карточка профиля + меню пользователя ─────────────────────────────

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const user = useApp((s) => s.user)
  const setView = useApp((s) => s.setView)
  const setUser = useApp((s) => s.setUser)
  const notifCount = useLive((s) => s.notifSessionCount)
  const uptime = useUptime()
  if (!user) return null

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    resetLive()
    setUser(null)
    setView('home')
    toastSuccess('Вы вышли из аккаунта', 'Настройки сохранены на сервере')
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] py-1.5 pl-1.5 pr-2.5 transition-all hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)] hover:shadow-[0_0_16px_-4px_var(--glow)]" aria-label="Меню пользователя">
            <UserAvatar emoji={user.avatarEmoji} color={user.avatarColor} size={30} />
            <span className="hidden max-w-[120px] truncate text-sm font-semibold sm:block">{user.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 rounded-2xl border-[var(--border)] bg-[var(--popover)] p-2" style={{ boxShadow: '0 24px 60px -20px var(--glow)' }}>
          <button onClick={() => { setProfileOpen(true); setOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--muted)]">
            <UserAvatar emoji={user.avatarEmoji} color={user.avatarColor} size={42} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-bold">{user.name}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">{user.email}</span>
            </span>
          </button>
          <div className="my-1.5 h-px bg-[var(--border)]" />
          <button onClick={() => { setProfileOpen(true); setOpen(false) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[var(--muted)]">
            <UserRound className="h-4 w-4 text-[var(--muted-foreground)]" /> Карточка профиля
          </button>
          <button onClick={() => { setView('settings'); setOpen(false) }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[var(--muted)]">
            <SettingsIcon className="h-4 w-4 text-[var(--muted-foreground)]" /> Настройки
          </button>
          <div className="my-1.5 h-px bg-[var(--border)]" />
          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)]">
            <LogOut className="h-4 w-4" /> Выйти
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-[var(--border)] bg-[var(--card-solid)] p-0" style={{ boxShadow: '0 40px 100px -30px var(--glow)' }}>
          <div className="relative px-6 pb-6 pt-8 text-center" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--acc) 16%, transparent), transparent 70%)' }}>
            <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc)' }} />
            <div className="relative mx-auto w-fit">
              <UserAvatar emoji={user.avatarEmoji} color={user.avatarColor} size={84} />
              <span
                className="absolute -bottom-1.5 -right-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                style={{ background: user.role === 'ADMIN' ? 'linear-gradient(135deg, #f59e0b, #f97316)' : 'var(--pos)' }}
              >
                {user.role === 'ADMIN' ? 'админ' : 'трейдер'}
              </span>
            </div>
            <h3 className="mt-4 text-xl font-black">{user.name}</h3>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)]">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            {[
              { label: 'Сессия', value: uptime, icon: <Clock className="h-3.5 w-3.5" /> },
              { label: 'Сигналов за сессию', value: String(notifCount), icon: <Bell className="h-3.5 w-3.5" /> },
              { label: 'Регистрация', value: new Date(user.createdAt).toLocaleDateString('ru-RU'), icon: <ShieldCheck className="h-3.5 w-3.5" /> },
              { label: 'Последний вход', value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ru-RU') : '—', icon: <Radar className="h-3.5 w-3.5" /> },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{s.icon} {s.label}</div>
                <div className="cp-num mt-1 text-sm font-bold">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => { setProfileOpen(false); setView('settings') }}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Настройки
            </Button>
            <Button variant="outline" className="flex-1 text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)]" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> Выйти
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Шапка ────────────────────────────────────────────────────────────

export function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const uptime = useUptime()
  const running = useLive((s) => s.running)
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_82%,transparent)] px-4 backdrop-blur-xl sm:px-6">
      <div className="min-w-0">
        <motion.h1 key={title} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="truncate text-lg font-bold tracking-tight">
          {title}
        </motion.h1>
        <div className="truncate text-xs text-[var(--muted-foreground)]">{subtitle}</div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2 sm:flex" title="Аптайм сессии движков">
          <span className={cn('h-1.5 w-1.5 rounded-full', running && 'cp-pulse-dot')} style={{ background: running ? 'var(--pos)' : 'var(--muted-foreground)' }} />
          <span className="cp-num text-xs font-bold">{uptime}</span>
        </div>
        <span className="rounded-lg border border-[color-mix(in_srgb,var(--acc)_35%,transparent)] bg-[color-mix(in_srgb,var(--acc)_10%,transparent)] px-2 py-1 text-[10px] font-black tracking-widest" style={{ color: 'var(--acc)' }}>
          DEMO
        </span>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  )
}


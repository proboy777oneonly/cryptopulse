'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, Bell, CheckCheck, Cpu, Gauge, Layers, Newspaper, Search, Trash2, TrendingUp,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { clearNotifications, markAllRead, markRead, useLive } from '@/stores/live-store'
import { fmtTimeSec, type NewsCategory, type NewsImpact, type NotifType } from '@/engines/types'
import { EmptyState } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

// ═══════════════════════════ НОВОСТИ ═══════════════════════════

const CATEGORIES: (NewsCategory | 'Все')[] = ['Все', 'Макро', 'Регулирование', 'ETF', 'Дефай', 'Биржи', 'Безопасность', 'Технологии', 'Аирдропы']

const IMPACT_STYLE: Record<NewsImpact, { label: string; color: string }> = {
  high: { label: 'ВЫСОКАЯ', color: '#f43f5e' },
  medium: { label: 'СРЕДНЯЯ', color: '#f59e0b' },
  low: { label: 'НИЗКАЯ', color: '#64748b' },
}

function timeAgo(t: number): string {
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

export function NewsView() {
  const news = useLive((s) => s.news)
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Все')
  const [query, setQuery] = useState('')
  const [onlyHigh, setOnlyHigh] = useState(false)

  const filtered = useMemo(
    () => news.filter((n) =>
      (cat === 'Все' || n.category === cat)
      && (!onlyHigh || n.impact === 'high')
      && (query === '' || n.title.toLowerCase().includes(query.toLowerCase()) || n.summary.toLowerCase().includes(query.toLowerCase())),
    ),
    [news, cat, query, onlyHigh],
  )

  const highCount = news.filter((n) => n.impact === 'high').length

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="cp-border-glow flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3">
        <Newspaper className="h-4 w-4" style={{ color: 'var(--acc)' }} />
        <span className="text-sm font-bold">Лента новостей</span>
        <span className="cp-num rounded-md border border-[color-mix(in_srgb,#f43f5e_35%,transparent)] bg-[color-mix(in_srgb,#f43f5e_8%,transparent)] px-2 py-0.5 text-[10px] font-black" style={{ color: '#f43f5e' }}>
          {highCount} важных
        </span>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по новостям…" className="h-9 pl-9 text-xs" />
        </div>
        <button
          onClick={() => setOnlyHigh(!onlyHigh)}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all',
            onlyHigh ? 'text-white' : 'text-[var(--muted-foreground)]',
          )}
          style={onlyHigh ? { background: 'linear-gradient(135deg, #f43f5e, #e11d48)', borderColor: 'transparent' } : { borderColor: 'var(--border)', background: 'var(--muted)' }}
          aria-pressed={onlyHigh}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Только важные
        </button>
      </div>

      {/* Категории */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
              cat === c ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
            style={cat === c
              ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', borderColor: 'transparent', boxShadow: '0 0 14px -4px var(--glow)' }
              : { borderColor: 'var(--border)', background: 'var(--muted)' }}
            aria-pressed={cat === c}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="cp-border-glow rounded-2xl bg-card">
          <EmptyState icon={<Newspaper className="h-10 w-10" />} title="Новостей по фильтрам нет" hint="Реальные RSS-ленты обновляются каждые 3 минуты" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {filtered.slice(0, 30).map((n) => {
              const imp = IMPACT_STYLE[n.impact]
              return (
                <motion.article
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="cp-border-glow rounded-2xl bg-card p-4"
                  style={{ borderLeft: `3px solid ${imp.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-[9px] font-black tracking-wider"
                      style={{ background: `${imp.color}1a`, color: imp.color }}
                    >
                      {imp.label}
                    </span>
                    <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">{n.category}</span>
                    <a
                      href={(n as { link?: string }).link ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-[10px] font-semibold transition-opacity hover:opacity-80"
                      style={{ color: 'var(--acc)' }}
                      title="Открыть источник"
                    >
                      {timeAgo(n.time)} · {n.source} ↗
                    </a>
                  </div>
                  <h3 className="mt-2.5 text-sm font-bold leading-snug">{n.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">{n.summary}</p>
                  {n.affects.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--muted-foreground)]">влияет на:</span>
                      {n.affects.map((a) => (
                        <span key={a} className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: 'color-mix(in srgb, var(--acc) 12%, transparent)', color: 'var(--acc)' }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════ УВЕДОМЛЕНИЯ (ЖУРНАЛ) ═══════════════════════════

const NOTIF_META: Record<NotifType, { label: string; color: string; icon: typeof Bell }> = {
  density: { label: 'Плотности', color: '#f59e0b', icon: Layers },
  movement: { label: 'Движения', color: '#10b981', icon: TrendingUp },
  arbitrage: { label: 'Арбитраж', color: '#22d3ee', icon: Gauge },
  news: { label: 'Новости', color: '#f472b6', icon: Newspaper },
  system: { label: 'Система', color: '#8b5cf6', icon: Cpu },
}

export function NotificationsView() {
  const notifications = useLive((s) => s.notifications)
  const unread = useLive((s) => s.unread)
  const [filter, setFilter] = useState<'all' | NotifType>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => notifications.filter((n) =>
      (filter === 'all' || n.type === filter)
      && (query === '' || n.title.toLowerCase().includes(query.toLowerCase()) || n.message.toLowerCase().includes(query.toLowerCase())),
    ),
    [notifications, filter, query],
  )

  const counts = useMemo(() => notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1
    return acc
  }, {}), [notifications])

  return (
    <div className="space-y-4">
      <div className="cp-border-glow flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3">
        <Bell className="h-4 w-4" style={{ color: 'var(--acc)' }} />
        <span className="text-sm font-bold">Журнал уведомлений</span>
        <span className="cp-num rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold" style={{ color: 'var(--acc)' }}>
          {notifications.length} всего · {unread} новых
        </span>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по журналу…" className="h-9 pl-9 text-xs" />
        </div>
        <button
          onClick={markAllRead}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 text-xs font-semibold transition-colors hover:text-[var(--acc)]"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Прочитать все
        </button>
        <button
          onClick={clearNotifications}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--destructive)]"
        >
          <Trash2 className="h-3.5 w-3.5" /> Очистить
        </button>
      </div>

      {/* Фильтры по типу */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter('all')}
          className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', filter === 'all' ? 'text-white' : 'text-[var(--muted-foreground)]')}
          style={filter === 'all' ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', borderColor: 'transparent' } : { borderColor: 'var(--border)', background: 'var(--muted)' }}
        >
          Все ({notifications.length})
        </button>
        {(Object.keys(NOTIF_META) as NotifType[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', filter === t ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}
            style={filter === t
              ? { background: NOTIF_META[t].color, borderColor: 'transparent', boxShadow: `0 0 14px -4px ${NOTIF_META[t].color}` }
              : { borderColor: 'var(--border)', background: 'var(--muted)' }}
            aria-pressed={filter === t}
          >
            {NOTIF_META[t].label} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="cp-border-glow rounded-2xl bg-card">
          <EmptyState icon={<Bell className="h-10 w-10" />} title="Уведомлений нет" hint="Настройте окна плотностей и движений — сигналы появятся здесь" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((n) => {
            const meta = NOTIF_META[n.type]
            const Icon = meta.icon
            return (
              <motion.button
                key={n.id}
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => markRead(n.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:border-[color-mix(in_srgb,var(--acc)_35%,transparent)]',
                  !n.read && 'border-l-[3px]',
                )}
                style={{ borderLeftColor: n.read ? undefined : meta.color }}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${meta.color}16`, color: meta.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate text-sm font-bold">{n.title}</span>
                    <span className="cp-num ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">{fmtTimeSec(n.time)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">{n.message}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wider" style={{ background: `${meta.color}16`, color: meta.color }}>
                      {meta.label.toUpperCase()}
                    </span>
                    {n.severity === 'critical' && <span className="rounded-md bg-[#f43f5e1a] px-1.5 py-0.5 text-[9px] font-black tracking-wider" style={{ color: '#f43f5e' }}>КРИТИЧНО</span>}
                  </span>
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--acc)', boxShadow: '0 0 8px var(--acc)' }} />}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

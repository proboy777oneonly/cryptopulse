'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown, Bell, Cpu, ExternalLink, Layers, ListPlus, Loader2, Newspaper, TrendingUp,
} from 'lucide-react'
import { markRead, useLive } from '@/stores/live-store'
import { useUi } from '@/stores/ui-store'
import { DensityBody, MovementBody } from '@/engines/notifier'
import { type NewsCategory, type NewsImpact, type NotifType } from '@/engines/types'
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
  const { newsQuery, newsOnlyHigh, newsLang } = useUi()
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('Все')

  const titleOf = (n: (typeof news)[number]) => (newsLang === 'ru' ? n.titleRu ?? n.title : n.title)
  const summaryOf = (n: (typeof news)[number]) => (newsLang === 'ru' ? n.summaryRu ?? n.summary : n.summary)

  const filtered = useMemo(
    () => news.filter((n) =>
      (cat === 'Все' || n.category === cat)
      && (!newsOnlyHigh || n.impact === 'high')
      && (newsQuery === '' || n.title.toLowerCase().includes(newsQuery.toLowerCase()) || n.summary.toLowerCase().includes(newsQuery.toLowerCase()) || (n.titleRu ?? '').toLowerCase().includes(newsQuery.toLowerCase())),
    ),
    [news, cat, newsQuery, newsOnlyHigh],
  )

  const highCount = news.filter((n) => n.impact === 'high').length
  const translatedCount = news.filter((n) => n.titleRu).length
  const translating = newsLang === 'ru' && translatedCount < Math.min(news.length, 24) && news.length > 0

  return (
    <div className="space-y-4">
      {/* Категории — поиск/язык/важность живут в шапке приложения */}
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
        {translating && (
          <span className="ml-auto flex items-center gap-1.5 self-center text-[10px] text-[var(--muted-foreground)]">
            <Loader2 className="h-3 w-3 animate-spin" /> переводим свежие заголовки…
          </span>
        )}
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
              const isRu = !!n.titleRu
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-[9px] font-black tracking-wider"
                      style={{ background: `${imp.color}1a`, color: imp.color }}
                    >
                      {imp.label}
                    </span>
                    <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">{n.category}</span>
                    {newsLang === 'ru' && !isRu && (
                      <span className="flex items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> перевод…
                      </span>
                    )}
                    <a
                      href={n.link ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-[10px] font-semibold transition-opacity hover:opacity-80"
                      style={{ color: 'var(--acc)' }}
                    >
                      {timeAgo(n.time)} · {n.source} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <h3 className="mt-2.5 text-[15px] font-bold leading-snug">{titleOf(n)}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted-foreground)]">{summaryOf(n)}</p>
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
  density: { label: 'Плотность', color: '#f59e0b', icon: Layers },
  movement: { label: 'Движение', color: '#10b981', icon: TrendingUp },
  arbitrage: { label: 'Арбитраж', color: '#22d3ee', icon: ArrowUpDown },
  news: { label: 'Новость', color: '#f472b6', icon: Newspaper },
  listing: { label: 'Листинг', color: '#a3e635', icon: ListPlus },
  system: { label: 'Система', color: '#8b5cf6', icon: Cpu },
}

function relTimeShort(t: number): string {
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

function dayLabel(t: number): string {
  const d = new Date(t)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400_000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Сегодня'
  if (same(d, yesterday)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
}

export function NotificationsView() {
  const notifications = useLive((s) => s.notifications)
  const unread = useLive((s) => s.unread)
  const { notifQuery, notifOnlyUnread } = useUi()
  const [filter, setFilter] = useState<'all' | NotifType>('all')

  const filtered = useMemo(
    () => notifications.filter((n) =>
      (filter === 'all' || n.type === filter)
      && (!notifOnlyUnread || !n.read)
      && (notifQuery === '' || n.title.toLowerCase().includes(notifQuery.toLowerCase()) || n.message.toLowerCase().includes(notifQuery.toLowerCase()) || (n.ticker ?? '').toLowerCase().includes(notifQuery.toLowerCase())),
    ),
    [notifications, filter, notifQuery, notifOnlyUnread],
  )

  // группировка по дням
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const n of filtered) {
      const key = dayLabel(n.time)
      const arr = map.get(key) ?? []
      arr.push(n)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [filtered])

  const counts = useMemo(() => notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1
    return acc
  }, {}), [notifications])

  return (
    <div className="space-y-4">
      {/* Фильтры по типу — поиск/кнопки живут в шапке приложения */}
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
            className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all', filter === t ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')}
            style={filter === t
              ? { background: NOTIF_META[t].color, borderColor: 'transparent', boxShadow: `0 0 14px -4px ${NOTIF_META[t].color}` }
              : { borderColor: 'var(--border)', background: 'var(--muted)' }}
            aria-pressed={filter === t}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: NOTIF_META[t].color }} />
            {NOTIF_META[t].label} ({counts[t] ?? 0})
          </button>
        ))}
        {unread > 0 && (
          <span className="cp-num ml-auto flex items-center gap-1.5 self-center rounded-full border border-[color-mix(in_srgb,var(--acc)_35%,transparent)] bg-[color-mix(in_srgb,var(--acc)_8%,transparent)] px-3 py-1 text-[10px] font-black" style={{ color: 'var(--acc)' }}>
            {unread} непрочитанных
          </span>
        )}
      </div>

      {/* Список по дням */}
      {filtered.length === 0 ? (
        <div className="cp-border-glow rounded-2xl bg-card">
          <EmptyState icon={<Bell className="h-10 w-10" />} title="Уведомлений нет" hint="Настройте окна плотностей и движений — сигналы появятся здесь" />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="mb-2 flex items-center gap-3 px-1">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{day}</span>
                <span className="h-px flex-1 bg-[var(--border)]" />
                <span className="cp-num text-[10px] text-[var(--muted-foreground)]">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map((n) => {
                  const meta = NOTIF_META[n.type]
                  const Icon = meta.icon
                  const structured = (n.type === 'density' || n.type === 'movement') && n.ticker
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
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border" style={{ background: `${meta.color}14`, borderColor: `${meta.color}30`, color: meta.color }}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                          {n.severity === 'critical' && <span className="rounded-md bg-[#f43f5e1a] px-1.5 py-0.5 text-[9px] font-black tracking-wider" style={{ color: '#f43f5e' }}>КРИТИЧНО</span>}
                          {n.severity === 'warning' && <span className="rounded-md bg-[#fbbf241a] px-1.5 py-0.5 text-[9px] font-black tracking-wider" style={{ color: '#fbbf24' }}>ВАЖНО</span>}
                          <span className="cp-num ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">{relTimeShort(n.time)}</span>
                        </span>
                        {structured ? (
                          <span className="mt-1 block">
                            {n.type === 'density' ? <DensityBody n={n} large /> : <MovementBody n={n} large />}
                          </span>
                        ) : (
                          <>
                            <span className="mt-0.5 block text-sm font-bold leading-snug">{n.title}</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">{n.message}</span>
                          </>
                        )}
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--acc)', boxShadow: '0 0 8px var(--acc)' }} />}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

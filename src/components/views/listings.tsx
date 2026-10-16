'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarClock, ExternalLink, ListMinus, ListPlus, Radar, Radio, Search, Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useLive } from '@/stores/live-store'
import type { ListingEvent } from '@/engines/types'
import { EmptyState } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

// ═══════════════════════════ ЛИСТИНГ / ДЕЛИСТИНГ ═══════════════════════════

const EX3 = [
  { id: 'BINANCE', name: 'Binance', color: '#F0B90B' },
  { id: 'BYBIT', name: 'Bybit', color: '#F7A600' },
  { id: 'OKX', name: 'OKX', color: '#97FCE4' },
] as const

type Ex3Id = (typeof EX3)[number]['id']
type KindFilter = 'all' | 'listing' | 'delisting'
type MktFilter = 'ALL' | 'F' | 'S'
type SrcFilter = 'all' | 'announce' | 'live'

function timeAgo(t: number): string {
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 0) return 'скоро'
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

function fmtDate(t: number): string {
  return new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active ? 'text-white' : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
      style={active && color
        ? { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`, borderColor: 'transparent', boxShadow: `0 0 14px -4px ${color}` }
        : active
          ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', borderColor: 'transparent', boxShadow: '0 0 14px -4px var(--glow)' }
          : undefined}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

export function ListingsView() {
  const listings = useLive((s) => s.listings)
  const [kind, setKind] = useState<KindFilter>('all')
  const [ex, setEx] = useState<Ex3Id | 'ALL'>('ALL')
  const [mkt, setMkt] = useState<MktFilter>('ALL')
  const [src, setSrc] = useState<SrcFilter>('all')
  const [query, setQuery] = useState('')

  const stats = useMemo(() => {
    const week = Date.now() - 7 * 86400_000
    const recent = listings.filter((l) => l.time >= week)
    return {
      listing: listings.filter((l) => l.kind === 'listing').length,
      delisting: listings.filter((l) => l.kind === 'delisting').length,
      weekNew: recent.length,
      live: listings.filter((l) => l.source === 'live').length,
    }
  }, [listings])

  const filtered = useMemo(() => listings.filter((l) =>
    (kind === 'all' || l.kind === kind)
    && (ex === 'ALL' || l.exchange === ex)
    && (mkt === 'ALL' || l.market === mkt)
    && (src === 'all' || l.source === src)
    && (query === ''
      || l.title.toLowerCase().includes(query.toLowerCase())
      || (l.symbols ?? []).some((s) => s.toLowerCase().includes(query.toLowerCase()))),
  ), [listings, kind, ex, mkt, src, query])

  const toggleEx = (id: Ex3Id) => setEx((prev) => (prev === id ? 'ALL' : id))

  return (
    <div className="space-y-4">
      {/* Тулбар */}
      <div className="cp-border-glow flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black">
          <Radar className="h-4 w-4" style={{ color: 'var(--acc)' }} />
          Листинг / Делистинг
        </div>
        <span className="hidden items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)] sm:flex">
          BINANCE · BYBIT · OKX · F+S
        </span>
        <span className="cp-num hidden items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] md:flex">
          <CalendarClock className="h-3.5 w-3.5" /> за 7 дней: {stats.weekNew} событий
        </span>
        <div className="relative ml-auto w-full sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: SOL, Binance…" className="h-9 pl-9 text-xs" />
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Листинги', value: stats.listing, icon: <ListPlus className="h-4 w-4" />, color: 'var(--pos)' },
          { label: 'Делистинги', value: stats.delisting, icon: <ListMinus className="h-4 w-4" />, color: 'var(--neg)' },
          { label: 'За 7 дней', value: stats.weekNew, icon: <CalendarClock className="h-4 w-4" />, color: 'var(--acc)' },
          { label: 'Замечено в торгах', value: stats.live, icon: <Radio className="h-4 w-4" />, color: '#fbbf24' },
        ].map((s) => (
          <div key={s.label} className="cp-border-glow rounded-2xl bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
              <span style={{ color: s.color }}>{s.icon}</span> {s.label}
            </div>
            <div className="cp-num mt-1 text-xl font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip active={kind === 'all'} onClick={() => setKind('all')}>Все</Chip>
        <Chip active={kind === 'listing'} onClick={() => setKind('listing')} color="#10b981">
          <ListPlus className="h-3.5 w-3.5" /> Листинги ({stats.listing})
        </Chip>
        <Chip active={kind === 'delisting'} onClick={() => setKind('delisting')} color="#f43f5e">
          <ListMinus className="h-3.5 w-3.5" /> Делисты ({stats.delisting})
        </Chip>
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        {EX3.map((e) => (
          <Chip key={e.id} active={ex === e.id} onClick={() => toggleEx(e.id)} color={e.color}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
            {e.name}
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        {(['ALL', 'F', 'S'] as const).map((m) => (
          <Chip key={m} active={mkt === m} onClick={() => setMkt(m)}>
            {m === 'ALL' ? 'Все рынки' : m === 'F' ? 'Фьючерсы' : 'Спот'}
          </Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />
        <Chip active={src === 'all'} onClick={() => setSrc('all')}>
          <span className="hidden sm:inline">Источник:</span> все
        </Chip>
        <Chip active={src === 'announce'} onClick={() => setSrc('announce')}>
          <Sparkles className="h-3 w-3" /> Анонсы
        </Chip>
        <Chip active={src === 'live'} onClick={() => setSrc('live')}>
          <Radio className="h-3 w-3" /> В торгах
        </Chip>
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="cp-border-glow rounded-2xl bg-card">
          <EmptyState
            icon={<Radar className="h-10 w-10" />}
            title="Событий по фильтрам нет"
            hint="Анонсы бирж опрашиваются каждые ~2 минуты · листинги и делисты появятся здесь автоматически"
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {filtered.map((l) => {
              const isDelist = l.kind === 'delisting'
              const color = isDelist ? 'var(--neg)' : 'var(--pos)'
              const exMeta = EX3.find((e) => e.id === l.exchange)
              const exColor = exMeta?.color ?? '#8b5cf6'
              return (
                <motion.article
                  key={l.id}
                  layout
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="cp-border-glow rounded-2xl bg-card p-4"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black tracking-wider"
                      style={{ background: 'color-mix(in srgb, var(--pos) 12%, transparent)', color: 'var(--pos)' }}
                    >
                      <ListPlus className="h-3 w-3" /> ЛИСТИНГ
                    </span>
                    {isDelist && (
                      <span
                        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black tracking-wider"
                        style={{ background: 'color-mix(in srgb, var(--neg) 12%, transparent)', color: 'var(--neg)' }}
                      >
                        <ListMinus className="h-3 w-3" /> ДЕЛИСТИНГ
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-black" style={{ borderColor: `${exColor}55`, background: `${exColor}14`, color: exColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: exColor }} />
                      {l.exchange}
                    </span>
                    <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[9px] font-black text-[var(--muted-foreground)]">
                      {l.market === 'F' ? 'ФЬЮЧЕРС' : 'СПОТ'}
                    </span>
                    {l.source === 'live' && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                        <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: '#fbbf24' }} /> В ТОРГАХ
                      </span>
                    )}
                    <span className="cp-num ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]" title={fmtDate(l.time)}>
                      {timeAgo(l.time)}
                    </span>
                  </div>

                  {/* Символы */}
                  {l.symbols.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.symbols.slice(0, 6).map((s) => (
                        <span
                          key={s}
                          className="cp-num rounded-lg border px-2.5 py-1 text-sm font-black"
                          style={{
                            borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                            background: `color-mix(in srgb, ${color} 8%, transparent)`,
                            color,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                      {l.symbols.length > 6 && (
                        <span className="cp-num self-center text-[11px] text-[var(--muted-foreground)]">+{l.symbols.length - 6}</span>
                      )}
                    </div>
                  )}

                  <a
                    href={l.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-2.5 flex items-start gap-1.5 text-xs leading-snug text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    <span className="line-clamp-2">{l.title}</span>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: 'var(--acc)' }} />
                  </a>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="px-1 text-center text-[10px] text-[var(--muted-foreground)]">
        Источники: официальные анонсы Binance · Bybit · OKX + автоматическое обнаружение новых символов в торговой ленте (F и S)
      </p>
    </div>
  )
}

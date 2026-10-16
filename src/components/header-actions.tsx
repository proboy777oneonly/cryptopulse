'use client'

import { useState } from 'react'
import {
  AlertTriangle, CheckCheck, Languages, Plus, Search, Send, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { useUi } from '@/stores/ui-store'
import { clearNotifications, markAllRead } from '@/stores/live-store'
import { EX_MAP, ARB_MODES, type ExchangeId, normalizeArbMode } from '@/engines/types'
import { toastSuccess } from '@/engines/notifier'
import { cn } from '@/lib/utils'

/**
 * Действия активной вкладки, живущие в шапке приложения:
 * главная кнопка/фильтры всегда доступны сверху, тулбары внутри
 * вкладок не нужны. Каждая вкладка определяет свой набор контролов.
 */

function ChipStat({ children, color, dot }: { children: React.ReactNode; color?: string; dot?: boolean }) {
  return (
    <span className="cp-num flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 text-[11px] font-bold text-[var(--muted-foreground)]">
      {dot && <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: color ?? 'var(--pos)' }} />}
      {children}
    </span>
  )
}

function HeaderSearch({ value, onChange, placeholder, w = 'w-44' }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  w?: string
}) {
  return (
    <div className={cn('relative h-9 shrink-0', w)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-xl bg-[var(--muted)] pl-8 text-xs"
      />
    </div>
  )
}

function ToggleChip({ active, onClick, children, danger, accent }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  accent?: string
}) {
  const bg = active
    ? danger
      ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
      : `linear-gradient(135deg, ${accent ?? 'var(--acc)'}, ${accent ? `${accent}cc` : 'var(--acc-2)'})`
    : undefined
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all',
        active ? 'border-transparent text-white' : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
      style={active ? { background: bg, boxShadow: `0 0 14px -4px ${danger ? '#f43f5e' : 'var(--glow)'}` } : undefined}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function AddWindowButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <Button
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-9 shrink-0 rounded-xl px-4 text-[13px] font-bold"
    >
      <Plus className="mr-1 h-4 w-4" /> {label}
    </Button>
  )
}

// ─── Движения ──────────────────────────────────────────────────────────

function MovementsActions() {
  const movementWindows = useApp((s) => s.movementWindows)
  const addMovementWindow = useApp((s) => s.addMovementWindow)
  return (
    <>
      <AddWindowButton
        label="Новое окно"
        disabled={movementWindows.length >= 6}
        onClick={() => addMovementWindow()}
      />
      <ChipStat>{movementWindows.length}/6 окон</ChipStat>
    </>
  )
}

// ─── Плотности ─────────────────────────────────────────────────────────

function DensitiesActions() {
  const densityWindows = useApp((s) => s.densityWindows)
  const addDensityWindow = useApp((s) => s.addDensityWindow)
  const sendAllTickers = useApp((s) => s.sendAllTickers)
  const densityEvents = useLive((s) => s.densityEvents)
  const dataMode = useLive((s) => s.dataMode)

  const [addOpen, setAddOpen] = useState(false)
  const [addEx, setAddEx] = useState('')

  const unused = Object.values(EX_MAP).filter((e) => !densityWindows.some((w) => w.exchange === e.id))
  const totalActive = Object.values(densityEvents).reduce((acc, list) => acc + list.length, 0)

  return (
    <>
      <ChipStat dot color={dataMode === 'live' ? 'var(--pos)' : '#f59e0b'}>{totalActive} активных</ChipStat>
      <AddWindowButton
        label="Добавить окно"
        disabled={unused.length === 0 || densityWindows.length >= 8}
        onClick={() => { setAddEx(''); setAddOpen(true) }}
      />
      <Button
        variant="outline" size="sm"
        disabled={densityWindows.length < 2}
        onClick={() => {
          densityWindows.forEach((w) => sendAllTickers(w.id))
          toastSuccess('Синхронизация тикеров', 'Все тикеры отправлены во все окна')
        }}
        className="h-9 shrink-0 rounded-xl px-3 text-[11px]"
      >
        <Send className="mr-1 h-3.5 w-3.5" /> Все тикеры → все окна
      </Button>

      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setAddEx('') }}>
        <DialogContent className="max-w-xs rounded-3xl border-[var(--border)] bg-[var(--card-solid)]">
          <DialogHeader><DialogTitle className="text-base">Новое окно плотностей</DialogTitle></DialogHeader>
          <Select value={addEx} onValueChange={setAddEx}>
            <SelectTrigger><SelectValue placeholder="Биржа" /></SelectTrigger>
            <SelectContent>
              {unused.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: e.color }} />{e.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!addEx}
            onClick={() => {
              addDensityWindow(addEx as ExchangeId)
              setAddOpen(false)
              setAddEx('')
              toastSuccess('Окно создано', `${EX_MAP[addEx as ExchangeId].name} подключено`)
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Создать окно
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Новости ───────────────────────────────────────────────────────────

function NewsActions() {
  const news = useLive((s) => s.news)
  const { newsQuery, setNewsQuery, newsOnlyHigh, setNewsOnlyHigh, newsLang, setNewsLang } = useUi()
  const highCount = news.filter((n) => n.impact === 'high').length
  return (
    <>
      <ChipStat color="#f43f5e">{highCount} важных</ChipStat>
      <ToggleChip active={newsLang === 'ru'} onClick={() => setNewsLang(newsLang === 'ru' ? 'en' : 'ru')}>
        <Languages className="h-3.5 w-3.5" /> RU
      </ToggleChip>
      <ToggleChip active={newsOnlyHigh} onClick={() => setNewsOnlyHigh(!newsOnlyHigh)} danger>
        <AlertTriangle className="h-3.5 w-3.5" /> Только важные
      </ToggleChip>
      <div className="hidden md:block"><HeaderSearch value={newsQuery} onChange={setNewsQuery} placeholder="Поиск по новостям…" /></div>
    </>
  )
}

// ─── Листинги ──────────────────────────────────────────────────────────

function ListingsActions() {
  const listings = useLive((s) => s.listings)
  const { listingsQuery, setListingsQuery } = useUi()
  const weekNew = listings.filter((l) => l.time >= Date.now() - 7 * 86400_000).length
  return (
    <>
      <ChipStat>{weekNew} за 7 дней</ChipStat>
      <div className="hidden md:block"><HeaderSearch value={listingsQuery} onChange={setListingsQuery} placeholder="Поиск: SOL, Binance…" /></div>
    </>
  )
}

// ─── Уведомления ───────────────────────────────────────────────────────

function NotificationsActions() {
  const notifications = useLive((s) => s.notifications)
  const unread = useLive((s) => s.unread)
  const { notifQuery, setNotifQuery, notifOnlyUnread, setNotifOnlyUnread } = useUi()
  return (
    <>
      <ChipStat dot color="var(--acc)">{notifications.length} всего · {unread} новых</ChipStat>
      <div className="hidden lg:block"><HeaderSearch value={notifQuery} onChange={setNotifQuery} placeholder="Поиск по журналу…" /></div>
      <ToggleChip active={notifOnlyUnread} onClick={() => setNotifOnlyUnread(!notifOnlyUnread)}>
        <span className={cn('h-2 w-2 rounded-full', unread > 0 && 'animate-pulse')} style={{ background: unread > 0 ? 'var(--acc)' : 'var(--muted-foreground)' }} />
        Непрочитанные
      </ToggleChip>
      <Button
        variant="outline" size="sm"
        onClick={markAllRead}
        className="h-9 shrink-0 rounded-xl px-3 text-[11px]"
      >
        <CheckCheck className="mr-1 h-3.5 w-3.5" /> Прочитать все
      </Button>
      <Button
        variant="outline" size="sm"
        onClick={() => { if (notifications.length > 0) { clearNotifications(); toastSuccess('Журнал очищен') } }}
        className="h-9 shrink-0 rounded-xl px-3 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" /> Очистить
      </Button>
    </>
  )
}

// ─── Арбитраж ──────────────────────────────────────────────────────────

function ArbitrageActions() {
  const opps = useLive((s) => s.arbitrageOpps)
  const arbitrage = useApp((s) => s.arbitrage)
  const updateArbitrage = useApp((s) => s.updateArbitrage)
  const { arbQuery, setArbQuery } = useUi()
  const best = opps.length > 0 ? opps[0] : null
  const mode = normalizeArbMode(arbitrage.mode)
  return (
    <>
      <ChipStat dot>{opps.length} спредов</ChipStat>
      {best && <ChipStat color="var(--pos)">лучший {best.spreadPct.toFixed(2)}%</ChipStat>}
      <div className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-0.5">
        {ARB_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => updateArbitrage({ mode: m.id })}
            className={cn(
              'cp-num flex h-8 items-center justify-center rounded-lg px-2.5 text-[11px] font-black transition-all',
              mode === m.id ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
            style={mode === m.id
              ? { background: m.buy === 'F' || m.sell === 'F' ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#22d3ee,#06b6d4)' }
              : undefined}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="hidden md:block"><HeaderSearch value={arbQuery} onChange={setArbQuery} placeholder="Поиск монеты…" /></div>
    </>
  )
}

// ─── Роутер действий ───────────────────────────────────────────────────

const TOOLBAR_VIEWS = new Set(['movements', 'densities', 'news', 'listings'])

export function ViewHeaderActions() {
  const view = useApp((s) => s.view)
  const role = useApp((s) => s.user?.role)

  let cluster: React.ReactNode = null
  switch (view) {
    case 'movements': cluster = <MovementsActions />; break
    case 'densities': cluster = <DensitiesActions />; break
    case 'news': cluster = <NewsActions />; break
    case 'listings': cluster = <ListingsActions />; break
    case 'notifications': cluster = <NotificationsActions />; break
    case 'arbitrage': cluster = <ArbitrageActions />; break
    default: cluster = null
  }
  if (!cluster) return null

  const isToolbarView = TOOLBAR_VIEWS.has(view) || (view === 'monitor' && role === 'ADMIN')
  return (
    <div className={cn(
      'flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      isToolbarView ? 'w-full' : 'ml-auto',
    )}>
      {cluster}
    </div>
  )
}

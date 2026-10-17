'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Button } from '@/components/ui/button'
import {
  ChartCandlestick, GripHorizontal, Plus, Power, Settings2, Trash2, TrendingUp, X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/stores/app-store'
import { clearMovementAlerts, useLive } from '@/stores/live-store'
import { EX_MAP, fmtPrice, fmtTimeSec, fmtUsd, type MovementAlert, type MovementWindowConfig } from '@/engines/types'
import { toastSuccess } from '@/engines/notifier'
import { TickerCopy } from '@/components/ui-bits'
import { EmptyState } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

const MARKET_KEYS = ['BINANCE_F', 'BINANCE_S', 'BYBIT_F', 'BYBIT_S', 'OKX_F', 'OKX_S'] as const

const WIN_W = 540
const WIN_H_EST = 380
const GAP = 16

/** Позиция по умолчанию — каскадом слева направо */
function defaultPos(i: number, wide: boolean) {
  const perRow = wide ? 2 : 1
  return {
    x: 12 + (i % perRow) * (WIN_W + GAP),
    y: 12 + Math.floor(i / perRow) * (WIN_H_EST + GAP),
  }
}

function MarketToggle({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-all',
        checked ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
      )}
      style={{
        borderColor: checked ? `${color}66` : 'var(--border)',
        background: checked ? `${color}14` : 'var(--muted)',
        boxShadow: checked ? `0 0 14px -6px ${color}` : undefined,
      }}
      aria-pressed={checked}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      {checked && <span className="text-[9px] tracking-wider" style={{ color }}>ON</span>}
    </button>
  )
}

// ─── Диалог настроек окна движений ────────────────────────────────────

function MovementSettingsDialog({ win, open, onOpenChange }: { win: MovementWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const updateMovementWindow = useApp((s) => s.updateMovementWindow)
  const set = (patch: Partial<MovementWindowConfig>) => updateMovementWindow(win.id, patch)
  const [ruleSym, setRuleSym] = useState('')
  const enabledMarkets = MARKET_KEYS.filter((k) => win.markets[k]).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full overflow-y-auto rounded-3xl border-[var(--border)] bg-[var(--card-solid)] sm:max-w-none" style={{ maxHeight: '85vh', width: 'min(92vw, 720px)', boxShadow: '0 40px 90px -30px var(--glow)' }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5 text-base">
            <Settings2 className="h-4 w-4" style={{ color: 'var(--acc)' }} />
            Настройки · {win.name} · {win.period.toUpperCase()} ±{win.thresholdPct}%
            <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
              рынков: {enabledMarkets}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Основные параметры */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Таймфрейм</Label>
              <Select value={win.period} onValueChange={(v) => set({ period: v as MovementWindowConfig['period'] })}>
                <SelectTrigger className="h-11 rounded-xl bg-[var(--card)] text-sm font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 минута</SelectItem>
                  <SelectItem value="5m">5 минут</SelectItem>
                  <SelectItem value="24h">24 часа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Направление</Label>
              <Select value={win.direction} onValueChange={(v) => set({ direction: v as MovementWindowConfig['direction'] })}>
                <SelectTrigger className="h-11 rounded-xl bg-[var(--card)] text-sm font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Оба</SelectItem>
                  <SelectItem value="up">Только вверх</SelectItem>
                  <SelectItem value="down">Только вниз</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Изменение, %</Label>
              <Input
                type="number" step={0.5} min={0.5} value={win.thresholdPct}
                onChange={(e) => set({ thresholdPct: Number(e.target.value) })}
                className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Кулдаун, сек</Label>
              <Input
                type="number" step={10} min={0} value={win.cooldownSec}
                onChange={(e) => set({ cooldownSec: Number(e.target.value) })}
                className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Мин. объём 24ч</Label>
              <div className="relative">
                <Input
                  type="number" step={10} min={0} value={win.minVol24h / 1e6}
                  onChange={(e) => set({ minVol24h: Number(e.target.value) * 1e6 })}
                  className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] pr-14 text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted-foreground)]">$M</span>
              </div>
            </div>
          </div>

          {/* Рынки */}
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-wider text-[var(--muted-foreground)]">Рынки · Binance · Bybit · OKX</Label>
              <span className="text-[10px] text-[var(--muted-foreground)]">данные в реальном времени</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MARKET_KEYS.map((mk) => {
                const [ex, m] = mk.split('_')
                return (
                  <MarketToggle
                    key={mk}
                    label={`${EX_MAP[ex as keyof typeof EX_MAP].name} ${m}`}
                    color={EX_MAP[ex as keyof typeof EX_MAP].color}
                    checked={win.markets[mk]}
                    onChange={(v) => set({ markets: { ...win.markets, [mk]: v } })}
                  />
                )
              })}
            </div>
          </div>

          {/* Индивидуальные правила монет */}
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] p-4">
            <Label className="text-xs font-black uppercase tracking-wider text-[var(--muted-foreground)]">Правила для монет — персональный порог %</Label>
            <div className="flex gap-2">
              <Input
                value={ruleSym}
                onChange={(e) => setRuleSym(e.target.value.toUpperCase())}
                placeholder="Например PEPE или SOL"
                className="h-10 flex-1 rounded-xl border-[var(--border)] bg-[var(--card)] text-sm font-bold text-[var(--foreground)]"
              />
              <Button
                size="sm" variant="outline" className="h-10 shrink-0 rounded-xl px-3"
                disabled={ruleSym.length < 2}
                onClick={() => {
                  const sym = ruleSym.endsWith('USDT') ? ruleSym : `${ruleSym}USDT`
                  if (win.coinRules.some((r) => r.symbol === sym)) { setRuleSym(''); return }
                  set({ coinRules: [...win.coinRules, { symbol: sym, pct: win.thresholdPct }] })
                  setRuleSym('')
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {win.coinRules.length > 0 && (
              <div className="space-y-1.5">
                {win.coinRules.map((r, i) => (
                  <div key={r.symbol} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                    <span className="text-xs font-black">{r.symbol}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">порог</span>
                    <Input
                      type="number" step={0.5} min={0.5} value={r.pct}
                      onChange={(e) => {
                        const rules = [...win.coinRules]
                        rules[i] = { ...r, pct: Number(e.target.value) }
                        set({ coinRules: rules })
                      }}
                      className="cp-num h-8 w-20 rounded-lg border-[var(--border)] bg-[var(--muted)] text-xs font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[10px] font-black text-[var(--muted-foreground)]">%</span>
                    <button
                      onClick={() => set({ coinRules: win.coinRules.filter((x) => x.symbol !== r.symbol) })}
                      className="ml-auto text-[var(--destructive)] transition-transform hover:scale-125"
                      aria-label={`Удалить правило ${r.symbol}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              Отдельные монеты часто требуют своих порогов: мемы двигаются на 10%+ в минуту,
              majors редко проходят 1%. Пустой список — используется общий порог окна.
            </p>
          </div>

          {/* Питание */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
            <span className="text-xs font-semibold">Движение активно</span>
            <Switch checked={win.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Включить окно" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const EMPTY_EVENTS: never[] = []

// ─── Строка алерта — крупное читаемое время + чёткие колонки ────────

function MovementAlertRow({ a }: { a: MovementAlert }) {
  const color = EX_MAP[a.exchange].color
  const up = a.changePct >= 0
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-2.5 py-2 transition-colors hover:border-[color-mix(in_srgb,var(--acc)_30%,transparent)]"
    >
      <span
        className="cp-num flex h-7 w-[74px] shrink-0 items-center justify-center rounded-lg bg-[var(--card)] text-[11px] font-bold text-[var(--foreground)]"
        style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
      >
        {fmtTimeSec(a.time)}
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
      <span
        className="shrink-0 rounded px-1 py-0.5 text-[8px] font-black"
        style={{ background: a.market === 'F' ? '#f59e0b1e' : '#22d3ee1e', color: a.market === 'F' ? '#f59e0b' : '#22d3ee' }}
      >
        {a.market}
      </span>
      <TickerCopy symbol={a.symbol} className="w-[86px] shrink-0 truncate text-[13px] font-black" />
      <span className="cp-num w-[74px] shrink-0 text-right text-[15px] font-black" style={{ color: up ? 'var(--pos)' : 'var(--neg)', textShadow: `0 0 16px ${up ? 'var(--pos)' : 'var(--neg)'}44` }}>
        {up ? '▲' : '▼'}{Math.abs(a.changePct).toFixed(1)}%
      </span>
      <span className="cp-num ml-auto shrink-0 text-[11px] font-semibold text-[var(--muted-foreground)]">{fmtPrice(a.price)}</span>
    </motion.div>
  )
}

// ─── Компактное перетаскиваемое окно движений ─────────────────────────

function MovementWindowCard({ win, index, z, onFront, wide }: {
  win: MovementWindowConfig
  index: number
  z: number
  onFront: () => void
  wide: boolean
}) {
  const { updateMovementWindow, removeMovementWindow } = useApp()
  const alerts = useLive((s) => s.movementAlerts[win.id] ?? EMPTY_EVENTS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  // во время перетаскивания — локальная позиция, иначе — из конфига (или дефолт)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const pos = dragPos
    ?? (win.x !== undefined && win.y !== undefined ? { x: win.x, y: win.y } : defaultPos(index, wide))
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // синхронизация не нужна: позиция выводится из конфига, локальная — только в момент drag

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (settingsOpen) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return // кнопки в шапке не тянут окно
    onFront()
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    setDragPos({ x: pos.x, y: pos.y })
    setDragging(true)
    headerRef.current?.setPointerCapture(e.pointerId)
  }, [onFront, pos.x, pos.y, settingsOpen])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragOffset.current) return
    const maxX = Math.max(0, (headerRef.current?.parentElement?.parentElement?.clientWidth ?? 1600) - 140)
    const x = Math.min(Math.max(0, e.clientX - dragOffset.current.dx), maxX)
    const y = Math.max(0, e.clientY - dragOffset.current.dy)
    setDragPos({ x, y })
  }, [])

  const onPointerUp = useCallback(() => {
    if (!dragOffset.current) return
    dragOffset.current = null
    setDragging(false)
    const p = dragPos ?? pos
    updateMovementWindow(win.id, { x: p.x, y: p.y })
    setDragPos(null)
  }, [dragPos, pos, updateMovementWindow, win.id])

  const enabledMarkets = MARKET_KEYS.filter((k) => win.markets[k]).length

  const card = (dragged: boolean, zIndex: number, style: React.CSSProperties) => (
    <div
      className={cn(
        'cp-border-glow flex flex-col overflow-hidden rounded-2xl bg-card shadow-xl transition-shadow',
        dragged && 'shadow-2xl ring-2 ring-[color-mix(in_srgb,var(--acc)_45%,transparent)]',
        !win.enabled && 'opacity-75',
      )}
      style={{
        ...style,
        zIndex,
        width: 'min(540px, calc(100vw - 32px))',
        borderTop: win.enabled ? '2px solid color-mix(in srgb, var(--pos) 55%, transparent)' : '2px solid var(--border)',
      }}
    >
      {/* Шапка — рукоятка перетаскивания */}
      <div
        ref={headerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => { setDragPos(null); updateMovementWindow(win.id, { x: defaultPos(index, wide).x, y: defaultPos(index, wide).y }) }}
        className={cn(
          'flex touch-none items-center gap-1.5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_45%,transparent)] px-2.5 py-2',
          dragged ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <GripHorizontal className={cn('h-4 w-4 shrink-0 transition-colors', dragged ? 'text-[var(--acc)]' : 'text-[var(--muted-foreground)]')} />
        <span className="truncate text-[13px] font-black">
          {win.name.toUpperCase()}
        </span>
        <span className="cp-num shrink-0 rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
          {win.period.toUpperCase()} ±{win.thresholdPct}%
        </span>
        <span className="cp-num ml-auto shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: alerts.length > 0 ? 'var(--pos)' : 'var(--muted-foreground)', background: alerts.length > 0 ? 'color-mix(in srgb, var(--pos) 12%, transparent)' : 'var(--muted)' }}>
          {alerts.length}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Настройки окна движений"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)]"
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => updateMovementWindow(win.id, { enabled: !win.enabled })}
          className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)]', win.enabled ? 'text-[var(--pos)]' : 'text-[var(--muted-foreground)]')}
          aria-label="Питание окна движений"
        >
          <Power className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { clearMovementAlerts(win.id); toastSuccess('Окно очищено', `${win.name}: лента сигналов сброшена`) }}
          disabled={alerts.length === 0}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)] disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label="Очистить окно движений"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => removeMovementWindow(win.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] hover:text-[var(--destructive)]" aria-label="Удалить окно движений">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Тело окна */}
      <div className="min-h-[128px] max-h-[340px] overflow-y-auto p-2.5">
        {!win.enabled ? (
          <div className="flex h-[112px] flex-col items-center justify-center gap-1 text-center">
            <Power className="h-5 w-5 text-[var(--muted-foreground)] opacity-50" />
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Окно остановлено</span>
          </div>
        ) : enabledMarkets === 0 ? (
          <div className="flex h-[112px] flex-col items-center justify-center gap-1 text-center">
            <Settings2 className="h-5 w-5 text-[var(--muted-foreground)] opacity-50" />
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Рынки не выбраны</span>
            <span className="text-[10px] text-[var(--muted-foreground)] opacity-70">включите их в шестерёнке</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex h-[112px] flex-col items-center justify-center gap-1 text-center">
            <TrendingUp className="h-5 w-5 text-[var(--muted-foreground)] opacity-50" />
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Ожидание движений…</span>
            <span className="cp-num text-[10px] text-[var(--muted-foreground)] opacity-70">
              ±{win.thresholdPct}% от открытия · объём от {fmtUsd(win.minVol24h)}
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alerts.map((a) => (
              <MovementAlertRow key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>

      <MovementSettingsDialog win={win} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )

  // На узких экранах — обычная стопка без absolute
  if (!wide) {
    return <div className="relative">{card(false, 1, {})}</div>
  }

  return card(dragging, z, {
    position: 'absolute',
    left: pos.x,
    top: pos.y,
    willChange: dragging ? 'transform, left, top' : undefined,
  })
}

export function MovementsView() {
  const movementWindows = useApp((s) => s.movementWindows)
  const [wide, setWide] = useState(true)
  const [front, setFront] = useState<{ id: string; z: number } | null>(null)
  const frontZ = useRef(20)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const bringToFront = (id: string) => {
    frontZ.current += 1
    setFront({ id, z: frontZ.current })
  }

  // высота полотна: ниже самого нижнего окна
  const canvasH = wide
    ? Math.max(
      480,
      ...movementWindows.map((w, i) => (w.y ?? defaultPos(i, true).y) + 400),
    )
    : undefined

  return (
    <div>
      {/* Полотно — тулбар живёт в шапке приложения */}
      {movementWindows.length === 0 ? (
        <div className="cp-border-glow rounded-2xl bg-card">
          <EmptyState
            icon={<ChartCandlestick className="h-10 w-10" />}
            title="Нет окон движений"
            hint="Создайте первое окно кнопкой «Новое окно» сверху — каждое следит за своими биржами и порогами независимо"
          />
        </div>
      ) : (
        <div
          ref={canvasRef}
          className={cn(wide && 'relative', !wide && 'flex flex-col gap-3')}
          style={wide ? { minHeight: canvasH } : undefined}
        >
          {movementWindows.map((w, i) => (
            <MovementWindowCard
              key={w.id}
              win={w}
              index={i}
              z={front?.id === w.id ? front.z : 10 + i}
              onFront={() => bringToFront(w.id)}
              wide={wide}
            />
          ))}
        </div>
      )}
    </div>
  )
}

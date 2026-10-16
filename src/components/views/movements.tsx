'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChartCandlestick, Plus, Power, Trash2, TrendingDown, TrendingUp, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { EX_MAP, fmtPrice, fmtTimeSec, fmtUsd, type MovementWindowConfig } from '@/engines/types'
import { SOUNDS, soundEngine } from '@/engines/sound'
import { toastSuccess } from '@/engines/notifier'
import { EmptyState } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

const MARKET_KEYS = ['BINANCE_F', 'BINANCE_S', 'BYBIT_F', 'BYBIT_S', 'OKX_F', 'OKX_S'] as const

function MarketToggle({ mk, label, color, checked, onChange }: { mk: string; label: string; color: string; checked: boolean; onChange: (v: boolean) => void }) {
  void mk
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold transition-all',
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
      {checked && <span className="text-[9px] tracking-wider" style={{ color }}>WS</span>}
    </button>
  )
}

function MovementWindowCard({ win }: { win: MovementWindowConfig }) {
  const { updateMovementWindow, removeMovementWindow } = useApp()
  const alerts = useLive((s) => s.movementAlerts[win.id] ?? [])
  const [ruleSym, setRuleSym] = useState('')

  const set = (patch: Partial<MovementWindowConfig>) => updateMovementWindow(win.id, patch)
  const enabledMarkets = MARKET_KEYS.filter((k) => win.markets[k]).length

  return (
    <div className="cp-border-glow grid gap-0 overflow-hidden rounded-2xl bg-card lg:grid-cols-[1fr_320px]" style={{ borderTop: win.enabled ? '2px solid color-mix(in srgb, var(--pos) 55%, transparent)' : '2px solid var(--border)' }}>
      {/* Левая часть — алерты */}
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <ChartCandlestick className="h-4 w-4" style={{ color: win.enabled ? 'var(--pos)' : 'var(--muted-foreground)' }} />
          <span className="text-sm font-black">
            {win.name.toUpperCase()} · {win.period.toUpperCase()} ±{win.thresholdPct}%
          </span>
          <span className="cp-num ml-auto rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold" style={{ color: alerts.length > 0 ? 'var(--pos)' : 'var(--muted-foreground)' }}>
            {alerts.length} сигналов
          </span>
          <button
            onClick={() => set({ enabled: !win.enabled })}
            className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)]', win.enabled ? 'text-[var(--pos)]' : 'text-[var(--muted-foreground)]')}
            title={win.enabled ? 'Остановить окно' : 'Запустить окно'}
            aria-label="Питание окна движений"
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => removeMovementWindow(win.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--destructive)]" title="Удалить окно" aria-label="Удалить окно движений">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto p-3" style={{ maxHeight: 420 }}>
          {!win.enabled ? (
            <EmptyState icon={<Power className="h-8 w-8" />} title="Окно остановлено" hint="Включите окно, чтобы отслеживать движения" />
          ) : enabledMarkets === 0 ? (
            <EmptyState icon={<ChartCandlestick className="h-8 w-8" />} title="Рынки не выбраны" hint="Включите хотя бы один рынок в настройках окна" />
          ) : alerts.length === 0 ? (
            <EmptyState icon={<TrendingUp className="h-8 w-8" />} title="Ожидание движений…" hint={`Монета должна пройти ±${win.thresholdPct}% от открытия ${win.period}-свечи при объёме от ${fmtUsd(win.minVol24h)}`} />
          ) : (
            <div className="space-y-1">
              {alerts.map((a) => {
                const color = EX_MAP[a.exchange].color
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -14, backgroundColor: 'color-mix(in srgb, var(--acc) 12%, transparent)' }}
                    animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="cp-num w-14 shrink-0 text-[10px] text-[var(--muted-foreground)]">{fmtTimeSec(a.time)}</span>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="hidden w-16 shrink-0 truncate text-[10px] font-bold text-[var(--muted-foreground)] sm:block">{EX_MAP[a.exchange].name}</span>
                    <span className="w-14 shrink-0 font-black">{a.symbol}</span>
                    <span className="cp-num hidden w-8 shrink-0 text-[10px] text-[var(--muted-foreground)] sm:block">{a.period.toUpperCase()}</span>
                    <span className="cp-num w-16 shrink-0 text-right font-black" style={{ color: a.changePct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                      {a.changePct >= 0 ? '▲' : '▼'} {Math.abs(a.changePct).toFixed(2)}%
                    </span>
                    <span className="cp-num hidden w-20 shrink-0 text-right text-[11px] md:block">{fmtPrice(a.price)}</span>
                    <span className="cp-num ml-auto hidden w-16 shrink-0 text-right text-[10px] text-[var(--muted-foreground)] lg:block">{fmtUsd(a.vol24h)}</span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Правая часть — настройки */}
      <div className="border-t border-[var(--border)] bg-[var(--muted)] p-4 lg:border-l lg:border-t-0">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Настройки</span>
          <Switch checked={win.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Включить окно" />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">Таймфрейм</Label>
              <Select value={win.period} onValueChange={(v) => set({ period: v as MovementWindowConfig['period'] })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 минута</SelectItem>
                  <SelectItem value="5m">5 минут</SelectItem>
                  <SelectItem value="24h">24 часа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">Направление</Label>
              <Select value={win.direction} onValueChange={(v) => set({ direction: v as MovementWindowConfig['direction'] })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Оба</SelectItem>
                  <SelectItem value="up">Только вверх</SelectItem>
                  <SelectItem value="down">Только вниз</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">Изменение, %</Label>
              <Input type="number" step={0.5} min={0.5} value={win.thresholdPct} onChange={(e) => set({ thresholdPct: Number(e.target.value) })} className="cp-num h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">Кулдаун, сек</Label>
              <Input type="number" step={10} min={0} value={win.cooldownSec} onChange={(e) => set({ cooldownSec: Number(e.target.value) })} className="cp-num h-9 text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--muted-foreground)]">Мин. объём 24ч</Label>
            <div className="relative">
              <Input type="number" step={10} min={0} value={win.minVol24h / 1e6} onChange={(e) => set({ minVol24h: Number(e.target.value) * 1e6 })} className="cp-num h-9 pr-10 text-xs" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--muted-foreground)]">$M</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-[var(--muted-foreground)]">Рынки (Binance · Bybit · OKX)</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {MARKET_KEYS.map((mk) => {
                const [ex, m] = mk.split('_')
                return (
                  <MarketToggle
                    key={mk}
                    mk={mk}
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
          <div className="space-y-1.5">
            <Label className="text-[10px] text-[var(--muted-foreground)]">Правила для монет (порог %)</Label>
            <div className="flex gap-1.5">
              <Input value={ruleSym} onChange={(e) => setRuleSym(e.target.value.toUpperCase())} placeholder="SYMBOL" className="h-8 text-xs" />
              <Button
                size="sm" variant="outline" className="h-8 shrink-0 px-2.5"
                disabled={ruleSym.length < 2}
                onClick={() => {
                  if (win.coinRules.some((r) => r.symbol === ruleSym)) return
                  set({ coinRules: [...win.coinRules, { symbol: ruleSym, pct: win.thresholdPct }] })
                  setRuleSym('')
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {win.coinRules.length > 0 && (
              <div className="space-y-1">
                {win.coinRules.map((r, i) => (
                  <div key={r.symbol} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
                    <span className="text-[11px] font-black">{r.symbol}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">порог</span>
                    <Input
                      type="number" step={0.5} min={0.5} value={r.pct}
                      onChange={(e) => {
                        const rules = [...win.coinRules]
                        rules[i] = { ...r, pct: Number(e.target.value) }
                        set({ coinRules: rules })
                      }}
                      className="cp-num h-6 w-16 text-[11px]"
                    />
                    <span className="text-[10px] font-bold text-[var(--muted-foreground)]">%</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export function MovementsView() {
  const movementWindows = useApp((s) => s.movementWindows)
  const addMovementWindow = useApp((s) => s.addMovementWindow)

  return (
    <div className="space-y-4">
      <div className="cp-border-glow flex flex-wrap items-center gap-3 rounded-2xl bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--pos)' }} /> Окна движений — независимы друг от друга
        </div>
        <div className="hidden items-center gap-2 text-xs text-[var(--muted-foreground)] md:flex">
          <TrendingDown className="h-3.5 w-3.5" /> отсчёт от открытия свечи · мгновенное уведомление без задержки
        </div>
        <Button size="sm" className="ml-auto" disabled={movementWindows.length >= 6} onClick={() => { addMovementWindow(); toastSuccess('Окно создано', 'Настройте параметры и рынки справа') }}>
          <Plus className="mr-1.5 h-4 w-4" /> Новое окно ({movementWindows.length}/6)
        </Button>
      </div>

      <div className="space-y-4">
        {movementWindows.map((w) => (
          <MovementWindowCard key={w.id} win={w} />
        ))}
      </div>
    </div>
  )
}


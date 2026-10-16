'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import {
  Ban, Check, ChevronsUpDown, Coins, Layers, Loader2, Palette, Plus, Power, Search,
  Send, Settings2, Hourglass, Trash2, Volume2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import {
  EX_MAP, DEFAULT_VOL_TIERS, fmtAge, fmtPrice, fmtUsd, volumeTierColor,
  type DensityEvent, type DensityWindowConfig, type ExchangeId, type MarketType, type SymbolRow, type VolumeTier,
} from '@/engines/types'
import { COIN_MAP } from '@/engines/coins'
import { SOUNDS, soundEngine } from '@/engines/sound'
import { toastSuccess } from '@/engines/notifier'
import { getHub } from '@/engines/hub'
import { EmptyState, TickerCopy } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

const LIFETIME_OPTIONS = [
  { value: '10', label: 'от 10 сек' },
  { value: '30', label: 'от 30 сек' },
  { value: '60', label: 'от 1 мин' },
  { value: '300', label: 'от 5 мин' },
]

/** Палитра для порогов подсветки объёма */
const TIER_COLORS = [
  { label: 'белый', value: '#e6eaf5' },
  { label: 'фиолетовый', value: '#a78bfa' },
  { label: 'зелёный', value: '#34d399' },
  { label: 'циан', value: '#22d3ee' },
  { label: 'янтарный', value: '#fbbf24' },
  { label: 'розовый', value: '#f472b6' },
  { label: 'красный', value: '#fb7185' },
  { label: 'лайм', value: '#a3e635' },
]

// ─── Загрузка символов биржи ─────────────────────────────────────────

function useSymbols(ex: ExchangeId, market: MarketType | 'ALL') {
  const [rows, setRows] = useState<SymbolRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    const hub = getHub()
    const load = async () => {
      // первый await выводит из синхронного контекста эффекта
      await Promise.resolve()
      if (!alive) return
      setLoading(true)
      if (market === 'ALL') {
        const [f, s] = await Promise.all([hub.fetchSymbols(ex, 'F'), hub.fetchSymbols(ex, 'S')])
        if (!alive) return
        const map = new Map<string, SymbolRow>()
        for (const r of [...f, ...s]) {
          const prev = map.get(r.symbol)
          if (!prev || r.vol24h > prev.vol24h) map.set(r.symbol, r)
        }
        setRows([...map.values()].sort((a, b) => b.vol24h - a.vol24h))
      } else {
        setRows(await hub.fetchSymbols(ex, market))
      }
      if (alive) setLoading(false)
    }
    void load()
    return () => { alive = false }
  }, [ex, market])
  return { rows, loading }
}

// ─── Комбобокс выбора тикера с поиском ───────────────────────────────

function TickerCombobox({ rows, loading, onSelect, placeholder, disabled }: {
  rows: SymbolRow[]
  loading: boolean
  onSelect: (symbol: string) => void
  placeholder: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return rows
    return rows.filter((r) => r.symbol.includes(q) || (COIN_MAP[r.symbol]?.name ?? '').toUpperCase().includes(q))
  }, [rows, query])

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-left text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--acc)_45%,transparent)] disabled:opacity-50"
          aria-label={placeholder}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
          <span className="min-w-0 flex-1 truncate text-[var(--muted-foreground)]">{placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] max-w-[92vw] rounded-2xl border-[var(--border)] bg-[var(--card-solid)] p-0" align="start">
        <Command shouldFilter={false} className="overflow-hidden rounded-2xl">
          <CommandInput
            placeholder="Введите тикер · например BTC"
            value={query}
            onValueChange={setQuery}
            className="text-sm"
          />
          <CommandList className="max-h-72">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка символов биржи…
              </div>
            )}
            {!loading && filtered.length === 0 && <CommandEmpty>Ничего не найдено</CommandEmpty>}
            {!loading && filtered.slice(0, 80).map((r) => (
              <CommandItem
                key={r.symbol}
                value={r.symbol}
                onSelect={() => { onSelect(r.symbol); setOpen(false); setQuery('') }}
                className="gap-2 px-3 py-2 text-sm"
              >
                <span className="w-3 shrink-0"><Check className="h-3.5 w-3.5 opacity-0" /></span>
                <span className="w-20 shrink-0 truncate font-black">{r.symbol.replace(/USDT$/, '')}</span>
                <span className="shrink-0 rounded bg-[var(--muted)] px-1 text-[9px] font-bold text-[var(--muted-foreground)]">USDT</span>
                <span className="cp-num ml-auto shrink-0 text-[11px] text-[var(--muted-foreground)]">{fmtUsd(r.vol24h)}</span>
                <span className="cp-num w-14 shrink-0 text-right text-[11px] font-bold" style={{ color: r.change24hPct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {r.change24hPct >= 0 ? '+' : ''}{r.change24hPct.toFixed(1)}%
                </span>
              </CommandItem>
            ))}
            {!loading && filtered.length > 80 && (
              <div className="py-1.5 text-center text-[10px] text-[var(--muted-foreground)]">
                показаны топ-80 из {filtered.length} — уточните запрос
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Числовое поле с суффиксом ───────────────────────────────────────

function NumberField({ label, value, onChange, unit, step = 1, hint }: {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  step?: number
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] pl-3.5 pr-16 text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:border-[color-mix(in_srgb,var(--acc)_60%,transparent)] focus-visible:ring-[color-mix(in_srgb,var(--acc)_35%,transparent)]"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted-foreground)]">
          {unit}
        </span>
      </div>
      {hint && <p className="text-[10px] leading-tight text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  )
}

// ─── Настройки рынка (F или S) ───────────────────────────────────────

function MarketSettingsColumn({ win, market }: { win: DensityWindowConfig; market: 'f' | 's' }) {
  const updateDensityMarket = useApp((s) => s.updateDensityMarket)
  const s = win[market]
  const title = market === 'f' ? 'Фьючерсы (F)' : 'Спот (S)'
  const color = market === 'f' ? '#f59e0b' : '#22d3ee'
  const set = (patch: Partial<typeof s>) => updateDensityMarket(win.id, market, patch)

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] p-4">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <span className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wider" style={{ color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          {title}
        </span>
        <span className="rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">
          {market === 'f' ? 'PERP · USDT' : 'SPOT · USDT'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Объём 24ч, мин."
          value={s.minVolume24h / 1e6}
          onChange={(v) => set({ minVolume24h: v * 1e6 })}
          unit="$M" step={0.5}
          hint="монеты с меньшим оборотом игнорируются"
        />
        <NumberField
          label="Размер заявки, мин."
          value={s.minOrderUsd / 1e6}
          onChange={(v) => set({ minOrderUsd: v * 1e6 })}
          unit="$M" step={0.1}
          hint="минимальная величина плотности"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Отклонение Bid" value={s.bidDepthPct} onChange={(v) => set({ bidDepthPct: v })} unit="%" step={0.5} hint="глубина поиска под ценой" />
        <NumberField label="Отклонение Ask" value={s.askDepthPct} onChange={(v) => set({ askDepthPct: v })} unit="%" step={0.5} hint="глубина поиска над ценой" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Возраст плотности — когда показать в окне</Label>
        <Select value={String(s.lifetimeSec)} onValueChange={(v) => set({ lifetimeSec: Number(v) })}>
          <SelectTrigger className="h-11 w-full rounded-xl bg-[var(--card)] text-sm font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIFETIME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] leading-tight text-[var(--muted-foreground)]">
          Плотность попадёт в окно, если простоит в стакане не меньше этого времени — свежие стены отсеиваются
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Сигнал окна</Label>
        <div className="flex items-center gap-2">
          <Select value={s.soundId} onValueChange={(v) => set({ soundId: v })}>
            <SelectTrigger className="h-11 flex-1 rounded-xl bg-[var(--card)] text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOUNDS.map((snd) => (
                <SelectItem key={snd.id} value={snd.id}>{snd.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="icon"
            onClick={() => soundEngine.preview(s.soundId, s.volumePct)}
            aria-label="Прослушать сигнал"
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[var(--muted-foreground)]">Громкость окна</span>
          <span className="cp-num text-sm font-black" style={{ color: 'var(--acc)' }}>{s.volumePct}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={s.volumePct}
          onChange={(e) => set({ volumePct: Number(e.target.value) })}
          className="cp-range w-full"
          style={{ '--fill': `${s.volumePct}%` } as CSSProperties}
          aria-label="Громкость окна"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
        <span className="text-xs font-semibold">Голосовые уведомления</span>
        <Switch checked={s.voice} onCheckedChange={(v) => set({ voice: v })} aria-label="Голос для рынка" />
      </div>
    </div>
  )
}

// ─── Подсветка объёма заявки по порогам ────────────────────────────

function VolumeTiersSection({ win }: { win: DensityWindowConfig }) {
  const updateDensityWindow = useApp((s) => s.updateDensityWindow)
  const tiers = win.volTiers ?? DEFAULT_VOL_TIERS
  const setTiers = (next: VolumeTier[]) => updateDensityWindow(win.id, { volTiers: next })

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wider text-[var(--foreground)]">
          <Palette className="h-4 w-4" style={{ color: 'var(--acc)' }} />
          Цвет объёма заявки
        </span>
        <Button
          variant="outline" size="sm"
          disabled={tiers.length >= 4}
          onClick={() => setTiers([...tiers, { minUsd: 20e6, color: '#22d3ee' }])}
          className="h-8 rounded-xl px-2.5 text-[11px]"
        >
          <Plus className="mr-1 h-3 w-3" /> порог
        </Button>
      </div>

      <div className="space-y-2">
        {tiers.map((t, i) => {
          const next = tiers[i + 1]
          const from = t.minUsd
          const to = next?.minUsd
          return (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2">
              <span className="shrink-0 text-[11px] font-semibold text-[var(--muted-foreground)]">от</span>
              <div className="relative w-24">
                <Input
                  type="number" step={0.5} min={0} value={t.minUsd / 1e6}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value)) * 1e6
                    const next2 = [...tiers]
                    next2[i] = { ...t, minUsd: v }
                    setTiers(next2.sort((a, b) => a.minUsd - b.minUsd))
                  }}
                  className="cp-num h-9 rounded-lg border-[var(--border)] bg-[var(--muted)] pr-10 text-[13px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--muted-foreground)]">$M</span>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-[var(--muted-foreground)]">— {to ? fmtUsd(to) : '∞'}</span>
              <div className="ml-auto flex items-center gap-1">
                {TIER_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      const next2 = [...tiers]
                      next2[i] = { ...t, color: c.value }
                      setTiers(next2)
                    }}
                    className={cn('h-6 w-6 rounded-md border transition-transform hover:scale-110', t.color === c.value ? 'cp-glow-sm border-white/60' : 'border-transparent')}
                    style={{ background: c.value }}
                    aria-label={`Цвет порога: ${c.label}`}
                  />
                ))}
                <button
                  onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] hover:text-[var(--destructive)]"
                  aria-label="Удалить порог"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <span
                className="cp-num w-16 shrink-0 text-right text-xs font-black"
                style={{ color: t.color, textShadow: `0 0 12px ${t.color}55` }}
              >
                {fmtUsd(from + 2e6)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
        Объём лимитной заявки подсвечивается цветом по порогам — например, до $5M обычным цветом,
        от $5M фиолетовым, от $10M зелёным. Действует сразу для фьючерсов и спота этого окна.
      </p>
    </div>
  )
}

// ─── Диалог настроек окна ─────────────────────────────────────────────

function WindowSettingsDialog({ win, open, onOpenChange }: { win: DensityWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const meta = EX_MAP[win.exchange]
  const noSpot = win.exchange === 'HL' || win.exchange === 'ASTER'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full overflow-y-auto rounded-3xl border-[var(--border)] bg-[var(--card-solid)] sm:max-w-none" style={{ maxHeight: '85vh', width: 'min(92vw, 880px)', boxShadow: '0 40px 90px -30px var(--glow)' }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5 text-base">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
            Настройки окна · {meta.name.toUpperCase()} · USDT
            <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
              режим: {win.mode}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className={cn('grid gap-4', !noSpot && win.mode === 'ALL' ? 'md:grid-cols-2' : '')}>
          {noSpot ? (
            <MarketSettingsColumn win={win} market="f" />
          ) : win.mode === 'ALL' ? (
            <>
              <MarketSettingsColumn win={win} market="f" />
              <MarketSettingsColumn win={win} market="s" />
            </>
          ) : (
            <MarketSettingsColumn win={win} market={win.mode === 'F' ? 'f' : 's'} />
          )}
        </div>
        <VolumeTiersSection win={win} />
        {noSpot ? (
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">
            {meta.name} — биржа только с фьючерсами, спот-рынок отсутствует
          </p>
        ) : win.mode === 'ALL' && (
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">Настройки фьючерсов и спота независимы друг от друга</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Диалог тикеров окна ──────────────────────────────────────────────

function TickersDialog({ win, open, onOpenChange }: { win: DensityWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addTickerOverride, updateTickerOverride, removeTickerOverride, sendTicker, sendAllTickers, densityWindows } = useApp()
  const [sendTargets, setSendTargets] = useState<Record<string, boolean>>({})
  const [sendSym, setSendSym] = useState<string | null>(null)
  const { rows, loading } = useSymbols(win.exchange, 'ALL')

  const meta = EX_MAP[win.exchange]
  const others = densityWindows.filter((w) => w.id !== win.id)
  const entries = Object.entries(win.tickers)

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSendSym(null); setSendTargets({}) } }}>
      <DialogContent className="w-full overflow-y-auto rounded-3xl border-[var(--border)] bg-[var(--card-solid)] sm:max-w-none" style={{ maxHeight: '85vh', width: 'min(92vw, 640px)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <Coins className="h-4 w-4" style={{ color: meta.color }} />
            Тикеры окна · {meta.name.toUpperCase()}
            <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">{entries.length}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Добавление тикера — ввод с выпадающим списком */}
        <TickerCombobox
          rows={rows.filter((r) => !win.tickers[r.symbol])}
          loading={loading}
          placeholder="Введите тикер для индивидуальных настроек"
          onSelect={(sym) => { addTickerOverride(win.id, sym); toastSuccess('Тикер добавлен', `${sym} получил персональные пороги`) }}
        />

        {/* Список тикеров */}
        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
              Индивидуальных тикеров нет — окно работает по общим фильтрам F/S.
              Начните вводить монету выше, чтобы задать ей персональные пороги.
            </div>
          )}
          {entries.map(([sym, ovr]) => (
            <div key={sym} className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_60%,transparent)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">{sym}</span>
                <span className="hidden text-[11px] text-[var(--muted-foreground)] sm:block">{COIN_MAP[sym]?.name ?? ''}</span>
                {ovr.minVolume24h && <span className="cp-num rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">vol ≥ {fmtUsd(ovr.minVolume24h)}</span>}
                {ovr.minOrderUsd && <span className="cp-num rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">ord ≥ {fmtUsd(ovr.minOrderUsd)}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => { setSendSym(sym); setSendTargets({}) }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] transition-colors hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)]"
                    aria-label="Отправить тикер в другие окна"
                  >
                    <Send className="h-3.5 w-3.5" style={{ color: 'var(--acc)' }} />
                  </button>
                  <button
                    onClick={() => removeTickerOverride(win.id, sym)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--destructive)] transition-colors hover:border-[var(--destructive)]"
                    aria-label="Удалить тикер"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-[auto_1fr_1fr] items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={ovr.enabled !== false} onCheckedChange={(v) => updateTickerOverride(win.id, sym, { enabled: v })} aria-label={`Включить ${sym}`} />
                  <span className="text-[11px] text-[var(--muted-foreground)]">{ovr.enabled === false ? 'выкл' : 'вкл'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" step={0.5} min={0} placeholder="Объём"
                    value={ovr.minVolume24h ? ovr.minVolume24h / 1e6 : ''}
                    onChange={(e) => updateTickerOverride(win.id, sym, { minVolume24h: e.target.value === '' ? undefined : Number(e.target.value) * 1e6 })}
                    className="cp-num h-9 border-[var(--border)] bg-[var(--card)] text-[12px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] font-black text-[var(--muted-foreground)]">$M</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" step={0.1} min={0} placeholder="Заявка"
                    value={ovr.minOrderUsd ? ovr.minOrderUsd / 1e6 : ''}
                    onChange={(e) => updateTickerOverride(win.id, sym, { minOrderUsd: e.target.value === '' ? undefined : Number(e.target.value) * 1e6 })}
                    className="cp-num h-9 border-[var(--border)] bg-[var(--card)] text-[12px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] font-black text-[var(--muted-foreground)]">$M</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Отправка тикеров */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <Button
            variant="outline" size="sm"
            disabled={entries.length === 0 || others.length === 0}
            onClick={() => { sendAllTickers(win.id); toastSuccess('Тикеры отправлены', `${entries.length} тикеров → все окна`) }}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" /> Отправить все тикеры во все окна
          </Button>
        </div>

        {/* Диалог выбора окон */}
        {sendSym && (
          <div className="rounded-xl border p-3" style={{ borderColor: 'color-mix(in srgb, var(--acc) 40%, transparent)', background: 'color-mix(in srgb, var(--acc) 6%, transparent)' }}>
            <div className="text-xs font-bold">Отправить <span style={{ color: 'var(--acc)' }}>{sendSym}</span> в окна:</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {others.map((w) => (
                <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-xs font-semibold">
                  <Checkbox checked={!!sendTargets[w.id]} onCheckedChange={(v) => setSendTargets((p) => ({ ...p, [w.id]: !!v }))} />
                  {EX_MAP[w.exchange].name}
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setSendSym(null); setSendTargets({}) }}>Отмена</Button>
              <Button
                size="sm"
                disabled={Object.values(sendTargets).every((v) => !v)}
                onClick={() => {
                  const targets = Object.entries(sendTargets).filter(([, v]) => v).map(([k]) => k)
                  sendTicker(win.id, sendSym, targets)
                  toastSuccess('Тикер отправлен', `${sendSym} → ${targets.map((t) => EX_MAP[densityWindows.find((w) => w.id === t)!.exchange].name).join(', ')}`)
                  setSendSym(null)
                  setSendTargets({})
                }}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Отправить
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Диалог чёрного списка ────────────────────────────────────────────

function BlacklistDialog({ win, open, onOpenChange }: { win: DensityWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toggleBlacklist } = useApp()
  const [tab, setTab] = useState<'F' | 'S'>('F')
  const meta = EX_MAP[win.exchange]
  const noSpot = win.exchange === 'HL' || win.exchange === 'ASTER'
  const effectiveTab = noSpot ? 'F' : tab
  const { rows, loading } = useSymbols(win.exchange, effectiveTab)
  const list = effectiveTab === 'F' ? win.blacklistF : win.blacklistS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-[var(--border)] bg-[var(--card-solid)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <Ban className="h-4 w-4 text-[var(--destructive)]" />
            Чёрный список · {meta.name.toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        {!noSpot && (
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
            {(['F', 'S'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('rounded-lg py-1.5 text-xs font-black transition-all', effectiveTab === t ? 'text-white' : 'text-[var(--muted-foreground)]')}
                style={effectiveTab === t ? { background: t === 'F' ? '#f59e0b' : '#22d3ee' } : undefined}
              >
                {t === 'F' ? `Фьючерсы (${win.blacklistF.length})` : `Спот (${win.blacklistS.length})`}
              </button>
            ))}
          </div>
        )}
        <TickerCombobox
          rows={rows.filter((r) => !list.includes(r.symbol))}
          loading={loading}
          placeholder="Монета для блокировки"
          onSelect={(sym) => toggleBlacklist(win.id, effectiveTab, sym)}
        />
        <div className="flex min-h-[60px] flex-wrap gap-1.5 rounded-xl border border-dashed border-[var(--border)] p-3">
          {list.length === 0 && <span className="w-full py-2 text-center text-xs text-[var(--muted-foreground)]">Список пуст — блокировка монет убирает их сигналы из окна</span>}
          {list.map((s) => (
            <span key={s} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold" style={{ borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)', background: 'color-mix(in srgb, var(--destructive) 8%, transparent)', color: 'var(--destructive)' }}>
              {s}
              <button onClick={() => toggleBlacklist(win.id, effectiveTab, s)} aria-label={`Разблокировать ${s}`} className="transition-transform hover:scale-125">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)]">Чёрные списки фьючерсов и спота у каждого окна — отдельные.</p>
      </DialogContent>
    </Dialog>
  )
}

const EMPTY_EVENTS: never[] = []

// ─── Окно плотностей (карточка биржи) ─────────────────────────────────

function DensityWindowCard({ win, compact }: { win: DensityWindowConfig; compact: boolean }) {
  const setDensityMode = useApp((s) => s.setDensityMode)
  const updateDensityWindow = useApp((s) => s.updateDensityWindow)
  const removeDensityWindow = useApp((s) => s.removeDensityWindow)
  const densityWindows = useApp((s) => s.densityWindows)
  const events = useLive((s) => s.densityEvents[win.id] ?? EMPTY_EVENTS)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tickersOpen, setTickersOpen] = useState(false)
  const [blacklistOpen, setBlacklistOpen] = useState(false)

  const meta = EX_MAP[win.exchange]
  const filtered = useMemo(
    () => events.filter((e) => (win.mode === 'ALL' ? true : e.market === win.mode)).sort((a, b) => b.createdAt - a.createdAt),
    [events, win.mode],
  )

  const modeBtn = (m: 'ALL' | 'F' | 'S') => (
    <button
      key={m}
      onClick={() => setDensityMode(win.id, m)}
      className={cn(
        'flex h-5 min-w-7 items-center justify-center rounded px-1 text-[9px] font-black transition-all',
        win.mode === m ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
      style={win.mode === m ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', boxShadow: '0 0 12px -3px var(--glow)' } : undefined}
      aria-pressed={win.mode === m}
    >
      {m}
    </button>
  )

  return (
    <div className="cp-border-glow flex flex-col rounded-2xl bg-card" style={{ borderTop: `2px solid ${meta.color}66` }}>
      {/* Заголовок окна */}
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-2.5 py-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-wide">
          {win.exchange === 'HL' ? 'HYPERLIQ' : meta.name.toUpperCase()}
        </span>
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {modeBtn('ALL')}
          {modeBtn('F')}
          {modeBtn('S')}
        </div>
        <span className="cp-num shrink-0 rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-bold" style={{ color: filtered.length > 0 ? meta.color : 'var(--muted-foreground)' }}>
          {filtered.length}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => setTickersOpen(true)} aria-label="Тикеры окна" className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)]">
            <Coins className="h-3 w-3" />
          </button>
          <button onClick={() => setBlacklistOpen(true)} aria-label="Чёрный список" className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--destructive)]">
            <Ban className="h-3 w-3" />
          </button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Настройки окна" className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)]">
            <Settings2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => updateDensityWindow(win.id, { enabled: !win.enabled })}
            aria-label="Питание окна"
            className={cn('flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)]', win.enabled ? 'text-[var(--pos)]' : 'text-[var(--muted-foreground)]')}
          >
            <Power className="h-3 w-3" />
          </button>
          {densityWindows.length > 1 && (
            <button onClick={() => removeDensityWindow(win.id)} aria-label="Удалить окно" className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--destructive)]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Таблица событий */}
      <div className="flex-1 p-1.5">
        {!win.enabled ? (
          <EmptyState icon={<Power className="h-8 w-8" />} title="Окно отключено" hint="Включите окно, чтобы возобновить поток плотностей" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Layers className="h-8 w-8" />} title="Нет плотностей по фильтрам" hint="Ждём крупные лимитные заявки, подходящие под ваши пороги…" />
        ) : (
          <div className="space-y-1">
            {filtered.slice(0, 14).map((e) => (
              <DensityRow key={e.id} e={e} compact={compact} tiers={win.volTiers} />
            ))}
            {filtered.length > 14 && (
              <div className="py-1 text-center text-[10px] text-[var(--muted-foreground)]">+{filtered.length - 14} ещё</div>
            )}
          </div>
        )}
      </div>

      <WindowSettingsDialog win={win} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TickersDialog win={win} open={tickersOpen} onOpenChange={setTickersOpen} />
      <BlacklistDialog win={win} open={blacklistOpen} onOpenChange={setBlacklistOpen} />
    </div>
  )
}

function DensityRow({ e, compact, tiers }: { e: DensityEvent; compact: boolean; tiers: VolumeTier[] | undefined }) {
  // подписка на тик — обновляет возраст только этой строки, без ререндера окна
  const tick = useLive((s) => s.tick)
  void tick
  const now = Date.now()
  const ageMs = Math.max(0, now - e.createdAt)
  const color = EX_MAP[e.exchange].color
  const volColor = volumeTierColor(tiers, e.volumeUsd)
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('group relative flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2 transition-colors hover:border-[color-mix(in_srgb,var(--acc)_35%,transparent)]', compact ? 'py-1' : 'py-1.5')}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <TickerCopy symbol={e.symbol} className="w-[62px] shrink-0 truncate text-[11px] font-black" />
      <span
        className="shrink-0 rounded px-1 py-0.5 text-[8px] font-black"
        style={{ background: e.market === 'F' ? '#f59e0b1e' : '#22d3ee1e', color: e.market === 'F' ? '#f59e0b' : '#22d3ee' }}
      >
        {e.market}
      </span>
      <span
        className="cp-num w-[52px] shrink-0 text-[11px] font-black"
        style={volColor ? { color: volColor, textShadow: `0 0 14px ${volColor}66` } : undefined}
      >
        {fmtUsd(e.volumeUsd)}
      </span>
      <span className="cp-num w-[38px] shrink-0 text-right text-[11px] font-bold" style={{ color: 'var(--acc)' }}>{e.strengthPct.toFixed(2)}%</span>
      <span className="cp-num hidden w-[54px] shrink-0 text-right text-[10px] text-[var(--muted-foreground)] 2xl:block">
        {fmtPrice(e.levelPrice)}
      </span>
      <span className="w-[38px] shrink-0 text-right text-[9px] font-black" style={{ color: e.direction === 'LONG' ? 'var(--pos)' : 'var(--neg)' }}>
        {e.direction}
      </span>
      <span
        className="cp-num flex w-[46px] shrink-0 items-center justify-center gap-0.5 rounded-md bg-[color-mix(in_srgb,var(--pos)_10%,transparent)] px-1 py-0.5 text-[10px] font-bold"
        style={{ color: 'var(--pos)' }}
      >
        <Hourglass className="h-2.5 w-2.5" />{fmtAge(ageMs)}
      </span>
    </motion.div>
  )
}

// ─── Вкладка «Плотности» ──────────────────────────────────────────────

export function DensitiesView() {
  const densityWindows = useApp((s) => s.densityWindows)
  const compact = useApp((s) => s.effects.compact)

  return (
    <div>
      {/* Сетка окон — тулбар живёт в шапке приложения; 4 окна в ряд на широких экранах */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {densityWindows.map((w) => (
          <DensityWindowCard key={w.id} win={w} compact={compact} />
        ))}
      </div>
    </div>
  )
}

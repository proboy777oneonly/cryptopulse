'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import {
  Ban, Ban as BanIcon, Coins, Layers, Plus, Power, Send, Settings2, Timer, Trash2, Volume2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { EX_MAP, fmtTime, fmtUsd, type DensityEvent, type DensityWindowConfig, type ExchangeId } from '@/engines/types'
import { COIN_MAP } from '@/engines/coins'
import { SOUNDS, soundEngine } from '@/engines/sound'
import { toastSuccess } from '@/engines/notifier'
import { getHub } from '@/engines/hub'
import { EmptyState, useUptime } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

const LIFETIME_OPTIONS = [
  { value: '10', label: '10 сек' },
  { value: '30', label: '30 сек' },
  { value: '60', label: '1 мин' },
  { value: '300', label: '5 мин' },
]

// ─── Числовое поле с суффиксом ────────────────────────────────────────

function NumberField({ label, value, onChange, unit, step = 1 }: {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  step?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-[var(--muted-foreground)]">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cp-num pr-12"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--muted-foreground)]">{unit}</span>
      </div>
    </div>
  )
}

// ─── Настройки рынка (F или S) ────────────────────────────────────────

function MarketSettingsColumn({ win, market }: { win: DensityWindowConfig; market: 'f' | 's' }) {
  const updateDensityMarket = useApp((s) => s.updateDensityMarket)
  const s = win[market]
  const title = market === 'f' ? 'Фьючерсы (F)' : 'Спот (S)'
  const color = market === 'f' ? '#f59e0b' : '#22d3ee'
  const set = (patch: Partial<typeof s>) => updateDensityMarket(win.id, market, patch)

  return (
    <div className="space-y-3.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider" style={{ color }}>{title}</span>
        <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">
          {market === 'f' ? 'PERP · USDT' : 'SPOT · USDT'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Объём 24ч, мин." value={s.minVolume24h / 1e6} onChange={(v) => set({ minVolume24h: v * 1e6 })} unit="$M" step={0.5} />
        <NumberField label="Размер заявки, мин." value={s.minOrderUsd / 1e6} onChange={(v) => set({ minOrderUsd: v * 1e6 })} unit="$M" step={0.1} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Отклонение Bid" value={s.bidDepthPct} onChange={(v) => set({ bidDepthPct: v })} unit="%" step={0.5} />
        <NumberField label="Отклонение Ask" value={s.askDepthPct} onChange={(v) => set({ askDepthPct: v })} unit="%" step={0.5} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-[var(--muted-foreground)]">Срок жизни плотности</Label>
        <Select value={String(s.lifetimeSec)} onValueChange={(v) => set({ lifetimeSec: Number(v) })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LIFETIME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] text-[var(--muted-foreground)]">Сигнал</Label>
        <div className="flex items-center gap-2">
          <Select value={s.soundId} onValueChange={(v) => set({ soundId: v })}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
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
            className="shrink-0"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted-foreground)]">Громкость окна</span>
          <span className="cp-num font-bold" style={{ color: 'var(--acc)' }}>{s.volumePct}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={s.volumePct}
          onChange={(e) => set({ volumePct: Number(e.target.value) })}
          className="cp-range w-full"
          style={{ '--fill': `${s.volumePct}%` } as CSSProperties}
          aria-label="Громкость окна"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
        <span className="text-xs font-medium">Голосовые уведомления</span>
        <Switch checked={s.voice} onCheckedChange={(v) => set({ voice: v })} aria-label="Голос для рынка" />
      </div>

      <p className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
        Снапшот книги содержит ~1000 уровней. Фильтры применяются до сигнала, чтобы отсечь мелкие заявки.
      </p>
    </div>
  )
}

// ─── Диалог настроек окна ─────────────────────────────────────────────

function WindowSettingsDialog({ win, open, onOpenChange }: { win: DensityWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const meta = EX_MAP[win.exchange]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-y-auto rounded-2xl border-[var(--border)] bg-[var(--card-solid)]" style={{ maxHeight: '85vh', boxShadow: '0 40px 90px -30px var(--glow)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
            Настройки · {meta.name.toUpperCase()} · USDT
            <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
              режим: {win.mode === 'ALL' ? 'ВСЕ' : win.mode}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className={cn('grid gap-4', win.mode === 'ALL' ? 'md:grid-cols-2' : '')}>
          {win.mode === 'ALL' ? (
            <>
              <MarketSettingsColumn win={win} market="f" />
              <MarketSettingsColumn win={win} market="s" />
            </>
          ) : (
            <MarketSettingsColumn win={win} market={win.mode === 'F' ? 'f' : 's'} />
          )}
        </div>
        {win.mode === 'ALL' && (
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">Настройки фьючерсов и спота независимы друг от друга</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Диалог тикеров окна ──────────────────────────────────────────────

function TickersDialog({ win, open, onOpenChange }: { win: DensityWindowConfig; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addTickerOverride, updateTickerOverride, removeTickerOverride, sendTicker, sendAllTickers, densityWindows } = useApp()
  const [addSym, setAddSym] = useState('')
  const [sendTargets, setSendTargets] = useState<Record<string, boolean>>({})
  const [sendSym, setSendSym] = useState<string | null>(null)

  const meta = EX_MAP[win.exchange]
  const hub = getHub()
  const available = useMemo(
    () => [...hub.sim.coinsOn(win.exchange, 'F'), ...hub.sim.coinsOn(win.exchange, 'S')].filter((s, i, a) => a.indexOf(s) === i).sort(),
    [win.exchange, hub],
  )
  const others = densityWindows.filter((w) => w.id !== win.id)
  const entries = Object.entries(win.tickers)

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSendSym(null); setSendTargets({}) } }}>
      <DialogContent className="max-w-xl overflow-y-auto rounded-2xl border-[var(--border)] bg-[var(--card-solid)]" style={{ maxHeight: '85vh' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <Coins className="h-4 w-4" style={{ color: meta.color }} />
            Тикеры окна · {meta.name.toUpperCase()}
            <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">{entries.length}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Добавление тикера */}
        <div className="flex items-center gap-2">
          <Select value={addSym} onValueChange={setAddSym}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Выберите монету для индивидуальных настроек" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {available.filter((s) => !win.tickers[s]).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="font-bold">{s}</span>
                  <span className="ml-2 text-xs text-[var(--muted-foreground)]">{COIN_MAP[s]?.name ?? ''}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!addSym} onClick={() => { addTickerOverride(win.id, addSym); setAddSym('') }}>
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>

        {/* Список тикеров */}
        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted-foreground)]">
              Индивидуальных тикеров нет — окно работает по общим фильтрам F/S.
              Добавьте монету, чтобы задать ей персональные пороги.
            </div>
          )}
          {entries.map(([sym, ovr]) => (
            <div key={sym} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">{sym}</span>
                {ovr.minVolume24h && <span className="cp-num rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">vol ≥ {fmtUsd(ovr.minVolume24h)}</span>}
                {ovr.minOrderUsd && <span className="cp-num rounded-md bg-[var(--card)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--muted-foreground)]">ord ≥ {fmtUsd(ovr.minOrderUsd)}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => { setSendSym(sym); setSendTargets({}) }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] transition-colors hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)]"
                    title="Отправить тикер в другие окна"
                  >
                    <Send className="h-3.5 w-3.5" style={{ color: 'var(--acc)' }} />
                  </button>
                  <button
                    onClick={() => removeTickerOverride(win.id, sym)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--destructive)] transition-colors hover:border-[var(--destructive)]"
                    title="Удалить тикер"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={ovr.enabled !== false} onCheckedChange={(v) => updateTickerOverride(win.id, sym, { enabled: v })} aria-label={`Включить ${sym}`} />
                  <span className="text-[11px] text-[var(--muted-foreground)]">{ovr.enabled === false ? 'выкл' : 'вкл'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" step={0.5} min={0} placeholder="Объём"
                    value={ovr.minVolume24h ? ovr.minVolume24h / 1e6 : ''}
                    onChange={(e) => updateTickerOverride(win.id, sym, { minVolume24h: e.target.value === '' ? undefined : Number(e.target.value) * 1e6 })}
                    className="cp-num h-8 text-[11px]"
                  />
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)]">$M</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" step={0.1} min={0} placeholder="Заявка"
                    value={ovr.minOrderUsd ? ovr.minOrderUsd / 1e6 : ''}
                    onChange={(e) => updateTickerOverride(win.id, sym, { minOrderUsd: e.target.value === '' ? undefined : Number(e.target.value) * 1e6 })}
                    className="cp-num h-8 text-[11px]"
                  />
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)]">$M</span>
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
  const [addSym, setAddSym] = useState('')
  const meta = EX_MAP[win.exchange]
  const hub = getHub()
  const available = useMemo(() => hub.sim.coinsOn(win.exchange, tab).sort(), [win.exchange, tab, hub])
  const list = tab === 'F' ? win.blacklistF : win.blacklistS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-[var(--border)] bg-[var(--card-solid)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <Ban className="h-4 w-4 text-[var(--destructive)]" />
            Чёрный список · {meta.name.toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'F' | 'S')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="F">Фьючерсы ({win.blacklistF.length})</TabsTrigger>
            <TabsTrigger value="S">Спот ({win.blacklistS.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={addSym} onValueChange={setAddSym}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Монета для блокировки" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {available.filter((s) => !list.includes(s)).map((s) => (
                <SelectItem key={s} value={s}>{s} · {COIN_MAP[s]?.name ?? ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!addSym} onClick={() => { toggleBlacklist(win.id, tab, addSym); setAddSym('') }}>
            <BanIcon className="mr-1 h-3.5 w-3.5" /> В список
          </Button>
        </div>
        <div className="flex min-h-[60px] flex-wrap gap-1.5 rounded-xl border border-dashed border-[var(--border)] p-3">
          {list.length === 0 && <span className="w-full py-2 text-center text-xs text-[var(--muted-foreground)]">Список пуст — блокировка монет убирает их сигналы из окна</span>}
          {list.map((s) => (
            <span key={s} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold" style={{ borderColor: 'color-mix(in srgb, var(--destructive) 40%, transparent)', background: 'color-mix(in srgb, var(--destructive) 8%, transparent)', color: 'var(--destructive)' }}>
              {s}
              <button onClick={() => toggleBlacklist(win.id, tab, s)} aria-label={`Разблокировать ${s}`} className="transition-transform hover:scale-125">
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

// ─── Окно плотностей (карточка биржи) ─────────────────────────────────

function DensityWindowCard({ win, compact }: { win: DensityWindowConfig; compact: boolean }) {
  const setDensityMode = useApp((s) => s.setDensityMode)
  const updateDensityWindow = useApp((s) => s.updateDensityWindow)
  const removeDensityWindow = useApp((s) => s.removeDensityWindow)
  const densityWindows = useApp((s) => s.densityWindows)
  const events = useLive((s) => s.densityEvents[win.id] ?? [])
  const tick = useLive((s) => s.tick)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tickersOpen, setTickersOpen] = useState(false)
  const [blacklistOpen, setBlacklistOpen] = useState(false)
  const [sendFor, setSendFor] = useState<string | null>(null)
  const [sendTargets, setSendTargets] = useState<Record<string, boolean>>({})

  const meta = EX_MAP[win.exchange]
  const filtered = useMemo(
    () => events.filter((e) => (win.mode === 'ALL' ? true : e.market === win.mode)).sort((a, b) => b.createdAt - a.createdAt),
    [events, win.mode],
  )
  void tick

  const modeBtn = (m: 'ALL' | 'F' | 'S', label: string) => (
    <button
      key={m}
      onClick={() => setDensityMode(win.id, m)}
      className={cn(
        'flex h-6 min-w-7 items-center justify-center rounded-md px-1.5 text-[10px] font-black transition-all',
        win.mode === m ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
      )}
      style={win.mode === m ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', boxShadow: '0 0 12px -3px var(--glow)' } : undefined}
      aria-pressed={win.mode === m}
    >
      {label}
    </button>
  )

  return (
    <div className={cn('cp-border-glow flex flex-col rounded-2xl bg-card', compact ? '' : '')} style={{ borderTop: `2px solid ${meta.color}66` }}>
      {/* Заголовок окна */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
        <span className="truncate text-sm font-black tracking-wide">{meta.name.toUpperCase()}</span>
        <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {modeBtn('F', 'F')}
          {modeBtn('S', 'S')}
          {modeBtn('ALL', 'ВСЕ')}
        </div>
        <span className="cp-num ml-auto rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold" style={{ color: filtered.length > 0 ? meta.color : 'var(--muted-foreground)' }}>
          {filtered.length}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setTickersOpen(true)} title="Тикеры окна" aria-label="Тикеры окна" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)]">
            <Coins className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setBlacklistOpen(true)} title="Чёрный список" aria-label="Чёрный список" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--destructive)]">
            <Ban className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setSettingsOpen(true)} title="Настройки окна" aria-label="Настройки окна" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--acc)]">
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => updateDensityWindow(win.id, { enabled: !win.enabled })}
            title={win.enabled ? 'Выключить окно' : 'Включить окно'}
            aria-label="Питание окна"
            className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)]', win.enabled ? 'text-[var(--pos)]' : 'text-[var(--muted-foreground)]')}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          {densityWindows.length > 1 && (
            <button onClick={() => removeDensityWindow(win.id)} title="Удалить окно" aria-label="Удалить окно" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--destructive)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Таблица событий */}
      <div className="flex-1 p-2">
        {!win.enabled ? (
          <EmptyState icon={<Power className="h-8 w-8" />} title="Окно отключено" hint="Включите окно, чтобы возобновить поток плотностей" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Layers className="h-8 w-8" />} title="Нет плотностей по фильтрам" hint="Ждём крупные лимитные заявки, подходящие под ваши пороги…" />
        ) : (
          <div className="space-y-1">
            {filtered.slice(0, 12).map((e) => (
              <DensityRow key={e.id} e={e} compact={compact} onSend={() => { setSendFor(e.symbol); setSendTargets({}) }} />
            ))}
            {filtered.length > 12 && (
              <div className="py-1 text-center text-[10px] text-[var(--muted-foreground)]">+{filtered.length - 12} ещё — настройте фильтры точнее</div>
            )}
          </div>
        )}
      </div>

      <WindowSettingsDialog win={win} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TickersDialog win={win} open={tickersOpen} onOpenChange={setTickersOpen} />
      <BlacklistDialog win={win} open={blacklistOpen} onOpenChange={setBlacklistOpen} />

      {/* Быстрая отправка тикера из строки */}
      <Dialog open={!!sendFor} onOpenChange={(v) => { if (!v) { setSendFor(null); setSendTargets({}) } }}>
        <DialogContent className="max-w-sm rounded-2xl border-[var(--border)] bg-[var(--card-solid)]">
          <DialogHeader>
            <DialogTitle className="text-base">Отправить {sendFor} в окна</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-1.5">
            {densityWindows.filter((w) => w.id !== win.id).map((w) => (
              <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs font-semibold">
                <Checkbox checked={!!sendTargets[w.id]} onCheckedChange={(v) => setSendTargets((p) => ({ ...p, [w.id]: !!v }))} />
                {EX_MAP[w.exchange].name}
              </label>
            ))}
          </div>
          <Button
            disabled={Object.values(sendTargets).every((v) => !v)}
            onClick={() => {
              const targets = Object.entries(sendTargets).filter(([, v]) => v).map(([k]) => k)
              useApp.getState().sendTicker(win.id, sendFor!, targets)
              toastSuccess('Тикер отправлен', `${sendFor} добавлен в ${targets.length} окон`)
              setSendFor(null)
              setSendTargets({})
            }}
          >
            <Send className="mr-2 h-4 w-4" /> Отправить
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DensityRow({ e, compact, onSend }: { e: DensityEvent; compact: boolean; onSend: () => void }) {
  const now = Date.now()
  const left = Math.max(0, (e.expiresAt - now) / (e.lifetimeSec * 1000))
  const color = EX_MAP[e.exchange].color
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--acc)_35%,transparent)]', compact ? 'py-1' : 'py-1.5')}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="w-12 shrink-0 truncate text-xs font-black">{e.symbol}</span>
      <span
        className="shrink-0 rounded px-1 py-0.5 text-[8px] font-black"
        style={{ background: e.market === 'F' ? '#f59e0b1e' : '#22d3ee1e', color: e.market === 'F' ? '#f59e0b' : '#22d3ee' }}
      >
        {e.market}
      </span>
      <span className="cp-num w-14 shrink-0 text-xs font-semibold">{fmtUsd(e.volumeUsd)}</span>
      <span className="cp-num w-11 shrink-0 text-right text-xs font-bold" style={{ color: 'var(--acc)' }}>{e.strengthPct.toFixed(2)}%</span>
      <span className="w-12 shrink-0 text-right text-[10px] font-black" style={{ color: e.direction === 'LONG' ? 'var(--pos)' : 'var(--neg)' }}>
        {e.direction}
      </span>
      {!compact && <span className="cp-num hidden w-11 shrink-0 text-right text-[10px] text-[var(--muted-foreground)] md:block">{fmtTime(e.createdAt)}</span>}
      <div className="hidden h-1 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--border)] md:block" title={`Осталось ${Math.ceil(left * e.lifetimeSec)}с`}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${left * 100}%`, background: left > 0.4 ? 'var(--pos)' : 'var(--neg)' }} />
      </div>
      <button
        onClick={onSend}
        className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--muted-foreground)] opacity-0 transition-all group-hover:opacity-100 hover:border-[color-mix(in_srgb,var(--acc)_50%,transparent)] hover:text-[var(--acc)]"
        title="Отправить тикер в другие окна"
        aria-label="Отправить тикер"
      >
        <Send className="h-3 w-3" />
      </button>
    </motion.div>
  )
}

// ─── Вкладка «Плотности» ──────────────────────────────────────────────

export function DensitiesView() {
  const densityWindows = useApp((s) => s.densityWindows)
  const addDensityWindow = useApp((s) => s.addDensityWindow)
  const sendAllTickers = useApp((s) => s.sendAllTickers)
  const compact = useApp((s) => s.effects.compact)
  const densityEvents = useLive((s) => s.densityEvents)
  const uptime = useUptime()

  const [addOpen, setAddOpen] = useState(false)
  const [addEx, setAddEx] = useState('')

  const totalActive = useMemo(
    () => Object.values(densityEvents).reduce((acc, list) => acc + list.length, 0),
    [densityEvents],
  )
  const unused = useMemo(
    () => Object.values(EX_MAP).filter((e) => !densityWindows.some((w) => w.exchange === e.id)),
    [densityWindows],
  )

  return (
    <div className="space-y-4">
      {/* Тулбар */}
      <div className="cp-border-glow flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Layers className="h-4 w-4" style={{ color: 'var(--acc)' }} />
          {densityWindows.length} окон · 1 окно = 1 биржа
        </div>
        <div className="cp-num flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-1.5 text-xs">
          <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} />
          <span className="font-bold" style={{ color: 'var(--acc)' }}>{totalActive} активных</span>
        </div>
        <div className="cp-num flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-1.5 text-xs font-bold">
          <Timer className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> {uptime}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => {
              densityWindows.forEach((w) => sendAllTickers(w.id))
              toastSuccess('Синхронизация тикеров', 'Все тикеры отправлены во все окна')
            }}
            title="Каждое окно отправляет свои тикеры во все остальные"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" /> Все тикеры → все окна
          </Button>
          <Button size="sm" disabled={unused.length === 0 || densityWindows.length >= 8} onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Добавить окно
          </Button>
        </div>
      </div>

      {/* Сетка окон */}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {densityWindows.map((w) => (
          <DensityWindowCard key={w.id} win={w} compact={compact} />
        ))}
      </div>

      {/* Диалог добавления окна */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setAddEx('') }}>
        <DialogContent className="max-w-xs rounded-2xl border-[var(--border)] bg-[var(--card-solid)]">
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
          <Button disabled={!addEx} onClick={() => { addDensityWindow(addEx as ExchangeId); setAddOpen(false); setAddEx(''); toastSuccess('Окно создано', `${EX_MAP[addEx as ExchangeId].name} подключено`) }}>
            <Plus className="mr-2 h-4 w-4" /> Создать окно
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useMemo, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Gauge, Repeat, Settings2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { EXCHANGES, EX_MAP, fmtPrice, fmtTimeSec, fmtUsd } from '@/engines/types'
import { EmptyState, ExBadge } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

export function ArbitrageView() {
  const arbitrage = useApp((s) => s.arbitrage)
  const updateArbitrage = useApp((s) => s.updateArbitrage)
  const opps = useLive((s) => s.arbitrageOpps)

  const maxSpread = useMemo(() => Math.max(...opps.map((o) => o.spreadPct), 1), [opps])
  const enabledCount = Object.values(arbitrage.exchanges).filter(Boolean).length

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      {/* Настройки */}
      <div className="cp-border-glow h-fit rounded-2xl bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Settings2 className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Настройки сканера
        </h3>

        <div className="mt-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Мин. спред, %</Label>
              <Input
                type="number" step={0.1} min={0} value={arbitrage.minSpreadPct}
                onChange={(e) => updateArbitrage({ minSpreadPct: Number(e.target.value) })}
                className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Мин. объём 24ч</Label>
              <div className="relative">
                <Input
                  type="number" step={1} min={0} value={arbitrage.minVol24h / 1e6}
                  onChange={(e) => updateArbitrage({ minVol24h: Number(e.target.value) * 1e6 })}
                  className="h-11 rounded-xl border-[var(--border)] bg-[var(--card)] pr-14 text-[15px] font-bold text-[var(--foreground)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted-foreground)]">$M</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-[var(--muted-foreground)]">Кулдаун уведомлений</Label>
              <span className="cp-num text-sm font-black" style={{ color: 'var(--acc)' }}>{arbitrage.cooldownSec} с</span>
            </div>
            <input
              type="range" min={15} max={600} step={15} value={arbitrage.cooldownSec}
              onChange={(e) => updateArbitrage({ cooldownSec: Number(e.target.value) })}
              className="cp-range w-full"
              style={{ '--fill': `${((arbitrage.cooldownSec - 15) / 585) * 100}%` } as CSSProperties}
              aria-label="Кулдаун уведомлений арбитража"
            />
            <p className="text-[10px] leading-tight text-[var(--muted-foreground)]">Минимальный интервал между сигналами по одной монете — защита от спама тостов и звуков</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-[var(--muted-foreground)]">Режим рынка</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['F', 'S'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => updateArbitrage({ mode: m })}
                  className={cn('rounded-lg border py-2 text-xs font-black transition-all', arbitrage.mode === m ? 'text-white' : 'text-[var(--muted-foreground)]')}
                  style={arbitrage.mode === m
                    ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', borderColor: 'transparent', boxShadow: '0 0 16px -4px var(--glow)' }
                    : { borderColor: 'var(--border)', background: 'var(--muted)' }}
                  aria-pressed={arbitrage.mode === m}
                >
                  {m === 'F' ? 'ФЬЮЧЕРСЫ' : 'СПОТ'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-[var(--muted-foreground)]">Биржи ({enabledCount}/8)</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {EXCHANGES.map((e) => {
                const on = arbitrage.exchanges[e.id]
                return (
                  <button
                    key={e.id}
                    onClick={() => updateArbitrage({ exchanges: { ...arbitrage.exchanges, [e.id]: !on } })}
                    className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold transition-all', on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]')}
                    style={{
                      borderColor: on ? `${e.color}55` : 'var(--border)',
                      background: on ? `${e.color}12` : 'var(--muted)',
                      boxShadow: on ? `0 0 12px -6px ${e.color}` : undefined,
                    }}
                    aria-pressed={on}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? e.color : 'var(--muted-foreground)' }} />
                    {e.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
          Сканер сравнивает реальные цены одной монеты на выбранных биржах каждые 6 секунд.
          Учитывайте комиссии вывода и перевода — чистый спред ниже биржевого.
        </div>
      </div>

      {/* Таблица возможностей */}
      <div className="cp-border-glow rounded-2xl bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Gauge className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Возможности арбитража
          </h3>
          <span className="cp-num rounded-md border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs font-bold" style={{ color: opps.length > 0 ? 'var(--acc)' : 'var(--muted-foreground)' }}>
            {opps.length} активных
          </span>
          <span className="ml-auto text-[11px] text-[var(--muted-foreground)]">
            режим: {arbitrage.mode === 'F' ? 'фьючерсы' : 'спот'} · спред ≥ {arbitrage.minSpreadPct}%
          </span>
        </div>

        <div className="mt-4">
          {opps.length === 0 ? (
            <EmptyState
              icon={<Repeat className="h-10 w-10" />}
              title="Спредов по фильтрам нет"
              hint="Попробуйте снизить минимальный спред или объём — расхождения между биржами появляются постоянно"
            />
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[64px_1fr_1fr_80px_88px] gap-2 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                <span>Монета</span>
                <span>Покупка</span>
                <span>Продажа</span>
                <span className="text-right">Спред</span>
                <span className="hidden text-right sm:block">Объём 24ч</span>
              </div>
              {opps.map((o, i) => (
                <motion.div
                  key={o.id}
                  layout="position"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-[64px_1fr_1fr_80px_88px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--acc)_35%,transparent)]"
                >
                  <span className="text-sm font-black">{o.symbol}</span>
                  <span className="flex items-center gap-2 text-xs">
                    <ExBadge ex={o.buyExchange} size="sm" />
                    <span className="cp-num hidden font-semibold md:block">{fmtPrice(o.buyPrice)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <ArrowRight className="h-3 w-3 text-[var(--muted-foreground)]" />
                    <ExBadge ex={o.sellExchange} size="sm" />
                    <span className="cp-num hidden font-semibold md:block">{fmtPrice(o.sellPrice)}</span>
                  </span>
                  <span className="text-right">
                    <span className="cp-num text-sm font-black" style={{ color: o.spreadPct >= 1.5 ? 'var(--pos)' : 'var(--acc)' }}>
                      {o.spreadPct.toFixed(2)}%
                    </span>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full" style={{ width: `${(o.spreadPct / maxSpread) * 100}%`, background: 'linear-gradient(90deg, var(--acc), var(--acc-2))' }} />
                    </div>
                  </span>
                  <span className="cp-num hidden text-right text-[11px] text-[var(--muted-foreground)] sm:block">{fmtUsd(o.vol24h)}</span>
                  <span className="sr-only">{fmtTimeSec(o.time)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


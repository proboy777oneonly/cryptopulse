'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { EX_MAP, type ExchangeId } from '@/engines/types'
import { useLive } from '@/stores/live-store'
import { cn } from '@/lib/utils'

// ─── Тикер с копированием по клику ────────────────────────────────────

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * Клик по тикеру — копирование в буфер обмена с короткой вспышкой «✓».
 * inherits текущий шрифт/размер; выглядит как обычный текст.
 * display — что показывать (напр. базовое имя без USDT), копируется всегда symbol.
 */
export function TickerCopy({ symbol, className, title, display }: { symbol: string; className?: string; title?: string; display?: string }) {
  const [copied, setCopied] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (t.current) clearTimeout(t.current) }, [])
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void copyText(symbol).then((ok) => {
          if (!ok) return
          setCopied(true)
          if (t.current) clearTimeout(t.current)
          t.current = setTimeout(() => setCopied(false), 900)
        })
      }}
      className={cn('cursor-copy select-text transition-colors', className)}
      aria-label={title ?? `Копировать ${symbol}`}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1" style={{ color: 'var(--pos)' }}>
          <Check className="h-3 w-3" strokeWidth={3} />
          <span className="sr-only">скопировано</span>
        </span>
      ) : (display ?? symbol)}
    </button>
  )
}

/** BTCUSDT → BTC / USDT; неизвестный квонт возвращается целиком в базе */
export function splitQuote(symbol: string): { base: string; quote: string } {
  for (const q of ['USDT', 'USDC', 'BUSD', 'USD']) {
    if (symbol.length > q.length && symbol.endsWith(q)) {
      return { base: symbol.slice(0, -q.length), quote: q }
    }
  }
  return { base: symbol, quote: '' }
}

// ─── Бейдж биржи ──────────────────────────────────────────────────────

export function ExBadge({ ex, size = 'md' }: { ex: ExchangeId; size?: 'sm' | 'md' }) {
  const meta = EX_MAP[ex]
  if (!meta) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
      )}
      style={{ color: meta.color, borderColor: `${meta.color}44`, background: `${meta.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {ex === 'HL' ? 'HYPERLIQ' : ex === 'ASTER' ? 'ASTER' : meta.name}
    </span>
  )
}

// ─── Спарклайн ────────────────────────────────────────────────────────

export function Sparkline({
  data, width = 96, height = 28, positive, className,
}: { data: number[]; width?: number; height?: number; positive?: boolean; className?: string }) {
  if (!data || data.length < 2) return <div style={{ width, height }} className={className} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`)
  const pos = positive ?? data[data.length - 1] >= data[0]
  const color = pos ? 'var(--pos)' : 'var(--neg)'
  const id = `sg-${pos ? 'p' : 'n'}`
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Анимированное число ──────────────────────────────────────────────

export function AnimatedNumber({ value, format }: { value: number; format?: (v: number) => string }) {
  const [display, setDisplay] = useState(value)
  const ref = useRef(value)
  useEffect(() => {
    const from = ref.current
    const to = value
    if (from === to) return
    const start = performance.now()
    const dur = 500
    let raf = 0
    const frame = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * eased
      ref.current = v
      setDisplay(v)
      if (p < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className="cp-num">{format ? format(display) : Math.round(display).toLocaleString('ru-RU')}</span>
}

// ─── Датчик «Страх и жадность» ───────────────────────────────────────

export function FearGreedGauge({ value, size = 150 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value))
  // дуга идёт слева (0) через верх (50) направо (100):
  // стрелка из «базы» вправо → поворот -180° при 0, 0° при 100
  const angle = -180 + (v / 100) * 180
  const color = v <= 24 ? '#f43f5e' : v <= 44 ? '#fb923c' : v <= 55 ? '#fbbf24' : v <= 74 ? '#a3e635' : '#34d399'
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2 + 6
  const arcPath = (from: number, to: number) => {
    const a1 = Math.PI + (from / 100) * Math.PI
    const a2 = Math.PI + (to / 100) * Math.PI
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }
  // мелкие деления каждые 12.5 + крупные на 0/25/50/75/100
  const minorTicks = [12.5, 37.5, 62.5, 87.5]
  const ticks = [0, 25, 50, 75, 100]
  const tip = r - 12
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path d={arcPath(0, 100)} fill="none" stroke="var(--muted)" strokeWidth="10" strokeLinecap="round" />
        {/* активный сектор до текущего значения */}
        <path d={arcPath(0, v)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" opacity="0.9" style={{ filter: `drop-shadow(0 0 8px ${color}88)`, transition: 'd 0.8s' }} />
        <path d={arcPath(0, 25)} fill="none" stroke="#f43f5e" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
        <path d={arcPath(25, 45)} fill="none" stroke="#fb923c" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
        <path d={arcPath(45, 55)} fill="none" stroke="#fbbf24" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
        <path d={arcPath(55, 75)} fill="none" stroke="#a3e635" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
        <path d={arcPath(75, 100)} fill="none" stroke="#34d399" strokeWidth="10" strokeLinecap="round" opacity="0.22" />
        {/* мелкие деления */}
        {minorTicks.map((t) => {
          const a = Math.PI + (t / 100) * Math.PI
          return (
            <line
              key={t}
              x1={cx + (r - 7) * Math.cos(a)} y1={cy + (r - 7) * Math.sin(a)}
              x2={cx + (r - 11) * Math.cos(a)} y2={cy + (r - 11) * Math.sin(a)}
              stroke="var(--muted-foreground)" strokeWidth="1" strokeLinecap="round" opacity="0.35"
            />
          )
        })}
        {/* крупные деления */}
        {ticks.map((t) => {
          const a = Math.PI + (t / 100) * Math.PI
          const x1 = cx + (r - 7) * Math.cos(a)
          const y1 = cy + (r - 7) * Math.sin(a)
          const x2 = cx + (r - 13) * Math.cos(a)
          const y2 = cy + (r - 13) * Math.sin(a)
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
        })}
        {/* подписи краёв шкалы */}
        <text x={cx - r - 1} y={cy + 13} textAnchor="middle" className="cp-num" fontSize="8.5" fill="var(--muted-foreground)" opacity="0.8">0</text>
        <text x={cx + r + 1} y={cy + 13} textAnchor="middle" className="cp-num" fontSize="8.5" fill="var(--muted-foreground)" opacity="0.8">100</text>
        {/* стрелка: сужающееся остриё + противовес */}
        <g transform={`rotate(${angle} ${cx} ${cy})`} style={{ transition: 'transform 0.9s cubic-bezier(0.34, 1.4, 0.64, 1)' }}>
          <path
            d={`M ${cx + tip} ${cy} L ${cx - 9} ${cy - 3} L ${cx - 12} ${cy} L ${cx - 9} ${cy + 3} Z`}
            fill={color}
            stroke={color}
            strokeWidth="0.5"
            style={{ filter: `drop-shadow(0 0 5px ${color}aa)` }}
          />
          <circle cx={cx} cy={cy} r="4.5" fill="var(--card-solid)" stroke={color} strokeWidth="2" />
        </g>
      </svg>
      <div className="-mt-1.5 flex flex-col items-center">
        <span className="cp-num text-3xl font-black" style={{ color, textShadow: `0 0 18px ${color}66` }}>{Math.round(v)}</span>
      </div>
    </div>
  )
}

// ─── Строка-бар для топов (скользящий бар) ────────────────────────────

export function SlideBar({
  pct, max, positive, delay = 0,
}: { pct: number; max: number; positive?: boolean; delay?: number }) {
  const width = Math.max(3, Math.min(100, (Math.abs(pct) / max) * 100))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${width}%`,
          background: positive ? 'linear-gradient(90deg, color-mix(in srgb, var(--pos) 55%, transparent), var(--pos))' : 'linear-gradient(90deg, color-mix(in srgb, var(--neg) 55%, transparent), var(--neg))',
          boxShadow: `0 0 8px -1px ${positive ? 'var(--pos)' : 'var(--neg)'}`,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  )
}

// ─── Карточка-статистика ──────────────────────────────────────────────

export function StatCard({
  label, value, sub, icon, accent, children,
}: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div className="cp-border-glow relative overflow-hidden rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{label}</div>
          <div className="cp-num mt-1.5 truncate text-2xl font-bold">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</div>}
        </div>
        {icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{ borderColor: accent ? `${accent}44` : 'var(--border)', background: accent ? `${accent}14` : 'var(--muted)', color: accent ?? 'var(--acc)' }}
          >
            {icon}
          </div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

// ─── Цвет процента ────────────────────────────────────────────────────

export function Pct({ v, className, bold }: { v: number; className?: string; bold?: boolean }) {
  return (
    <span className={cn('cp-num', bold && 'font-bold', className)} style={{ color: v >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
      {v >= 0 ? '+' : ''}
      {v.toFixed(2)}%
    </span>
  )
}

// ─── Пустое состояние ─────────────────────────────────────────────────

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="text-[var(--muted-foreground)] opacity-60">{icon}</div>}
      <div className="text-sm font-medium text-[var(--muted-foreground)]">{title}</div>
      {hint && <div className="max-w-[320px] text-xs text-[var(--muted-foreground)] opacity-70">{hint}</div>}
    </div>
  )
}

// ─── Счётчик аптайма сессии движков ───────────────────────────────────

export function useUptime(): string {
  const sessionStart = useLive((s) => s.sessionStart)
  const tick = useLive((s) => s.tick)
  return useMemo(() => {
    const s = Math.max(0, Math.floor((Date.now() - sessionStart) / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }, [sessionStart, tick])
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EX_MAP, type ExchangeId } from '@/engines/types'
import { useLive } from '@/stores/live-store'
import { cn } from '@/lib/utils'

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
  const angle = -90 + (v / 100) * 180
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
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path d={arcPath(0, 100)} fill="none" stroke="var(--muted)" strokeWidth="9" strokeLinecap="round" />
        <path d={arcPath(0, 25)} fill="none" stroke="#f43f5e" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <path d={arcPath(25, 45)} fill="none" stroke="#fb923c" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <path d={arcPath(45, 55)} fill="none" stroke="#fbbf24" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <path d={arcPath(55, 75)} fill="none" stroke="#a3e635" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <path d={arcPath(75, 100)} fill="none" stroke="#34d399" strokeWidth="9" strokeLinecap="round" opacity="0.55" />
        <g transform={`rotate(${angle} ${cx} ${cy})`} style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <line x1={cx} y1={cy} x2={cx + r - 14} y2={cy} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          <circle cx={cx} cy={cy} r="5" fill={color} />
        </g>
      </svg>
      <div className="-mt-2 flex flex-col items-center">
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

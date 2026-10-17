'use client'

// ════════════════════════════════════════════════════════════════════
// Логотип CryptoPulse: пульс рынка, переходящий в свечу.
// Уникальный знак — кардиограмма + свеча на градиентном квадрате.
// ════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Путь пульса: ровно → провал → всплеск → выравнивание (viewBox 0 0 64 64) */
const PULSE_D = 'M9 37 H17 L21.5 29 L26 46 L31 22.5 L35.5 40 H39'
/** Свеча справа: тень + тело */
const CANDLE_WICK = 'M49.5 17 V50'
const CANDLE_BODY = 'M44.5 26 H54.5 V41 H44.5 Z'

export function CpMark({ className, animate = true }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      {/* пульс */}
      {animate ? (
        <motion.path
          d={PULSE_D}
          stroke="white"
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0.0, opacity: 0.4 }}
          animate={{ pathLength: [0, 1], opacity: [0.4, 1] }}
          transition={{ duration: 1.15, repeat: Infinity, repeatDelay: 0.9, ease: 'easeInOut' }}
        />
      ) : (
        <path d={PULSE_D} stroke="white" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* свеча */}
      <path d={CANDLE_WICK} stroke="white" strokeWidth={2.6} strokeLinecap="round" />
      {animate ? (
        <motion.rect
          x={44.5} y={26} width={10} height={15} rx={2.4}
          fill="white"
          initial={{ scaleY: 0.55, opacity: 0.6 }}
          animate={{ scaleY: [0.55, 1], opacity: [0.6, 1] }}
          style={{ transformOrigin: '49.5px 33.5px' }}
          transition={{ duration: 0.55, repeat: Infinity, repeatDelay: 1.5, ease: 'easeOut' }}
        />
      ) : (
        <rect x={44.5} y={26} width={10} height={15} rx={2.4} fill="white" />
      )}
      {/* живая точка на конце пульса */}
      {animate && (
        <>
          <motion.circle
            cx={39} cy={40} r={3.2} fill="white"
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.15, 0.6] }}
            transition={{ duration: 1.15, repeat: Infinity, repeatDelay: 0.9, times: [0, 0.18, 1] }}
          />
          <circle cx={39} cy={40} r={2.1} fill="white" />
        </>
      )}
    </svg>
  )
}

export function CpLogo({
  size = 40,
  animated = true,
  glow = true,
  radius,
  className,
}: {
  size?: number
  animated?: boolean
  glow?: boolean
  radius?: number
  className?: string
}) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', glow && 'cp-glow', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.31),
        background: 'linear-gradient(135deg, var(--acc) 0%, var(--acc-2) 100%)',
        boxShadow: glow ? `0 ${Math.round(size * 0.14)}px ${Math.round(size * 0.5)}px -${Math.round(size * 0.16)}px var(--glow)` : undefined,
      }}
      aria-label="CryptoPulse"
    >
      {/* внутренний блик */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: 'inherit',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.22), transparent 42%)',
        }}
      />
      <CpMark className="relative" animate={animated} />
      {/* белая окантовка */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: 'inherit',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
      />
    </span>
  )
}

/** Логотип + текстовая часть (сайдбар, шапки) */
export function CpWordmark({ size = 38, animated = true, className }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <CpLogo size={size} animated={animated} />
      <span className="leading-none">
        <span className="block text-[15px] font-black tracking-tight">
          Crypto<span style={{ color: 'var(--acc)' }}>Pulse</span>
        </span>
        <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          screener pro
        </span>
      </span>
    </span>
  )
}

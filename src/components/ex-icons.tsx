'use client'

// ════════════════════════════════════════════════════════════════════
// Фирменные знаки 8 бирж (упрощённые SVG-интерпретации брендов).
// Наследуют цвет через currentColor — красит родительский элемент.
// ════════════════════════════════════════════════════════════════════

import type { ExchangeId } from '@/engines/types'
import { cn } from '@/lib/utils'

type IconProps = { className?: string; style?: React.CSSProperties }

function Svg({ className, style, children, fill = true }: IconProps & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-[1em] w-[1em]', className)}
      style={style}
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={fill ? undefined : 2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** BINANCE — ромбы */
function BinanceMark(p: IconProps) {
  const d = (cx: number, cy: number, s: number) => `M${cx} ${cy - s} L${cx + s} ${cy} L${cx} ${cy + s} L${cx - s} ${cy} Z`
  return (
    <Svg {...p}>
      <path d={d(12, 12, 5.2)} />
      <path d={d(12, 3.4, 2.6)} />
      <path d={d(12, 20.6, 2.6)} />
      <path d={d(3.9, 12, 2.6)} />
      <path d={d(20.1, 12, 2.6)} />
    </Svg>
  )
}

/** BYBIT — угловатая лента-b */
function BybitMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 4.5 V19.5" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M8.2 11.4 L17.5 5.2 L20.4 7.2 L13.6 11.6 L20.4 16 L17.5 18 L8.2 11.4 Z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** OKX — пять квадратов */
function OkxMark(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.6" y="2.6" width="6.2" height="6.2" rx="1.2" />
      <rect x="15.2" y="2.6" width="6.2" height="6.2" rx="1.2" />
      <rect x="8.9" y="8.9" width="6.2" height="6.2" rx="1.2" />
      <rect x="2.6" y="15.2" width="6.2" height="6.2" rx="1.2" />
      <rect x="15.2" y="15.2" width="6.2" height="6.2" rx="1.2" />
    </Svg>
  )
}

/** GATE — круговая G со стрелкой */
function GateMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M16.8 7.4 A7 7 0 1 0 18.9 13.2 H12.4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M14.6 3.2 V7.6 H19" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** BITGET — двойной шеврон вперёд */
function BitgetMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.6 4.2 L11.2 10.8 L4.6 17.4 Z" />
      <path d="M12.4 4.2 L19 10.8 L12.4 17.4 Z" />
      <rect x="3.4" y="18.6" width="16.8" height="2" rx="1" />
    </Svg>
  )
}

/** KUCOIN — K с точкой */
function KucoinMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.2 3.8 V20.2" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M8.4 12.6 L18.6 4.2" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M8.4 12.6 L15.8 18.6" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <circle cx="18" cy="17" r="2.2" />
    </Svg>
  )
}

/** HYPERLIQUID — двойная волна */
function HyperliquidMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.8 9.2 Q6 4.6 9.4 9.2 T16 9.2 T21.6 9.2" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M2.8 15.4 Q6 10.8 9.4 15.4 T16 15.4 T21.6 15.4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  )
}

/** ASTER — четырёхлучевая звезда */
function AsterMark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.4 L14.2 9.8 L21.6 12 L14.2 14.2 L12 21.6 L9.8 14.2 L2.4 12 L9.8 9.8 Z" />
    </Svg>
  )
}

const MARKS: Record<ExchangeId, (p: IconProps) => React.ReactElement> = {
  BINANCE: BinanceMark,
  BYBIT: BybitMark,
  OKX: OkxMark,
  GATE: GateMark,
  BITGET: BitgetMark,
  KUKOIN: KucoinMark,
  HL: HyperliquidMark,
  ASTER: AsterMark,
}

/** Иконка биржи; size — в пикселях (по умолчанию 14) */
export function ExIcon({ ex, size = 14, className, style }: { ex: ExchangeId; size?: number; className?: string; style?: React.CSSProperties }) {
  const Mark = MARKS[ex]
  if (!Mark) return null
  return <Mark className={className} style={{ ...style, width: size, height: size }} />
}

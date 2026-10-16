'use client'

import { useMemo } from 'react'

// ════════════════════════════════════════════════════════════════════
// Генерируемые SVG-аватары: бот · зверёк · планета · геометрия · пиксели
// Детерминированы спецификацией («bot:3») + цветом профиля.
// ════════════════════════════════════════════════════════════════════

export const AVATAR_COLORS: Record<string, string> = {
  violet: '#8b5cf6', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
  cyan: '#06b6d4', fuchsia: '#d946ef', teal: '#14b8a6', orange: '#f97316',
}

/** [основной, тёмный, светлый] */
const PALETTES: Record<string, [string, string, string]> = {
  violet: ['#8b5cf6', '#4c1d95', '#c4b5fd'],
  emerald: ['#10b981', '#065f46', '#6ee7b7'],
  amber: ['#f59e0b', '#78350f', '#fcd34d'],
  rose: ['#f43f5e', '#881337', '#fda4af'],
  cyan: ['#06b6d4', '#155e75', '#67e8f9'],
  fuchsia: ['#d946ef', '#701a75', '#f0abfc'],
  teal: ['#14b8a6', '#134e4a', '#5eead4'],
  orange: ['#f97316', '#7c2d12', '#fdba74'],
}

export const AVATAR_STYLES = ['bot', 'critter', 'orb', 'geo', 'pixel'] as const
export type AvatarStyle = (typeof AVATAR_STYLES)[number]
export const STYLE_LABELS: Record<AvatarStyle, string> = {
  bot: 'Боты', critter: 'Зверята', orb: 'Планеты', geo: 'Геометрия', pixel: 'Пиксели',
}

export interface AvatarSpec {
  style: AvatarStyle
  variant: number
}

/** «bot:3» → спецификация; любой другой текст → null (классический эмодзи) */
export function parseAvatarSpec(emoji: string | undefined): AvatarSpec | null {
  if (!emoji) return null
  const m = /^(bot|critter|orb|geo|pixel):([0-9]+)$/.exec(emoji)
  if (!m) return null
  return { style: m[1] as AvatarStyle, variant: Number(m[2]) }
}

// ─── Детерминированный PRNG ──────────────────────────────────────────

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Стили ───────────────────────────────────────────────────────────

function BotAvatar({ p, gid }: { p: () => number; gid: string }) {
  const eye = Math.floor(p() * 4)
  const mouth = Math.floor(p() * 3)
  const antenna = p() > 0.5
  const ears = p() > 0.35
  return (
    <>
      <rect x="0" y="0" width="64" height="64" rx="15" fill={`url(#${gid})`} />
      <circle cx="32" cy="32" r="26" fill="#ffffff" opacity="0.05" />
      {antenna && (
        <>
          <line x1="32" y1="6" x2="32" y2="15" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
          <circle cx="32" cy="6" r="3.4" fill="var(--acc)" className="cp-avatar-tip" />
        </>
      )}
      {ears && (
        <>
          <rect x="5" y="27" width="6" height="12" rx="3" fill="#ffffff" opacity="0.22" />
          <rect x="53" y="27" width="6" height="12" rx="3" fill="#ffffff" opacity="0.22" />
        </>
      )}
      <rect x="13" y="16" width="38" height="34" rx="10" fill="#ffffff" opacity="0.13" />
      <rect x="13" y="16" width="38" height="34" rx="10" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.35" />
      {eye === 0 && (
        <>
          <circle cx="24" cy="30" r="4" fill="#ffffff" />
          <circle cx="40" cy="30" r="4" fill="#ffffff" />
          <circle cx="25.4" cy="28.8" r="1.3" fill="#0b0f1a" />
          <circle cx="41.4" cy="28.8" r="1.3" fill="#0b0f1a" />
        </>
      )}
      {eye === 1 && (
        <>
          <path d="M20 31 q4 -6 8 0" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M36 31 q4 -6 8 0" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {eye === 2 && (
        <>
          <rect x="19" y="26" width="26" height="9" rx="4.5" fill="#0b0f1a" opacity="0.55" />
          <circle cx="25" cy="30.5" r="2.6" fill="var(--acc)" />
          <circle cx="39" cy="30.5" r="2.6" fill="var(--acc)" />
        </>
      )}
      {eye === 3 && (
        <>
          <line x1="20" y1="29" x2="28" y2="31" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <line x1="44" y1="29" x2="36" y2="31" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      {mouth === 0 && <line x1="26" y1="42" x2="38" y2="42" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />}
      {mouth === 1 && <path d="M25 41 q7 6 14 0" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      {mouth === 2 && (
        <g fill="#ffffff" opacity="0.9">
          <rect x="24" y="40.5" width="4" height="4" rx="1" />
          <rect x="30" y="40.5" width="4" height="4" rx="1" />
          <rect x="36" y="40.5" width="4" height="4" rx="1" />
        </g>
      )}
    </>
  )
}

function CritterAvatar({ p, gid }: { p: () => number; gid: string }) {
  const ears = Math.floor(p() * 3) // кот · медведь · заяц
  const happy = p() > 0.4
  const blush = p() > 0.5
  return (
    <>
      <rect x="0" y="0" width="64" height="64" rx="15" fill={`url(#${gid})`} />
      <circle cx="32" cy="36" r="24" fill="#ffffff" opacity="0.05" />
      {ears === 0 && (
        <>
          <path d="M14 20 L21 6 L28 18 Z" fill="#ffffff" opacity="0.28" />
          <path d="M50 20 L43 6 L36 18 Z" fill="#ffffff" opacity="0.28" />
          <path d="M17 18 L21 10 L24 16.5 Z" fill="var(--acc)" opacity="0.8" />
          <path d="M47 18 L43 10 L40 16.5 Z" fill="var(--acc)" opacity="0.8" />
        </>
      )}
      {ears === 1 && (
        <>
          <circle cx="17" cy="14" r="7.5" fill="#ffffff" opacity="0.28" />
          <circle cx="47" cy="14" r="7.5" fill="#ffffff" opacity="0.28" />
          <circle cx="17" cy="14" r="3.4" fill="var(--acc)" opacity="0.75" />
          <circle cx="47" cy="14" r="3.4" fill="var(--acc)" opacity="0.75" />
        </>
      )}
      {ears === 2 && (
        <>
          <ellipse cx="20" cy="12" rx="4.6" ry="10" fill="#ffffff" opacity="0.28" transform="rotate(-8 20 12)" />
          <ellipse cx="44" cy="12" rx="4.6" ry="10" fill="#ffffff" opacity="0.28" transform="rotate(8 44 12)" />
          <ellipse cx="20" cy="13" rx="2.2" ry="6" fill="var(--acc)" opacity="0.7" transform="rotate(-8 20 13)" />
          <ellipse cx="44" cy="13" rx="2.2" ry="6" fill="var(--acc)" opacity="0.7" transform="rotate(8 44 13)" />
        </>
      )}
      <ellipse cx="32" cy="36" rx="19" ry="17.5" fill="#ffffff" opacity="0.16" />
      {happy ? (
        <>
          <path d="M20 32 q4 -5.5 8 0" stroke="#0b0f1a" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85" />
          <path d="M36 32 q4 -5.5 8 0" stroke="#0b0f1a" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85" />
        </>
      ) : (
        <>
          <circle cx="24" cy="32" r="3" fill="#0b0f1a" opacity="0.85" />
          <circle cx="40" cy="32" r="3" fill="#0b0f1a" opacity="0.85" />
          <circle cx="25" cy="31" r="0.9" fill="#ffffff" />
          <circle cx="41" cy="31" r="0.9" fill="#ffffff" />
        </>
      )}
      {blush && (
        <>
          <ellipse cx="17.5" cy="38" rx="3.6" ry="2.3" fill="var(--acc)" opacity="0.55" />
          <ellipse cx="46.5" cy="38" rx="3.6" ry="2.3" fill="var(--acc)" opacity="0.55" />
        </>
      )}
      <path d="M29 38.5 L35 38.5 L32 42 Z" fill="#0b0f1a" opacity="0.85" />
      <path d={happy ? 'M28 45 q4 3.4 8 0' : 'M29 46 q3 2 6 0'} stroke="#0b0f1a" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      <line x1="10" y1="36" x2="17" y2="37.5" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      <line x1="10" y1="41" x2="17" y2="40" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      <line x1="54" y1="36" x2="47" y2="37.5" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      <line x1="54" y1="41" x2="47" y2="40" stroke="#ffffff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
    </>
  )
}

function OrbAvatar({ p, gid }: { p: () => number; gid: string }) {
  const cx = 26 + p() * 12
  const cy = 30 + p() * 6
  const r = 12 + p() * 3
  const ringTilt = -30 + p() * 60
  const hasMoon = p() > 0.35
  const stars = Array.from({ length: 5 }, () => ({ x: 6 + p() * 52, y: 4 + p() * 56, s: 0.7 + p() * 1.1 }))
  return (
    <>
      <rect x="0" y="0" width="64" height="64" rx="15" fill="#0b1020" />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#ffffff" opacity={0.35 + (i % 3) * 0.2} />
      ))}
      <g transform={`rotate(${ringTilt} ${cx} ${cy})`}>
        <ellipse cx={cx} cy={cy} rx={r + 13} ry={r * 0.42} fill="none" stroke={`url(#${gid})`} strokeWidth="3.2" opacity="0.85" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.34} r={r * 0.34} fill="#ffffff" opacity="0.22" />
      <circle cx={cx + r * 0.3} cy={cy + r * 0.25} r={r * 0.16} fill="#0b1020" opacity="0.25" />
      <circle cx={cx - r * 0.05} cy={cy + r * 0.45} r={r * 0.11} fill="#0b1020" opacity="0.2" />
      <g transform={`rotate(${ringTilt} ${cx} ${cy})`}>
        <path
          d={`M ${cx - r - 13} ${cy} A ${r + 13} ${r * 0.42} 0 0 0 ${cx + r + 13} ${cy}`}
          fill="none" stroke="#ffffff" strokeWidth="3.2" opacity="0.35" strokeLinecap="round"
        />
      </g>
      {hasMoon && <circle cx={52 - p() * 8} cy={12 + p() * 10} r="3.2" fill="var(--acc)" opacity="0.9" />}
    </>
  )
}

function GeoAvatar({ p, gid }: { p: () => number; gid: string }) {
  const shapes = [
    <circle key="a" cx={24 + p() * 16} cy={26 + p() * 12} r={12 + p() * 6} fill={`url(#${gid})`} opacity="0.9" />,
    <rect key="b" x={16 + p() * 12} y={26 + p() * 8} width="20" height="20" rx="4" fill="#ffffff" opacity="0.16" transform={`rotate(${Math.floor(p() * 45)} 32 36)`} />,
    <circle key="c" cx={40 - p() * 8} cy={42 - p() * 6} r={7 + p() * 3} fill="none" stroke="var(--acc)" strokeWidth="3" opacity="0.85" />,
    <path key="d" d={`M ${20 + p() * 8} 48 L ${34 + p() * 6} 22 L ${46 - p() * 4} 48 Z`} fill="#ffffff" opacity="0.14" />,
  ]
  return (
    <>
      <rect x="0" y="0" width="64" height="64" rx="15" fill={`url(#${gid})`} opacity="0.55" />
      <rect x="0" y="0" width="64" height="64" rx="15" fill="#0b0f1a" opacity="0.25" />
      {shapes}
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={8 + p() * 48} cy={8 + p() * 48} r={1 + p() * 0.9} fill="#ffffff" opacity={0.25 + (i % 3) * 0.18} />
      ))}
    </>
  )
}

function PixelAvatar({ p, gid }: { p: () => number; gid: string }) {
  const cells: { x: number; y: number; c: number }[] = []
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const v = p()
      if (v < 0.42) continue
      const c = v > 0.78 ? 2 : 1
      cells.push({ x, y, c })
      if (x < 2) cells.push({ x: 4 - x, y, c })
    }
  }
  const px = (n: number) => 10 + n * 9
  return (
    <>
      <rect x="0" y="0" width="64" height="64" rx="15" fill={`url(#${gid})`} opacity="0.5" />
      <rect x="0" y="0" width="64" height="64" rx="15" fill="#0b0f1a" opacity="0.35" />
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={px(cell.x)} y={px(cell.y)}
          width="7.6" height="7.6" rx="1.8"
          fill={cell.c === 2 ? '#ffffff' : 'var(--acc)'}
          opacity={cell.c === 2 ? 0.92 : 0.95}
        />
      ))}
    </>
  )
}

// ─── Публичный компонент ─────────────────────────────────────────────

export function GeneratedAvatar({ spec, colorKey, size = 36, rounded }: {
  spec: AvatarSpec
  colorKey: string
  size?: number
  rounded?: number
}) {
  const palette = PALETTES[colorKey] ?? PALETTES.violet
  const gid = useMemo(() => `ag_${spec.style}_${spec.variant}_${colorKey}`, [spec, colorKey])
  const rng = useMemo(() => mulberry32(hashStr(`${spec.style}:${spec.variant}|${colorKey}`)), [spec, colorKey])
  // прогоняем PRNG один раз на рендер-функцию через замыкание
  const parts = useMemo(() => {
    const p = rng
    switch (spec.style) {
      case 'bot': return <BotAvatar p={p} gid={gid} />
      case 'critter': return <CritterAvatar p={p} gid={gid} />
      case 'orb': return <OrbAvatar p={p} gid={gid} />
      case 'geo': return <GeoAvatar p={p} gid={gid} />
      case 'pixel': return <PixelAvatar p={p} gid={gid} />
    }
  }, [spec, rng, gid])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ borderRadius: rounded ?? Math.max(8, size * 0.3), display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette[2]} />
          <stop offset="52%" stopColor={palette[0]} />
          <stop offset="100%" stopColor={palette[1]} />
        </linearGradient>
      </defs>
      {parts}
    </svg>
  )
}

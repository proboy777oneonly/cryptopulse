'use client'

import { toast } from 'sonner'
import { Activity, ArrowDown, ArrowRight, ArrowUpDown, ArrowUp, Layers, ListPlus, Newspaper, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { soundEngine } from './sound'
import { voiceEngine } from './voice'
import { EX_MAP, fmtUsd, type AppNotification, type NotifSeverity, type NotifType } from './types'
import { uid } from './types'
import { TickerCopy } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

export interface EmitOptions {
  type: NotifType
  severity: NotifSeverity
  title: string
  message: string
  windowId?: string
  soundId?: string
  volumePct?: number
  voice?: boolean
  voiceText?: string
  ticker?: string
  distPct?: number
  volumeUsd?: number
  direction?: 'LONG' | 'SHORT'
  changePct?: number
  spreadPct?: number
  exchange?: AppNotification['exchange']
  market?: AppNotification['market']
  vol24h?: number
}

const SEV_STYLE: Record<NotifSeverity, { color: string; iconBg: string; label: string }> = {
  info: { color: 'var(--acc)', iconBg: 'color-mix(in srgb, var(--acc) 14%, transparent)', label: 'ИНФО' },
  success: { color: '#34d399', iconBg: 'rgba(52, 211, 153, 0.14)', label: 'СИГНАЛ' },
  warning: { color: '#fbbf24', iconBg: 'rgba(251, 191, 36, 0.14)', label: 'ВАЖНО' },
  critical: { color: '#f43f5e', iconBg: 'rgba(244, 63, 94, 0.16)', label: 'КРИТИЧНО' },
}

const TYPE_META: Record<NotifType, { label: string; icon: typeof Layers }> = {
  density: { label: 'ПЛОТНОСТЬ', icon: Layers },
  movement: { label: 'ДВИЖЕНИЕ', icon: TrendingUp },
  arbitrage: { label: 'АРБИТРАЖ', icon: ArrowUpDown },
  news: { label: 'НОВОСТЬ', icon: Newspaper },
  listing: { label: 'ЛИСТИНГ', icon: ListPlus },
  system: { label: 'СИСТЕМА', icon: Activity },
}

/** Строка «тикер · размер · дистанция» + низ «бирза · объём 24ч» */
export function DensityBody({ n, large }: { n: AppNotification; large?: boolean }) {
  const short = n.direction === 'SHORT'
  const dirColor = short ? 'var(--neg)' : 'var(--pos)'
  const DirIcon = short ? TrendingDown : TrendingUp
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <TickerCopy symbol={n.ticker ?? ''} className={large ? 'text-[17px] font-black tracking-tight' : 'text-[15px] font-black tracking-tight'} />
        <span className={cn('cp-num font-black', large ? 'text-[17px]' : 'text-[15px]')} style={{ color: dirColor }}>{fmtUsd(n.volumeUsd ?? 0)}</span>
        <span className={cn('cp-num font-bold', large ? 'text-[13px]' : 'text-[12px]')} style={{ color: 'var(--acc)' }}>{(n.distPct ?? 0).toFixed(2)}%</span>
        <span
          className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wider"
          style={{ background: short ? 'color-mix(in srgb, var(--neg) 12%, transparent)' : 'color-mix(in srgb, var(--pos) 12%, transparent)', color: dirColor }}
        >
          <DirIcon className="h-3 w-3" /> {short ? 'SHORT' : 'LONG'}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.exchange ? EX_MAP[n.exchange]?.color : undefined }} />
        {n.exchange ? EX_MAP[n.exchange]?.name : ''} {n.market === 'F' ? 'фьючерсы' : 'спот'}
        <span className="opacity-40">·</span>
        <span className="cp-num">объём 24ч {fmtUsd(n.vol24h ?? 0)}</span>
      </div>
    </div>
  )
}

export function MovementBody({ n, large }: { n: AppNotification; large?: boolean }) {
  const up = (n.changePct ?? 0) >= 0
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <TickerCopy symbol={n.ticker ?? ''} className={large ? 'text-[17px] font-black tracking-tight' : 'text-[15px] font-black tracking-tight'} />
        <span className={cn('flex items-center gap-0.5 font-black', large ? 'text-[17px]' : 'text-[15px]')} style={{ color: up ? 'var(--pos)' : 'var(--neg)' }}>
          {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {Math.abs(n.changePct ?? 0).toFixed(2)}%
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.exchange ? EX_MAP[n.exchange]?.color : undefined }} />
        {n.exchange ? EX_MAP[n.exchange]?.name : ''} {n.market === 'F' ? 'фьючерсы' : 'спот'}
        <span className="opacity-40">·</span>
        <span className="cp-num">объём 24ч {fmtUsd(n.vol24h ?? 0)}</span>
      </div>
    </div>
  )
}

// Троттлинг тостов: не чаще 1 в 3 секунды на тип, чтобы не заливать экран
const lastToastAt = new Map<NotifType, number>()
const TOAST_THROTTLE_MS = 3000

function NotifToast({ n, toastId, dur }: { n: AppNotification; toastId: number | string; dur: number }) {
  const sev = SEV_STYLE[n.severity]
  const meta = TYPE_META[n.type]
  const Icon = meta.icon
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => toast.dismiss(toastId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toast.dismiss(toastId) }}
      className="cp-toast group relative w-[356px] max-w-[92vw] cursor-pointer select-none overflow-hidden rounded-2xl border bg-[var(--card-solid)] shadow-2xl transition-all hover:scale-[1.015] hover:border-[color-mix(in_srgb,var(--acc)_40%,var(--border))] active:scale-[0.99]"
      style={{ borderColor: 'color-mix(in srgb, ' + sev.color + ' 30%, var(--border))', boxShadow: `0 18px 50px -18px ${sev.color}55, 0 8px 24px -12px rgba(0,0,0,0.6)` }}
    >
      {/* левая полоса серьёзности */}
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${sev.color}, color-mix(in srgb, ${sev.color} 30%, transparent))` }} />

      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5 pl-5">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
          style={{ background: sev.iconBg, borderColor: `color-mix(in srgb, ${sev.color} 30%, transparent)`, color: sev.color }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.14em]" style={{ color: sev.color }}>{meta.label}</span>
            {(n.severity === 'critical' || n.severity === 'warning') && (
              <span className="rounded border border-[var(--border)] bg-[var(--muted)] px-1 py-px text-[8px] font-black tracking-wider text-[var(--muted-foreground)]">{sev.label}</span>
            )}
            <span className="cp-num ml-auto text-[10px] text-[var(--muted-foreground)]">
              {new Date(n.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          {n.type === 'density' && n.ticker ? (
            <div className="mt-1"><DensityBody n={n} /></div>
          ) : n.type === 'movement' && n.ticker ? (
            <div className="mt-1"><MovementBody n={n} /></div>
          ) : (
            <>
              <div className="mt-1 break-words text-[13px] font-bold leading-snug text-[var(--foreground)]">{n.title}</div>
              {n.message && <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">{n.message}</div>}
            </>
          )}
        </div>

        <button
          onClick={() => toast.dismiss(toastId)}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="Закрыть уведомление"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* полоса прогресса */}
      <div className="h-[2.5px] w-full bg-[var(--border)]" style={{ animationDuration: `${dur}ms` }}>
        <div className="animate-cp-toastbar h-full" style={{ background: `linear-gradient(90deg, ${sev.color}, color-mix(in srgb, ${sev.color} 40%, transparent))` }} />
      </div>
    </div>
  )
}

export function emitNotification(opts: EmitOptions) {
  const n: AppNotification = {
    id: uid('nf'),
    type: opts.type,
    severity: opts.severity,
    title: opts.title,
    message: opts.message,
    time: Date.now(),
    windowId: opts.windowId,
    read: false,
    ticker: opts.ticker,
    distPct: opts.distPct,
    volumeUsd: opts.volumeUsd,
    direction: opts.direction,
    changePct: opts.changePct,
    spreadPct: opts.spreadPct,
    exchange: opts.exchange,
    market: opts.market,
    vol24h: opts.vol24h,
  }

  // ── Журнал (лимит 300 записей; unread не может превысить длину журнала)
  const live = useLive.getState()
  const notifications = [n, ...live.notifications].slice(0, 300)
  useLive.setState({
    notifications,
    unread: notifications.filter((x) => !x.read).length,
    notifSessionCount: live.notifSessionCount + 1,
  })

  // ── Настройки пользователя (для старых профилей без новых типов — дефолт)
  const app = useApp.getState()
  const prefs = app.typePrefs[opts.type] ?? { toast: true, sound: true, voice: false }
  if (!prefs) return

  if (prefs.toast) {
    const last = lastToastAt.get(opts.type) ?? 0
    if (Date.now() - last > TOAST_THROTTLE_MS) {
      lastToastAt.set(opts.type, Date.now())
      const dur = Math.max(2, Math.min(15, app.toasts.duration)) * 1000
      toast.custom((id) => <NotifToast n={n} toastId={id} dur={dur} />, { duration: dur })
    }
  }
  if (prefs.sound) {
    const soundId = opts.soundId ?? app.soundByType[opts.type] ?? 'ding'
    soundEngine.play(soundId, opts.volumePct ?? app.volume)
  }
  if (opts.voice ?? prefs.voice) {
    if (opts.voiceText) voiceEngine.speak(opts.voiceText)
  }
}

export function toastInfo(title: string, message?: string) {
  toast.custom((id) => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'info', title, message: message ?? '', time: Date.now(), read: false }} toastId={id} dur={4000} />, { duration: 4000 })
}

export function toastSuccess(title: string, message?: string) {
  toast.custom((id) => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'success', title, message: message ?? '', time: Date.now(), read: false }} toastId={id} dur={4000} />, { duration: 4000 })
}

export function toastError(title: string, message?: string) {
  toast.custom((id) => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'critical', title, message: message ?? '', time: Date.now(), read: false }} toastId={id} dur={5000} />, { duration: 5000 })
}

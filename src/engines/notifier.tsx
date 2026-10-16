'use client'

import { toast } from 'sonner'
import { Activity, ArrowRight, ArrowUpDown, Layers, ListPlus, Newspaper, TrendingUp, X } from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { soundEngine } from './sound'
import { voiceEngine } from './voice'
import type { AppNotification, NotifSeverity, NotifType } from './types'
import { uid } from './types'

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
      className="cp-toast group relative w-[356px] max-w-[92vw] cursor-pointer select-none overflow-hidden rounded-2xl border bg-[var(--card-solid)] shadow-2xl transition-transform hover:scale-[1.015] active:scale-[0.99]"
      style={{ borderColor: 'color-mix(in srgb, ' + sev.color + ' 30%, var(--border))', boxShadow: `0 18px 50px -18px ${sev.color}55, 0 8px 24px -12px rgba(0,0,0,0.6)` }}
      title="Нажмите, чтобы закрыть"
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
            <span className="rounded border border-[var(--border)] bg-[var(--muted)] px-1 py-px text-[8px] font-black tracking-wider text-[var(--muted-foreground)]">{sev.label}</span>
            <span className="cp-num ml-auto text-[10px] text-[var(--muted-foreground)]">
              {new Date(n.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="mt-1 break-words text-[13px] font-bold leading-snug text-[var(--foreground)]">{n.title}</div>
          {n.message && <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">{n.message}</div>}
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
  }

  // ── Журнал
  const live = useLive.getState()
  useLive.setState({
    notifications: [n, ...live.notifications].slice(0, 300),
    unread: live.unread + 1,
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

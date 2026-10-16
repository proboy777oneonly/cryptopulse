'use client'

import { toast } from 'sonner'
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

const SEV_STYLE: Record<NotifSeverity, { border: string; icon: string; glow: string }> = {
  info: { border: 'l-border-[var(--acc)]', icon: 'ℹ', glow: '0 0 24px -6px var(--acc)' },
  success: { border: 'l-border-emerald-400', icon: '▲', glow: '0 0 24px -6px #34d399' },
  warning: { border: 'l-border-amber-400', icon: '◆', glow: '0 0 24px -6px #fbbf24' },
  critical: { border: 'l-border-rose-500', icon: '●', glow: '0 0 28px -6px #f43f5e' },
}

const TYPE_LABEL: Record<NotifType, string> = {
  density: 'ПЛОТНОСТЬ',
  movement: 'ДВИЖЕНИЕ',
  arbitrage: 'АРБИТРАЖ',
  news: 'НОВОСТЬ',
  system: 'СИСТЕМА',
}

// Троттлинг тостов: не чаще 1 в 3 секунды на тип, чтобы не заливать экран
const lastToastAt = new Map<NotifType, number>()
const TOAST_THROTTLE_MS = 3000

function NotifToast({ n }: { n: AppNotification }) {
  const sev = SEV_STYLE[n.severity]
  return (
    <div
      className="cp-toast group relative overflow-hidden rounded-xl border bg-[var(--card-solid)] shadow-lg"
      style={{ borderLeftWidth: 3, boxShadow: sev.glow }}
    >
      <div className={`absolute left-0 top-0 h-full w-[3px] ${sev.border.replace('l-border-', 'bg-')}`} />
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--muted)] text-sm font-bold" style={{ color: 'var(--acc)' }}>
          {sev.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--acc)' }}>{TYPE_LABEL[n.type]}</span>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {new Date(n.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[var(--fg)]">{n.title}</div>
          <div className="mt-0.5 text-xs leading-snug text-[var(--muted-foreground)]">{n.message}</div>
        </div>
      </div>
      <div className="h-[2px] w-full bg-[var(--border)]">
        <div className="h-full animate-cp-toastbar" style={{ background: 'var(--acc)' }} />
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

  // ── Настройки пользователя
  const app = useApp.getState()
  const prefs = app.typePrefs[opts.type]
  if (!prefs) return

  if (prefs.toast) {
    const last = lastToastAt.get(opts.type) ?? 0
    if (Date.now() - last > TOAST_THROTTLE_MS) {
      lastToastAt.set(opts.type, Date.now())
      const dur = Math.max(2, Math.min(15, app.toasts.duration)) * 1000
      toast.custom(() => <NotifToast n={n} />, { duration: dur })
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
  toast.custom(() => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'info', title, message: message ?? '', time: Date.now(), read: false }} />, {
    duration: 4000,
  })
}

export function toastSuccess(title: string, message?: string) {
  toast.custom(() => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'success', title, message: message ?? '', time: Date.now(), read: false }} />, {
    duration: 4000,
  })
}

export function toastError(title: string, message?: string) {
  toast.custom(() => <NotifToast n={{ id: uid('nf'), type: 'system', severity: 'critical', title, message: message ?? '', time: Date.now(), read: false }} />, {
    duration: 5000,
  })
}

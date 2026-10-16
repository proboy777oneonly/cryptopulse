'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import {
  Bell, CloudDownload, CloudUpload, Download, Mic2, Palette, RefreshCcw, Save, UserRound, Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp, THEMES, type SessionUser, type ThemeId } from '@/stores/app-store'
import { SOUNDS, soundEngine } from '@/engines/sound'
import { voiceEngine } from '@/engines/voice'
import { toastError, toastSuccess } from '@/engines/notifier'
import { AVATAR_COLORS } from '@/components/header'
import { cn } from '@/lib/utils'
import type { NotifType } from '@/engines/types'

const EMOJIS = ['🦊', '🐺', '🦅', '🐉', '🦈', '🐻', '🂡', '👑', '🚀', '⚡', '🔥', '💎', '🧠', '🤖', '🥷', '🎩', '🎯', '🪙', ' ETH', '🦄']

const SECTION = [
  { id: 'profile', label: 'Профиль', icon: <UserRound className="h-4 w-4" /> },
  { id: 'appearance', label: 'Внешний вид', icon: <Palette className="h-4 w-4" /> },
  { id: 'notifications', label: 'Уведомления', icon: <Bell className="h-4 w-4" /> },
  { id: 'data', label: 'Данные', icon: <CloudUpload className="h-4 w-4" /> },
] as const

type SectionId = (typeof SECTION)[number]['id']

const NOTIF_TYPES: { id: NotifType; label: string; color: string }[] = [
  { id: 'density', label: 'Плотности', color: '#f59e0b' },
  { id: 'movement', label: 'Движения', color: '#10b981' },
  { id: 'arbitrage', label: 'Арбитраж', color: '#22d3ee' },
  { id: 'news', label: 'Новости', color: '#f472b6' },
  { id: 'system', label: 'Система', color: '#8b5cf6' },
]

function VolumeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Volume2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cp-range w-full"
        style={{ '--fill': `${value}%` } as CSSProperties}
        aria-label="Громкость"
      />
      <span className="cp-num w-12 text-right text-sm font-black" style={{ color: 'var(--acc)' }}>{value}%</span>
    </div>
  )
}

export function SettingsView() {
  const app = useApp()
  const [section, setSection] = useState<SectionId>('profile')

  // Профиль
  const [name, setName] = useState(app.user?.name ?? '')
  const [emoji, setEmoji] = useState(app.user?.avatarEmoji ?? '🦊')
  const [color, setColor] = useState(app.user?.avatarColor ?? 'violet')
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [saving, setSaving] = useState(false)

  // Голоса
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    voiceEngine.refreshVoices((v) => setVoices(v))
    setVoices(voiceEngine.getVoices())
  }, [])
  const ruVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ru'))
  const voiceOptions = ruVoices.length > 0 ? ruVoices : voices

  // Импорт
  const [importText, setImportText] = useState('')

  const saveProfile = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = { name, avatarEmoji: emoji, avatarColor: color }
      if (newPass) {
        body.currentPassword = curPass
        body.newPassword = newPass
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toastError('Ошибка сохранения', json.error)
        return
      }
      app.setUser(json.user as SessionUser)
      setCurPass('')
      setNewPass('')
      toastSuccess('Профиль обновлён')
    } catch {
      toastError('Сеть недоступна')
    } finally {
      setSaving(false)
    }
  }

  const saveToServer = async () => {
    app.setSyncState('saving')
    try {
      const s = useApp.getState()
      const payload = {
        theme: s.theme, effects: s.effects, volume: s.volume, soundByType: s.soundByType,
        typePrefs: s.typePrefs, voice: s.voice, toasts: s.toasts,
        densityWindows: s.densityWindows, movementWindows: s.movementWindows, arbitrage: s.arbitrage,
      }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      app.setSyncState('saved', Date.now())
      toastSuccess('Настройки сохранены на сервере')
    } catch {
      app.setSyncState('error')
      toastError('Не удалось сохранить настройки')
    }
  }

  const loadFromServer = async () => {
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (res.ok && json.data) {
        app.hydrate(json.data)
        toastSuccess('Настройки загружены с сервера')
      } else if (res.ok) {
        toastError('На сервере ещё нет сохранённых настроек')
      } else {
        toastError(json.error ?? 'Ошибка загрузки')
      }
    } catch {
      toastError('Сеть недоступна')
    }
  }

  const exportSettings = () => {
    const s = useApp.getState()
    const payload = {
      theme: s.theme, effects: s.effects, volume: s.volume, soundByType: s.soundByType,
      typePrefs: s.typePrefs, voice: s.voice, toasts: s.toasts,
      densityWindows: s.densityWindows, movementWindows: s.movementWindows, arbitrage: s.arbitrage,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cryptopulse-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Файл настроек скачан')
  }

  const importSettings = () => {
    try {
      const data = JSON.parse(importText)
      app.hydrate(data)
      setImportText('')
      toastSuccess('Настройки импортированы')
    } catch {
      toastError('Некорректный JSON')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Секции */}
      <div className="cp-border-glow h-fit rounded-2xl bg-card p-3">
        <div className="flex flex-col gap-1">
          {SECTION.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                section === s.id ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              style={section === s.id
                ? { background: 'color-mix(in srgb, var(--acc) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--acc) 35%, transparent)' }
                : { border: '1px solid transparent' }}
              aria-pressed={section === s.id}
            >
              <span style={section === s.id ? { color: 'var(--acc)' } : undefined}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
        {/* ═══ ПРОФИЛЬ ═══ */}
        {section === 'profile' && (
          <div className="cp-border-glow rounded-2xl bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold"><UserRound className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Профиль</h3>
            <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl"
                style={{ background: `linear-gradient(135deg, ${AVATAR_COLORS[color] ?? '#8b5cf6'}, ${AVATAR_COLORS[color] ?? '#8b5cf6'}88)`, boxShadow: `0 10px 30px -10px ${AVATAR_COLORS[color] ?? '#8b5cf6'}` }}
              >
                {emoji}
              </div>
              <div className="w-full flex-1 space-y-4">
                <div className="space-y-1.5">
                  <Label>Имя</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={app.user?.email ?? ''} disabled className="opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Аватар</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={cn('flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all hover:scale-110', emoji === e ? 'cp-glow-sm' : 'border-[var(--border)]')}
                        style={emoji === e ? { borderColor: 'var(--acc)' } : undefined}
                        aria-label={`Аватар ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-[var(--muted-foreground)]">Цвет</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(AVATAR_COLORS).map(([k, c]) => (
                      <button
                        key={k}
                        onClick={() => setColor(k)}
                        className={cn('h-8 w-8 rounded-lg transition-transform hover:scale-110', color === k && 'ring-2 ring-offset-2 ring-[var(--acc)]')}
                        style={{ background: c, ...(color === k ? { boxShadow: `0 0 14px -2px ${c}` } : {}) }}
                        aria-label={`Цвет ${k}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
              <div className="text-xs font-bold">Смена пароля</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted-foreground)]">Текущий пароль</Label>
                  <Input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted-foreground)]">Новый пароль</Label>
                  <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="минимум 6 символов" />
                </div>
              </div>
            </div>

            <Button className="cp-glow-sm mt-5" onClick={saveProfile} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? 'Сохранение…' : 'Сохранить профиль'}
            </Button>
          </div>
        )}

        {/* ═══ ВНЕШНИЙ ВИД ═══ */}
        {section === 'appearance' && (
          <div className="cp-border-glow rounded-2xl bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Palette className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Внешний вид</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {THEMES.map((t) => {
                const active = app.theme === t.id
                const previews: Record<ThemeId, { bg: string; main: string; second: string }> = {
                  midnight: { bg: '#070b16', main: '#22d3ee', second: '#8b5cf6' },
                  terminal: { bg: '#030b06', main: '#34d399', second: '#a3e635' },
                  sunset: { bg: '#140a13', main: '#f472b6', second: '#fb923c' },
                  crystal: { bg: '#f2f4fa', main: '#7c3aed', second: '#0d9488' },
                }
                const p = previews[t.id]
                return (
                  <button
                    key={t.id}
                    onClick={() => { app.setTheme(t.id); toastSuccess(`Тема «${t.name}» применена`) }}
                    className={cn('overflow-hidden rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5', active ? 'cp-glow' : 'border-[var(--border)]')}
                    style={{ borderColor: active ? p.main : undefined }}
                    aria-pressed={active}
                  >
                    <div className="relative h-24 overflow-hidden" style={{ background: p.bg }}>
                      <div className="absolute -left-4 -top-6 h-20 w-20 rounded-full opacity-60 blur-2xl" style={{ background: p.main }} />
                      <div className="absolute -bottom-8 -right-2 h-24 w-24 rounded-full opacity-40 blur-2xl" style={{ background: p.second }} />
                      {t.id === 'terminal' && <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px)' }} />}
                      <div className="absolute inset-x-4 top-4 space-y-1.5">
                        <div className="h-2 w-4/5 rounded-full" style={{ background: `${p.main}40` }} />
                        <div className="h-2 w-3/5 rounded-full" style={{ background: `${p.main}30` }} />
                        <div className="h-2 w-2/3 rounded-full" style={{ background: `${p.second}30` }} />
                      </div>
                      {active && (
                        <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: p.main }}>АКТИВНА</span>
                      )}
                    </div>
                    <div className="bg-[var(--card-solid)] p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{t.name}</span>
                        <span className="text-[10px] font-bold uppercase" style={{ color: p.main }}>{t.effect}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Визуальные эффекты</div>
              {[
                { key: 'particles' as const, label: 'Частицы / аврора', hint: 'Звёзды, градиентные блобы и аврора на фоне' },
                { key: 'scanlines' as const, label: 'Сканлайны', hint: 'Эффект ЭЛТ-монитора в теме «Терминал»' },
                { key: 'glow' as const, label: 'Свечение', hint: 'Неоновые тени и подсветка границ карточек' },
                { key: 'animations' as const, label: 'Анимации', hint: 'Плавные переходы, бегущие строки и пульсация' },
                { key: 'compact' as const, label: 'Компактный режим', hint: 'Уменьшить отступы в таблицах плотностей' },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{f.label}</div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">{f.hint}</div>
                  </div>
                  <Switch checked={app.effects[f.key]} onCheckedChange={(v) => app.setEffects({ [f.key]: v })} aria-label={f.label} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ УВЕДОМЛЕНИЯ ═══ */}
        {section === 'notifications' && (
          <div className="space-y-4">
            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Volume2 className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Звук и громкость</h3>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">Общая громкость</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">движок: {soundEngine.unlocked ? 'разблокирован' : 'ждёт клика'}</span>
                </div>
                <VolumeSlider value={app.volume} onChange={app.setVolume} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                Браузеры блокируют автозапуск звука до первого клика — если звук не работает, кликните в любом месте страницы.
              </p>
            </div>

            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Mic2 className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Голосовые уведомления</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted-foreground)]">Голос озвучки</Label>
                  <Select value={app.voice.voiceURI || '__default'} onValueChange={(v) => app.setVoice({ voiceURI: v === '__default' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">Системный (русский)</SelectItem>
                      {voiceOptions.map((v) => (
                        <SelectItem key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => voiceEngine.test()}>
                    <Mic2 className="mr-2 h-4 w-4" /> Проверить голос
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--muted-foreground)]">Скорость речи</span>
                    <span className="cp-num font-bold" style={{ color: 'var(--acc)' }}>{app.voice.rate.toFixed(1)}x</span>
                  </div>
                  <input type="range" min={0.5} max={2} step={0.1} value={app.voice.rate} onChange={(e) => app.setVoice({ rate: Number(e.target.value) })} className="cp-range w-full" style={{ '--fill': `${((app.voice.rate - 0.5) / 1.5) * 100}%` } as CSSProperties} aria-label="Скорость речи" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--muted-foreground)]">Тон голоса</span>
                    <span className="cp-num font-bold" style={{ color: 'var(--acc)' }}>{app.voice.pitch.toFixed(1)}</span>
                  </div>
                  <input type="range" min={0.5} max={2} step={0.1} value={app.voice.pitch} onChange={(e) => app.setVoice({ pitch: Number(e.target.value) })} className="cp-range w-full" style={{ '--fill': `${((app.voice.pitch - 0.5) / 1.5) * 100}%` } as CSSProperties} aria-label="Тон голоса" />
                </div>
              </div>
            </div>

            {/* Матрица типов */}
            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Правила по типам событий</h3>
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-[1fr_repeat(4,72px)] items-center gap-2 px-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  <span className="text-left">Тип события</span>
                  <span>Тост</span><span>Звук</span><span>Голос</span><span>Сигнал</span>
                </div>
                {NOTIF_TYPES.map((t) => {
                  const prefs = app.typePrefs[t.id]
                  return (
                    <div key={t.id} className="grid grid-cols-[1fr_repeat(4,72px)] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <span className="h-2 w-2 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                        {t.label}
                      </span>
                      <div className="flex justify-center"><Switch checked={prefs.toast} onCheckedChange={(v) => app.setTypePrefs(t.id, { toast: v })} aria-label={`Тосты для ${t.label}`} /></div>
                      <div className="flex justify-center"><Switch checked={prefs.sound} onCheckedChange={(v) => app.setTypePrefs(t.id, { sound: v })} aria-label={`Звук для ${t.label}`} /></div>
                      <div className="flex justify-center"><Switch checked={prefs.voice} onCheckedChange={(v) => app.setTypePrefs(t.id, { voice: v })} aria-label={`Голос для ${t.label}`} /></div>
                      <div className="flex justify-center">
                        <Select value={app.soundByType[t.id]} onValueChange={(v) => app.setSoundForType(t.id, v)}>
                          <SelectTrigger className="h-8 w-[68px] text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SOUNDS.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Тосты */}
            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="text-sm font-bold">Поведение тостов</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-[var(--muted-foreground)]">Позиция на экране</Label>
                  <Select value={app.toasts.position} onValueChange={(v) => app.setToasts({ position: v as typeof app.toasts.position })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-right">Сверху справа</SelectItem>
                      <SelectItem value="top-center">Сверху по центру</SelectItem>
                      <SelectItem value="bottom-right">Снизу справа</SelectItem>
                      <SelectItem value="bottom-center">Снизу по центру</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--muted-foreground)]">Длительность показа</span>
                    <span className="cp-num font-bold" style={{ color: 'var(--acc)' }}>{app.toasts.duration} сек</span>
                  </div>
                  <input type="range" min={2} max={15} value={app.toasts.duration} onChange={(e) => app.setToasts({ duration: Number(e.target.value) })} className="cp-range w-full" style={{ '--fill': `${((app.toasts.duration - 2) / 13) * 100}%` } as CSSProperties} aria-label="Длительность тостов" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ДАННЫЕ ═══ */}
        {section === 'data' && (
          <div className="space-y-4">
            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold"><CloudUpload className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Синхронизация с сервером</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Настройки автоматически сохраняются на сервер при каждом изменении (с задержкой 2 секунды).
                Последняя синхронизация: {app.lastSyncedAt ? new Date(app.lastSyncedAt).toLocaleTimeString('ru-RU') : 'ещё не было'} · статус: {
                  { idle: 'ожидание', saving: 'сохранение…', saved: 'сохранено', error: 'ошибка' }[app.syncState]
                }
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={saveToServer}><CloudUpload className="mr-2 h-4 w-4" /> Сохранить на сервер</Button>
                <Button variant="outline" onClick={loadFromServer}><CloudDownload className="mr-2 h-4 w-4" /> Загрузить с сервера</Button>
              </div>
            </div>

            <div className="cp-border-glow rounded-2xl bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Download className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Экспорт и импорт</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportSettings}><Download className="mr-2 h-4 w-4" /> Скачать JSON</Button>
              </div>
              <div className="mt-4 space-y-2">
                <Label className="text-[11px] text-[var(--muted-foreground)]">Импорт из JSON</Label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"theme": "terminal", "volume": 80, ...}'
                  className="min-h-[90px] w-full rounded-xl border border-[var(--input)] bg-[var(--muted)] p-3 font-mono text-xs outline-none focus:border-[color-mix(in_srgb,var(--acc)_50%,transparent)]"
                />
                <Button size="sm" variant="outline" disabled={!importText.trim()} onClick={importSettings}>
                  <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Импортировать
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--destructive)_35%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_6%,transparent)] p-6">
              <h3 className="text-sm font-bold text-[var(--destructive)]">Сброс настроек</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Вернуть все окна, фильтры, темы и звуки к значениям по умолчанию. Действие необратимо.
              </p>
              <Button
                variant="outline" className="mt-4 border-[var(--destructive)] text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]"
                onClick={() => {
                  if (window.confirm('Сбросить ВСЕ настройки к значениям по умолчанию?')) {
                    app.resetAll()
                    toastSuccess('Настройки сброшены к дефолтным')
                  }
                }}
              >
                Сбросить всё
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

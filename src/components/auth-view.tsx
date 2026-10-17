'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MessageSquareText, RefreshCw, ShieldCheck, User, Zap, Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { toastSuccess } from '@/engines/notifier'
import { CpLogo, CpMark } from '@/components/logo'
import { ExIcon } from '@/components/ex-icons'
import { EXCHANGES } from '@/engines/types'
import type { SessionUser } from '@/stores/app-store'
import { setHash } from '@/lib/nav'

type Mode = 'login' | 'register'

// детерминированные «свечи» для брендовой панели (viewBox 0 0 560 240)
const CANDLES: { x: number; o: number; c: number; h: number; l: number }[] = [
  { x: 12, o: 168, c: 152, h: 176, l: 146 }, { x: 33, o: 152, c: 160, h: 168, l: 148 },
  { x: 54, o: 160, c: 138, h: 164, l: 130 }, { x: 75, o: 138, c: 146, h: 154, l: 134 },
  { x: 96, o: 146, c: 122, h: 150, l: 114 }, { x: 117, o: 122, c: 134, h: 142, l: 118 },
  { x: 138, o: 134, c: 110, h: 138, l: 102 }, { x: 159, o: 110, c: 124, h: 132, l: 106 },
  { x: 180, o: 124, c: 96, h: 128, l: 88 }, { x: 201, o: 96, c: 108, h: 118, l: 92 },
  { x: 222, o: 108, c: 86, h: 112, l: 78 }, { x: 243, o: 86, c: 102, h: 110, l: 82 },
  { x: 264, o: 102, c: 78, h: 106, l: 70 }, { x: 285, o: 78, c: 92, h: 100, l: 74 },
  { x: 306, o: 92, c: 66, h: 96, l: 58 }, { x: 327, o: 66, c: 80, h: 88, l: 62 },
  { x: 348, o: 80, c: 56, h: 84, l: 48 }, { x: 369, o: 56, c: 70, h: 78, l: 52 },
  { x: 390, o: 70, c: 48, h: 74, l: 40 }, { x: 411, o: 48, c: 62, h: 70, l: 44 },
  { x: 432, o: 62, c: 42, h: 66, l: 36 }, { x: 453, o: 42, c: 54, h: 62, l: 38 },
  { x: 474, o: 54, c: 34, h: 58, l: 28 }, { x: 495, o: 34, c: 46, h: 54, l: 30 },
  { x: 516, o: 46, c: 26, h: 50, l: 20 }, { x: 537, o: 26, c: 38, h: 46, l: 22 },
]

function Field({
  icon, label, id, ...rest
}: {
  icon: React.ReactNode
  label: string
  id: string
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{icon}</span>
        <Input id={id} {...rest} className="h-12 pl-10 text-sm" />
      </div>
    </div>
  )
}

export function AuthView({ mode, onBack, onDone }: { mode: Mode; onBack: () => void; onDone: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [shake, setShake] = useState(0)

  // шаги регистрации: 1 — данные, 2 — код из письма
  const [step, setStep] = useState<1 | 2>(1)
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [resendLeft, setResendLeft] = useState(0)
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (resendLeft <= 0) {
      if (resendTimer.current) { clearInterval(resendTimer.current); resendTimer.current = null }
      return
    }
    if (!resendTimer.current) {
      resendTimer.current = setInterval(() => setResendLeft((v) => v - 1), 1000)
    }
    return () => { if (resendTimer.current) { clearInterval(resendTimer.current); resendTimer.current = null } }
  }, [resendLeft > 0])

  const fail = (msg: string) => {
    setError(msg)
    setShake((v) => v + 1)
  }

  // ── Шаг 1: отправить код на почту ─────────────────────────────────
  const requestCode = async () => {
    if (name.trim().length < 2) return fail('Введите имя (минимум 2 символа)')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Введите корректный email')
    if (password.length < 6) return fail('Пароль должен быть не менее 6 символов')
    if (password !== password2) return fail('Пароли не совпадают')

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error ?? 'Не удалось отправить код')
        return
      }
      setStep(2)
      setCode('')
      setDevCode(typeof json.devCode === 'string' ? json.devCode : null)
      setResendLeft(60)
      if (json.devCode) {
        toastSuccess('Код сгенерирован (SMTP не настроен)', 'Код показан на странице')
      } else {
        toastSuccess('Код отправлен', `Письмо пришло на ${email}`)
      }
    } catch {
      fail('Сеть недоступна, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
  }

  // ── Шаг 2: проверка кода и создание аккаунта ─────────────────────
  const confirmCode = async (otp?: string) => {
    const c = (otp ?? code).trim()
    if (!/^\d{6}$/.test(c)) return fail('Введите 6 цифр кода')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name.trim(), code: c }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error ?? 'Ошибка сервера')
        return
      }
      toastSuccess('Аккаунт создан!', json.user.email)
      onDone(json.user)
    } catch {
      fail('Сеть недоступна, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
  }

  // ── Вход ──────────────────────────────────────────────────────────
  const login = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Введите корректный email')
    if (password.length < 6) return fail('Пароль должен быть не менее 6 символов')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error ?? 'Ошибка сервера')
        return
      }
      toastSuccess('С возвращением!', json.user.email)
      onDone(json.user)
    } catch {
      fail('Сеть недоступна, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') return login(e)
    if (step === 1) return void requestCode()
    return void confirmCode()
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
      {/* ─── Левая брендовая панель ─── */}
      <div
        className="relative hidden flex-1 flex-col justify-between overflow-hidden p-10 xl:p-14 lg:flex"
        style={{ background: 'linear-gradient(155deg, color-mix(in srgb, var(--acc) 16%, var(--background)), var(--background) 60%)' }}
      >
        {/* аврора */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--acc)' }} />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc-2)' }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(color-mix(in srgb, var(--foreground) 4%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--foreground) 4%, transparent) 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />

        <div className="relative flex items-center gap-3">
          <CpLogo size={46} animated />
          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight">Crypto<span style={{ color: 'var(--acc)' }}>Pulse</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">screener pro</div>
          </div>
        </div>

        <div className="relative">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <h2 className="max-w-md text-3xl font-black leading-tight tracking-tight xl:text-4xl">
              Рынок не спит.<br />
              <span className="cp-grad-text">Мы тоже.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">
              Плотности, движения, арбитраж и новости с 8 бирж — в одном экране.
              Входите и ловите сигналы раньше остальных.
            </p>
          </motion.div>

          {/* анимированный график с пульс-линией */}
          <div className="cp-border-glow mt-8 overflow-hidden rounded-2xl bg-card p-4" style={{ boxShadow: '0 24px 70px -35px var(--glow)' }}>
            <div className="mb-3 flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1.5"><CpMark className="h-3.5 w-3.5" animate={false} /> BTC/USDT · 1м</span>
              <span className="cp-num flex items-center gap-1.5" style={{ color: 'var(--pos)' }}>
                <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> LIVE −18.4%
              </span>
            </div>
            <svg viewBox="0 0 560 240" className="h-32 w-full xl:h-40" preserveAspectRatio="none">
              <defs>
                <linearGradient id="auth-pulse-glow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="var(--acc)" stopOpacity="0" />
                  <stop offset="1" stopColor="var(--acc)" stopOpacity="1" />
                </linearGradient>
              </defs>
              <line x1="0" y1="220" x2="560" y2="220" stroke="var(--border)" strokeWidth="1" />
              <motion.path
                d="M0 96 L120 96 L150 78 L186 128 L224 46 L258 112 L330 96 L392 96 L420 84 L448 116 L560 96"
                fill="none" stroke="url(#auth-pulse-glow)" strokeWidth="2"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.7, ease: 'easeInOut' }}
              />
              {CANDLES.map((cd, i) => {
                const up = cd.c < cd.o
                const col = up ? 'var(--pos)' : 'var(--neg)'
                const top = Math.min(cd.o, cd.c)
                const h = Math.max(3, Math.abs(cd.c - cd.o))
                return (
                  <motion.g
                    key={cd.x}
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.045, duration: 0.4, ease: 'easeOut' }}
                  >
                    <line x1={cd.x + 5} y1={cd.h} x2={cd.x + 5} y2={cd.l} stroke={col} strokeWidth="1.5" />
                    <rect x={cd.x} y={top} width="10" height={h} rx="1.5" fill={col} />
                  </motion.g>
                )
              })}
            </svg>
          </div>

          <div className="mt-7 grid max-w-md gap-2.5">
            {[
              { icon: <Zap className="h-3.5 w-3.5" />, t: 'Алерты от открытия свечи — задержка меньше секунды' },
              { icon: <Gauge className="h-3.5 w-3.5" />, t: 'Арбитраж F-F / F-S / S-F / S-S в реальном времени' },
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, t: 'Регистрация с подтверждением почты — безопасно' },
            ].map((f, i) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.12, duration: 0.4 }}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-2.5 text-xs font-semibold"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--acc) 15%, transparent)', color: 'var(--acc)' }}>{f.icon}</span>
                {f.t}
              </motion.div>
            ))}
          </div>
        </div>

        {/* иконки бирж */}
        <div className="relative flex items-center gap-3.5">
          {EXCHANGES.map((ex, i) => (
            <motion.span
              key={ex.id}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1 + i * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{ color: ex.color, borderColor: `${ex.color}33`, background: `${ex.color}0f` }}
              title={ex.name}
            >
              <ExIcon ex={ex.id} size={16} />
            </motion.span>
          ))}
        </div>
      </div>

      {/* ─── Правая форма ─── */}
      <div className="relative flex w-full flex-col items-center justify-center px-4 py-10 sm:px-8 lg:w-[480px] xl:w-[520px]">
        <button
          onClick={onBack}
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] lg:left-8 lg:top-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> На главную
        </button>

        <motion.div
          initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* мобильный логотип */}
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <CpLogo size={40} />
            <div className="text-base font-black tracking-tight">Crypto<span style={{ color: 'var(--acc)' }}>Pulse</span></div>
          </div>

          {/* переключатель режима */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
            {(['login', 'register'] as Mode[]).map((mm) => (
              <button
                key={mm}
                onClick={() => { setHash(mm === 'login' ? '#/login' : '#/register'); setStep(1); setError('') }}
                className={`h-9 rounded-lg text-[13px] font-bold transition-all ${mode === mm ? 'text-white shadow' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                style={mode === mm ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
              >
                {mm === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === 'register' && step === 2 ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -26 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--acc) 14%, transparent)', color: 'var(--acc)' }}>
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <h1 className="mt-4 text-[26px] font-black leading-tight tracking-tight">Код из письма</h1>
                <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                  Шестизначный код отправлен на <span className="font-semibold text-[var(--foreground)]">{email}</span>
                </p>

                <div className="mt-6 flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); if (v.length === 6) void confirmCode(v) }}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <span className="mx-1.5 text-xl font-black text-[var(--muted-foreground)]">·</span>
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {devCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-5 rounded-xl border border-[color-mix(in_srgb,#f59e0b_40%,transparent)] bg-[color-mix(in_srgb,#f59e0b_8%,transparent)] px-4 py-3 text-center"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Режим разработки (SMTP не настроен)</div>
                    <div className="cp-num mt-1 text-xl font-black tracking-[0.3em]">{devCode}</div>
                    <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">на VPS код будет приходить на почту при настроенном SMTP</div>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    key={shake}
                    initial={{ x: -7, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--destructive)]"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => void confirmCode()}
                  className="cp-glow h-12 w-full text-sm font-bold"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Подтвердить и создать аккаунт <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>

                <div className="mt-5 flex items-center justify-between text-xs">
                  <button
                    onClick={() => { setStep(1); setError(''); setCode('') }}
                    className="inline-flex items-center gap-1 font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Изменить данные
                  </button>
                  <button
                    disabled={resendLeft > 0 || loading}
                    onClick={() => void requestCode()}
                    className="inline-flex items-center gap-1 font-semibold disabled:opacity-45"
                    style={{ color: 'var(--acc)' }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {resendLeft > 0 ? `Новый код через ${resendLeft}с` : 'Отправить снова'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 26 }}
                transition={{ duration: 0.25 }}
              >
                <h1 className="text-[26px] font-black leading-tight tracking-tight">
                  {mode === 'login' ? 'С возвращением' : 'Создайте аккаунт'}
                </h1>
                <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                  {mode === 'login'
                    ? 'Войдите, чтобы продолжить скрининг рынка'
                    : 'Регистрация по почте с подтверждением кодом — полминуты'}
                </p>

                <form onSubmit={submit} className="mt-6 space-y-3.5">
                  {mode === 'register' && (
                    <Field id="name" label="Имя" icon={<User className="h-4 w-4" />} value={name} onChange={(e) => setName(e.target.value)} placeholder="Александр" autoComplete="name" />
                  )}
                  <Field id="email" label="Email" icon={<Mail className="h-4 w-4" />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Пароль</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <Input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 pl-10 pr-11 text-sm"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? 'Скрыть пароль' : 'Показать пароль'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {mode === 'register' && (
                    <Field
                      id="password2"
                      label="Повторите пароль"
                      icon={<ShieldCheck className="h-4 w-4" />}
                      type={showPw ? 'text' : 'password'}
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  )}

                  {error && (
                    <motion.div
                      key={shake}
                      initial={{ x: -7, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      className="rounded-lg border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--destructive)]"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button type="submit" disabled={loading} className="cp-glow h-12 w-full text-sm font-bold">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === 'login' ? 'Войти' : step === 1 ? 'Отправить код на почту' : 'Подтвердить'}
                    {mode === 'register' && <ArrowRight className="ml-1.5 h-4 w-4" />}
                  </Button>
                </form>

                <div className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
                  {mode === 'login' ? (
                    <>Нет аккаунта? <button onClick={() => setHash('#/register')} className="font-semibold" style={{ color: 'var(--acc)' }}>Зарегистрироваться</button></>
                  ) : (
                    <>Уже есть аккаунт? <button onClick={() => setHash('#/login')} className="font-semibold" style={{ color: 'var(--acc)' }}>Войти</button></>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, ArrowLeft, Eye, EyeOff, Gauge, KeyRound, Loader2, Lock, Mail, Radar, User, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastSuccess } from '@/engines/notifier'
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

export function AuthView({ mode, onBack, onDone }: { mode: Mode; onBack: () => void; onDone: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [shake, setShake] = useState(0)

  const fail = (msg: string) => {
    setError(msg)
    setShake((v) => v + 1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'register' && name.trim().length < 2) return fail('Введите имя (минимум 2 символа)')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Введите корректный email')
    if (password.length < 6) return fail('Пароль должен быть не менее 6 символов')
    if (mode === 'register' && password !== password2) return fail('Пароли не совпадают')

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name: name.trim() } : { email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        fail(json.error ?? 'Ошибка сервера')
        return
      }
      toastSuccess(mode === 'register' ? 'Аккаунт создан!' : 'С возвращением!', `${json.user.email}`)
      onDone(json.user)
    } catch {
      fail('Сеть недоступна, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
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
          <div className="cp-glow flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
            <Radar className="h-6 w-6 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight">CryptoPulse</div>
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

          {/* анимированный график */}
          <div className="cp-border-glow mt-8 overflow-hidden rounded-2xl bg-card p-4" style={{ boxShadow: '0 24px 70px -35px var(--glow)' }}>
            <div className="mb-3 flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" style={{ color: 'var(--acc)' }} /> BTC/USDT · 1м</span>
              <span className="cp-num flex items-center gap-1.5" style={{ color: 'var(--pos)' }}>
                <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> LIVE −18.4%
              </span>
            </div>
            <svg viewBox="0 0 560 240" className="h-32 w-full xl:h-40" preserveAspectRatio="none">
              <line x1="0" y1="220" x2="560" y2="220" stroke="var(--border)" strokeWidth="1" />
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
              { icon: <Radar className="h-3.5 w-3.5" />, t: '8 бирж · фьючерсы и спот · настройки на сервере' },
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

        <div className="relative text-[11px] text-[var(--muted-foreground)]">
          BINANCE · BYBIT · OKX · GATE · BITGET · KUCOIN · HYPERLIQUID · ASTER
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
            <div className="cp-glow flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div className="text-base font-black tracking-tight">CryptoPulse</div>
          </div>

          {/* переключатель режима */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
            {(['login', 'register'] as Mode[]).map((mm) => (
              <button
                key={mm}
                onClick={() => setHash(mm === 'login' ? '#/login' : '#/register')}
                className={`h-9 rounded-lg text-[13px] font-bold transition-all ${mode === mm ? 'text-white shadow' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
                style={mode === mm ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
              >
                {mm === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <h1 className="text-[26px] font-black leading-tight tracking-tight">
            {mode === 'login' ? 'С возвращением' : 'Создайте аккаунт'}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            {mode === 'login' ? 'Войдите, чтобы продолжить скрининг рынка' : 'Регистрация по почте — займёт полминуты'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3.5">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Александр" className="h-12 pl-10 text-sm" autoComplete="name" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 pl-10 text-sm" autoComplete="email" />
              </div>
            </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="password2">Повторите пароль</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <Input id="password2" type={showPw ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className="h-12 pl-10 text-sm" autoComplete="new-password" />
                </div>
              </div>
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
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
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
      </div>
    </div>
  )
}

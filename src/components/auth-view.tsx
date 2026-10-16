'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, KeyRound, Loader2, Lock, Mail, Radar, ShieldCheck, User, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastError, toastSuccess } from '@/engines/notifier'
import type { SessionUser } from '@/stores/app-store'
import { setHash } from '@/lib/nav'

type Mode = 'login' | 'register'

export function AuthView({ mode, onBack, onDone }: { mode: Mode; onBack: () => void; onDone: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register' && name.trim().length < 2) return setError('Введите имя (минимум 2 символа)')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Введите корректный email')
    if (password.length < 6) return setError('Пароль должен быть не менее 6 символов')
    if (mode === 'register' && password !== password2) return setError('Пароли не совпадают')

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name: name.trim() } : { email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Ошибка сервера')
        return
      }
      toastSuccess(mode === 'register' ? 'Аккаунт создан!' : 'С возвращением!', `${json.user.email}`)
      onDone(json.user)
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--border)] shadow-2xl md:grid-cols-2"
        style={{ boxShadow: '0 40px 100px -40px var(--glow)' }}
      >
        {/* Левая панель — форма */}
        <div className="bg-[var(--card-solid)] p-7 sm:p-10">
          <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
            <ArrowLeft className="h-3.5 w-3.5" /> На главную
          </button>

          <h1 className="text-2xl font-black tracking-tight">
            {mode === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта'}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
            {mode === 'login' ? 'Войдите, чтобы продолжить скрининг рынка' : 'Регистрация по почте — займет полминуты'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Имя</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Александр" className="pl-9" autoComplete="name" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            </div>
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="password2">Повторите пароль</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <Input id="password2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete="new-password" />
                </div>
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--destructive)]">
                {error}
              </motion.div>
            )}

            <Button type="submit" disabled={loading} className="cp-glow-sm h-11 w-full text-sm font-bold">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
            {mode === 'login' ? (
              <>Нет аккаунта? <button onClick={() => (setHash('#/register'))} className="font-semibold" style={{ color: 'var(--acc)' }}>Зарегистрироваться</button></>
            ) : (
              <>Уже есть аккаунт? <button onClick={() => (setHash('#/login'))} className="font-semibold" style={{ color: 'var(--acc)' }}>Войти</button></>
            )}
          </div>

          {mode === 'login' && (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              <span className="font-bold" style={{ color: 'var(--acc)' }}>Демо-доступ:</span> admin@screen.io / admin123 —
              вход с правами администратора (вкладки «Монитор» и «Пользователи»).
            </div>
          )}
        </div>

        {/* Правая панель — брендинг */}
        <div className="relative hidden items-center justify-center overflow-hidden p-10 md:flex" style={{ background: 'linear-gradient(150deg, color-mix(in srgb, var(--acc) 14%, var(--card-solid)), color-mix(in srgb, var(--acc-2) 10%, var(--card-solid)))' }}>
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--acc)' }} />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc-2)' }} />
          <div className="relative space-y-6">
            <div className="cp-glow mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
              <Radar className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-3 text-center">
              {[
                { icon: <Zap className="h-4 w-4" />, t: 'Мгновенные алерты', d: 'Движения от открытия свечи без задержки' },
                { icon: <ShieldCheck className="h-4 w-4" />, t: 'Настройки на сервере', d: 'Окна, фильтры и звуки сохраняются автоматически' },
                { icon: <Radar className="h-4 w-4" />, t: '8 бирж · F + S', d: 'Binance, Bybit, OKX, Gate, Bitget, KuCoin, Hyperliquid, Aster' },
              ].map((f) => (
                <div key={f.t} className="cp-border-glow mx-auto flex max-w-xs items-start gap-3 rounded-xl bg-card p-3.5 text-left">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--acc) 15%, transparent)', color: 'var(--acc)' }}>{f.icon}</div>
                  <div>
                    <div className="text-sm font-bold">{f.t}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export async function demoLogin(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@screen.io', password: 'admin123' }),
    })
    const json = await res.json()
    return res.ok ? json.user : null
  } catch {
    toastError('Не удалось войти в демо-режим')
    return null
  }
}

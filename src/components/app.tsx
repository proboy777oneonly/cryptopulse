'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeApplier, ThemeEffects } from '@/components/theme'
import { EngineProvider } from '@/components/engine-provider'
import { Dashboard } from '@/components/dashboard'
import { ViewsRouter } from '@/components/views'
import { Landing } from '@/components/landing'
import { AuthView } from '@/components/auth-view'
import { CpLogo } from '@/components/logo'
import { useApp, type SessionUser } from '@/stores/app-store'
import { MotionConfig } from 'framer-motion'
import { clearHash, setHash } from '@/lib/nav'

type AuthScreen = 'landing' | 'login' | 'register'

// Поля настроек, синхронизируемые с сервером
function serializeSynced(s: ReturnType<typeof useApp.getState>): string {
  return JSON.stringify({
    theme: s.theme, effects: s.effects, volume: s.volume, soundByType: s.soundByType,
    typePrefs: s.typePrefs, voice: s.voice, toasts: s.toasts,
    densityWindows: s.densityWindows, movementWindows: s.movementWindows, arbitrage: s.arbitrage,
  })
}

function Splash() {
  const tips = [
    'Подключаемся к 8 биржам…',
    'Калибруем поток плотностей…',
    'Прогреваем арбитражный движок…',
    'Почти готово…',
  ]
  const [tip, setTip] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTip((v) => Math.min(v + 1, tips.length - 1)), 700)
    return () => clearInterval(iv)
  }, [tips.length])
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* мягкая аврора */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--acc)' }} />
      <div className="pointer-events-none absolute -bottom-52 left-1/3 h-[26rem] w-[26rem] rounded-full opacity-15 blur-3xl" style={{ background: 'var(--acc-2)' }} />
      <div className="relative flex flex-col items-center gap-6">
        <CpLogo size={92} animated />
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight">
            Crypto<span style={{ color: 'var(--acc)' }}>Pulse</span>
          </div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--muted-foreground)]">screener pro</div>
        </div>
        {/* прогресс-полоса */}
        <div className="h-1 w-44 overflow-hidden rounded-full bg-[var(--muted)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--acc), var(--acc-2))' }}
            initial={{ width: '12%' }}
            animate={{ width: ['12%', '78%', '96%'] }}
            transition={{ duration: 2.4, ease: 'easeInOut' }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={tip}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-[var(--muted-foreground)]"
          >
            {tips[tip]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export function AppRoot() {
  const [booted, setBooted] = useState(false)
  const [authScreen, setAuthScreen] = useState<AuthScreen>('landing')
  const user = useApp((s) => s.user)
  const setUser = useApp((s) => s.setUser)
  const hydrate = useApp((s) => s.hydrate)
  const theme = useApp((s) => s.theme)
  const animations = useApp((s) => s.effects.animations)
  const toastPosition = useApp((s) => s.toasts.position)
  const lastSyncJson = useRef('')

  // ─── Проверка сессии и загрузка настроек с сервера ───
  const loadServerSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (res.ok && json.data && typeof json.data === 'object') {
        hydrate(json.data as Record<string, unknown>)
        lastSyncJson.current = serializeSynced(useApp.getState())
      } else {
        lastSyncJson.current = serializeSynced(useApp.getState())
      }
    } catch {
      lastSyncJson.current = serializeSynced(useApp.getState())
    }
  }, [hydrate])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me')
        const json = await res.json()
        if (!cancelled && json.user) {
          setUser(json.user)
          await loadServerSettings()
        }
      } catch {
        /* офлайн */
      } finally {
        if (!cancelled) setBooted(true)
      }
    })()
    return () => { cancelled = true }
  }, [setUser, loadServerSettings])

  // ─── Hash для экранов авторизации ───
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#\/?/, '')
      if (h === 'login' || h === 'register') setAuthScreen(h)
      else if (!h && !user) setAuthScreen('landing')
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [user])

  // ─── Автосохранение настроек на сервер (debounce 2с) ───
  useEffect(() => {
    if (!user) return
    if (!lastSyncJson.current) lastSyncJson.current = serializeSynced(useApp.getState())
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useApp.subscribe((state) => {
      const json = serializeSynced(state)
      if (json === lastSyncJson.current) return
      lastSyncJson.current = json
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        state.setSyncState('saving')
        try {
          const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: json,
          })
          if (!res.ok) throw new Error('save failed')
          useApp.getState().setSyncState('saved', Date.now())
        } catch {
          useApp.getState().setSyncState('error')
        }
      }, 2000)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [user])

  const onAuthDone = async (u: SessionUser) => {
    setUser(u)
    clearHash()
    await loadServerSettings()
  }

  if (!booted) return <Splash />

  return (
    <MotionConfig reducedMotion={animations ? 'never' : 'always'}>
      <ThemeApplier />
      <ThemeEffects />
      <Toaster
        position={toastPosition}
        offset={toastPosition.startsWith('top') ? 76 : 16}
        gap={8}
        theme={theme === 'crystal' ? 'light' : 'dark'}
        toastOptions={{ unstyled: true, classNames: { toast: '!p-0 !bg-transparent !border-none !shadow-none' } }}
      />
      {!user ? (
        authScreen === 'landing' ? (
          <Landing
            onLogin={() => { setAuthScreen('login'); setHash('#/login') }}
            onRegister={() => { setAuthScreen('register'); setHash('#/register') }}
          />
        ) : (
          <AuthView
            mode={authScreen === 'login' ? 'login' : 'register'}
            onBack={() => { setAuthScreen('landing'); clearHash() }}
            onDone={onAuthDone}
          />
        )
      ) : (
        <EngineProvider>
          <Dashboard>
            <ViewsRouter />
          </Dashboard>
        </EngineProvider>
      )}
    </MotionConfig>
  )
}

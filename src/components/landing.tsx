'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowRight, ArrowUpRight, Bell, BellRing, ChartCandlestick, Gauge, Globe2,
  LineChart, Mic2, Radar, ShieldCheck, TrendingUp, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/stores/app-store'
import { THEMES } from '@/stores/app-store'
import { EXCHANGES } from '@/engines/types'
import type { ReactNode } from 'react'

const fadeUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: 'easeOut' as const },
}

/* ─── данные для живого терминала ─────────────────────────────── */

const SYMS = ['BTC', 'ETH', 'SOL', 'PEPE', 'WIF', 'SUI', 'DOGE', 'AVAX', 'LINK', 'TIA', 'BONK', 'ENA', 'ARB', 'TON', 'WLD', 'TURBO', 'BNB', 'XRP']
const EXS = ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'KUCOIN', 'HL', 'ASTER']

type SigKind = 'density' | 'move' | 'arb'
type Sig = {
  id: number
  kind: SigKind
  sym: string
  ex: string
  ex2?: string
  mkt: 'F' | 'S'
  dir: 1 | -1
  val: string
  sub: string
  at: string
}

const rnd = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

const TICKER = [
  { s: 'BTC', p: '96,412', c: 2.14 }, { s: 'ETH', p: '3,428', c: 3.02 }, { s: 'SOL', p: '206.4', c: 5.87 },
  { s: 'BNB', p: '688.2', c: 1.12 }, { s: 'XRP', p: '2.31', c: -1.84 }, { s: 'DOGE', p: '0.3184', c: 4.41 },
  { s: 'PEPE', p: '0.0000181', c: 8.92 }, { s: 'WIF', p: '2.87', c: -3.15 }, { s: 'SUI', p: '4.28', c: 6.24 },
  { s: 'AVAX', p: '37.4', c: -2.08 }, { s: 'LINK', p: '21.8', c: 2.95 }, { s: 'TURBO', p: '0.0092', c: 12.4 },
  { s: 'ARB', p: '0.841', c: -4.32 }, { s: 'TON', p: '5.35', c: 1.67 }, { s: 'ENA', p: '0.912', c: 7.18 },
  { s: 'WLD', p: '2.36', c: -5.02 }, { s: 'TIA', p: '4.75', c: 3.86 }, { s: 'BONK', p: '0.0000308', c: 9.71 },
]
const TICKER2 = [...TICKER, ...TICKER]
const money = (min: number, max: number) => {
  const v = min + Math.random() * (max - min)
  return v >= 10 ? `$${v.toFixed(1)}M` : `$${v.toFixed(2)}M`
}
const hhmmss = () => new Date().toLocaleTimeString('ru-RU')

function makeSig(id: number): Sig {
  const kind: SigKind = rnd<SigKind>(['density', 'density', 'move', 'arb'])
  const sym = rnd(SYMS)
  const ex = rnd(EXS)
  const mkt = Math.random() > 0.5 ? 'F' : 'S'
  if (kind === 'density') {
    const dir = Math.random() > 0.5 ? 1 : -1
    return {
      id, kind, sym, ex, mkt, dir,
      val: money(0.9, 14),
      sub: `${(0.2 + Math.random() * 2.4).toFixed(2)}% от цены`,
      at: hhmmss(),
    }
  }
  if (kind === 'move') {
    const dir = Math.random() > 0.5 ? 1 : -1
    const pct = (1.2 + Math.random() * 7).toFixed(2)
    return {
      id, kind, sym, ex, mkt, dir,
      val: `${dir > 0 ? '+' : '−'}${pct}%`,
      sub: `${(2 + Math.floor(Math.random() * 40))} сек · объём ${money(0.4, 9)}`,
      at: hhmmss(),
    }
  }
  const ex2 = rnd(EXS.filter((e) => e !== ex))
  return {
    id, kind, sym, ex, ex2, mkt: Math.random() > 0.5 ? 'F' : 'S',
    dir: 1,
    val: `${(0.4 + Math.random() * 2.6).toFixed(2)}%`,
    sub: `покупка ${ex} → продажа ${ex2}`,
    at: hhmmss(),
  }
}

const KIND_META: Record<SigKind, { label: string; color: string }> = {
  density: { label: 'ПЛОТНОСТЬ', color: '#f59e0b' },
  move: { label: 'ДВИЖЕНИЕ', color: '#10b981' },
  arb: { label: 'АРБИТРАЖ', color: '#22d3ee' },
}

/* ─── живой терминал ──────────────────────────────────────────── */

function SignalTerminal() {
  const [sigs, setSigs] = useState<Sig[]>([])
  const [msgs, setMsgs] = useState(2841)
  const idRef = useRef(1)

  useEffect(() => {
    setSigs(Array.from({ length: 6 }, () => makeSig(idRef.current++)))
    const iv = setInterval(() => {
      setSigs((prev) => [makeSig(idRef.current++), ...prev].slice(0, 7))
      setMsgs((m) => m + Math.floor(3 + Math.random() * 26))
    }, 1700)
    return () => clearInterval(iv)
  }, [])

  return (
    <div
      className="cp-border-glow relative flex h-full flex-col overflow-hidden rounded-2xl bg-card"
      style={{ boxShadow: '0 40px 90px -40px var(--glow)' }}
    >
      {/* заголовок окна */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e' }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#28c840' }} />
        <span className="cp-num ml-3 truncate text-[11px] text-[var(--muted-foreground)]">cryptopulse — live signals</span>
        <span className="cp-num ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--pos) 14%, transparent)', color: 'var(--pos)' }}>
          <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> WS 8/8
        </span>
      </div>

      {/* поток */}
      <div className="flex-1 overflow-hidden p-2.5">
        <AnimatePresence initial={false}>
          {sigs.map((s) => {
            const km = KIND_META[s.kind]
            const pos = s.dir > 0
            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
                className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2"
              >
                <span
                  className="cp-num shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider"
                  style={{ background: `${km.color}1c`, color: km.color }}
                >
                  {km.label}
                </span>
                <span className="w-14 shrink-0 truncate text-[13px] font-black">{s.sym}</span>
                <span className="cp-num shrink-0 text-[10px] text-[var(--muted-foreground)]">{s.ex}{s.kind === 'arb' ? `→${s.ex2}` : ''} · {s.mkt}</span>
                <span className="cp-num ml-auto shrink-0 text-[13px] font-bold" style={{ color: pos ? 'var(--pos)' : 'var(--neg)' }}>
                  {s.kind === 'density' ? (pos ? '▲ LONG' : '▼ SHORT') : s.val}
                </span>
                {s.kind === 'density' && <span className="cp-num hidden w-16 shrink-0 text-right text-[12px] font-semibold sm:block">{s.val}</span>}
                <span className="cp-num hidden w-14 shrink-0 text-right text-[10px] text-[var(--muted-foreground)] md:block">{s.at}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* нижняя строка */}
      <div className="cp-num flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-[10px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1.5"><Activity className="h-3 w-3" style={{ color: 'var(--acc)' }} /> {msgs.toLocaleString('ru-RU')} событий сегодня</span>
        <span>задержка <b style={{ color: 'var(--pos)' }}>0.4с</b></span>
      </div>
    </div>
  )
}

/* ─── секция заголовков ───────────────────────────────────────── */

function SectionHead({ tag, title, sub }: { tag: string; title: ReactNode; sub?: string }) {
  return (
    <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
      <div className="cp-num text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--acc)' }}>{tag}</div>
      <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-[var(--muted-foreground)]">{sub}</p>}
    </motion.div>
  )
}

/* ─── ЛЕНДИНГ ─────────────────────────────────────────────────── */

export function Landing({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const setTheme = useApp((s) => s.setTheme)
  const theme = useApp((s) => s.theme)

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_78%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="cp-glow flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-black tracking-tight">CryptoPulse</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">screener pro</div>
            </div>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--muted-foreground)] md:flex">
            <a className="transition-colors hover:text-[var(--foreground)]" href="#features">Возможности</a>
            <a className="transition-colors hover:text-[var(--foreground)]" href="#exchanges">Биржи</a>
            <a className="transition-colors hover:text-[var(--foreground)]" href="#themes">Темы</a>
            <a className="transition-colors hover:text-[var(--foreground)]" href="#how">Как работает</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onLogin} className="hidden sm:inline-flex">Войти</Button>
            <Button size="sm" onClick={onRegister} className="cp-glow-sm font-semibold">
              Регистрация <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section id="top" className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3.5 py-1.5 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--pos)' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--pos)' }} />
                </span>
                8 бирж · фьючерсы + спот · задержка &lt; 1 сек
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-5 text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.6rem]"
            >
              Рынок движется.<br />
              Вы <span className="cp-grad-text">узнаете первым</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-5 max-w-lg text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg"
            >
              Плотности, движения, арбитраж и новости с восьми бирж — в одном терминале.
              Сигнал приходит раньше, чем свеча закроется: тост, звук, голос.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" onClick={onRegister} className="cp-glow h-12 px-8 text-base font-bold">
                Начать бесплатно <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onLogin} className="h-12 px-6 text-base">
                У меня есть аккаунт
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { v: '8', l: 'бирж · F+S' },
                { v: '400+', l: 'монет в стриме' },
                { v: '<1с', l: 'от сигнала до алерта' },
                { v: '24/7', l: 'автономная работа' },
              ].map((s) => (
                <div key={s.l} className="cp-border-glow rounded-xl bg-card p-3 text-center">
                  <div className="cp-num text-xl font-black" style={{ color: 'var(--acc)' }}>{s.v}</div>
                  <div className="mt-0.5 text-[11px] leading-tight text-[var(--muted-foreground)]">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* живой терминал сигналов */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
            className="h-[430px] sm:h-[460px]"
          >
            <SignalTerminal />
          </motion.div>
        </div>
      </section>

      {/* ─── БЕГУЩАЯ СТРОКА ─── */}
      <section className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--muted)] py-3">
        <div className="cp-ticker-track flex w-max gap-8">
          {TICKER2.map((t, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap text-sm">
              <span className="font-bold">{t.s}</span>
              <span className="cp-num text-[var(--muted-foreground)]">${t.p}</span>
              <span className="cp-num text-xs font-bold" style={{ color: t.c >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {t.c >= 0 ? '+' : ''}{t.c}%
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ВОЗМОЖНОСТИ: BENTO ─── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHead tag="возможности" title={<>Один терминал — <span className="cp-grad-text">весь рынок</span></>} sub="Плотности, движения, арбитраж, новости, график с рисовалками и полный контроль уведомлений." />

        <div className="mt-12 grid gap-4 md:grid-cols-12">
          {/* Плотности — большая ячейка */}
          <motion.div {...fadeUp} className="cp-border-glow group relative overflow-hidden rounded-2xl bg-card p-6 md:col-span-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: '#f59e0b' }} />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: '#f59e0b40', background: '#f59e0b14', color: '#f59e0b' }}>
                <Zap size={20} />
              </span>
              <h3 className="text-lg font-black">Плотности</h3>
              <span className="cp-num ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: '#f59e0b14', color: '#f59e0b' }}>8 бирж · F/S</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
              Крупные лимитные стены в стакане — то, куда двигается «умный» капитал. Индивидуальные фильтры,
              чёрные списки и свои тикеры для каждого окна, отдельно для фьючерсов и спота.
            </p>
            <div className="mt-5 space-y-2.5">
              {[
                { sym: 'BTC', ex: 'BINANCE', v: '$18.4M', w: 92, d: 1 },
                { sym: 'SOL', ex: 'BYBIT', v: '$9.7M', w: 61, d: 1 },
                { sym: 'ETH', ex: 'OKX', v: '$7.2M', w: 48, d: -1 },
                { sym: 'WIF', ex: 'HYPERLIQ', v: '$4.1M', w: 30, d: -1 },
              ].map((r, i) => (
                <div key={r.sym} className="flex items-center gap-3 text-xs">
                  <span className="w-12 shrink-0 font-black">{r.sym}</span>
                  <span className="cp-num w-20 shrink-0 text-[var(--muted-foreground)]">{r.ex}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                    <motion.div
                      initial={{ width: 0 }} whileInView={{ width: `${r.w}%` }}
                      viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.7 }}
                      className="h-full rounded-full" style={{ background: r.d > 0 ? 'var(--pos)' : 'var(--neg)' }}
                    />
                  </div>
                  <span className="cp-num w-16 shrink-0 text-right font-bold">{r.v}</span>
                  <span className="w-14 shrink-0 text-right font-black" style={{ color: r.d > 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.d > 0 ? 'LONG' : 'SHORT'}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Движения — большая ячейка */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }} className="cp-border-glow group relative overflow-hidden rounded-2xl bg-card p-6 md:col-span-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: '#10b981' }} />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: '#10b98140', background: '#10b98114', color: '#10b981' }}>
                <ChartCandlestick size={20} />
              </span>
              <h3 className="text-lg font-black">Движения</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Алерт срабатывает от открытия свечи: если монета прошла 3% за 2 секунды — вы узнаете
              об этом без задержки. Независимые окна со своими правилами.
            </p>
            <div className="cp-border-glow mt-5 rounded-xl bg-[var(--muted)] p-3.5">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--pos)' }} /> TURBO · 1м</span>
                <span className="cp-num" style={{ color: 'var(--pos)' }}>▲ 12.4% за 1м</span>
              </div>
              <svg viewBox="0 0 320 70" className="h-16 w-full">
                <defs>
                  <linearGradient id="lnd-mv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--pos)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }} transition={{ duration: 1.1, ease: 'easeOut' }}
                  d="M0,62 L28,60 L56,58 L84,55 L112,50 L140,46 L168,47 L196,38 L224,32 L252,28 L280,16 L320,6"
                  fill="none" stroke="var(--pos)" strokeWidth="2.2" strokeLinecap="round"
                />
                <path d="M0,62 L28,60 L56,58 L84,55 L112,50 L140,46 L168,47 L196,38 L224,32 L252,28 L280,16 L320,6 L320,70 L0,70 Z" fill="url(#lnd-mv)" opacity="0.5" />
              </svg>
              <div className="cp-num mt-1 flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                <BellRing className="h-3 w-3" style={{ color: 'var(--acc)' }} /> уведомление: звук + голос «TURBO, рост 12 процентов»
              </div>
            </div>
          </motion.div>

          {/* Арбитраж */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }} className="cp-border-glow group rounded-2xl bg-card p-5 md:col-span-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: '#22d3ee40', background: '#22d3ee14', color: '#22d3ee' }}>
              <Gauge size={19} />
            </div>
            <h3 className="mt-3.5 font-black">Арбитраж</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Межбиржевые спреды в 4 режимах: F-F, F-S, S-F, S-S. Покупка здесь — продажа там.
            </p>
            <div className="cp-num mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[11px] font-bold">
              <span>GATE</span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <span>KUCOIN</span>
              <span className="rounded px-1.5 py-0.5" style={{ background: '#22d3ee1c', color: '#22d3ee' }}>0.87%</span>
            </div>
          </motion.div>

          {/* Новости */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="cp-border-glow group rounded-2xl bg-card p-5 md:col-span-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: '#f472b640', background: '#f472b614', color: '#f472b6' }}>
              <Globe2 size={19} />
            </div>
            <h3 className="mt-3.5 font-black">Новости и листинги</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
              События крипты и макро, новые листинги бирж. Высокий приоритет мгновенно превращается в алерт.
            </p>
            <div className="mt-4 space-y-1.5">
              {['SEC одобрила новый ETF', 'Binance: листинг XYZ', 'CPI выше прогноза'].map((n) => (
                <div key={n} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5 text-[11px] font-semibold">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#f472b6' }} /> {n}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Голос */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="cp-border-glow group rounded-2xl bg-card p-5 md:col-span-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: '#34d39940', background: '#34d39914', color: '#34d399' }}>
              <Mic2 size={19} />
            </div>
            <h3 className="mt-3.5 font-black">Голосовые алерты</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">
              Синтез речи на русском: «SOL. Рост 3.2 процента, Binance». Выбор голоса, скорости и тона.
            </p>
            <div className="mt-4 flex items-end gap-1 px-1" style={{ height: 28 }}>
              {[0.35, 0.6, 0.45, 0.85, 0.55, 1, 0.7, 0.9, 0.5, 0.75, 0.4, 0.65].map((h, i) => (
                <motion.span
                  key={i}
                  animate={{ scaleY: [h, 1, h] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: 'easeInOut' }}
                  className="w-full origin-bottom rounded-sm" style={{ height: '100%', background: 'color-mix(in srgb, var(--acc) 55%, transparent)' }}
                />
              ))}
            </div>
          </motion.div>

          {/* Обзор рынка — широкая */}
          <motion.div {...fadeUp} className="cp-border-glow group relative overflow-hidden rounded-2xl bg-card p-6 md:col-span-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: 'var(--acc)', background: 'color-mix(in srgb, var(--acc) 10%, transparent)', color: 'var(--acc)' }}>
                <LineChart size={20} />
              </span>
              <h3 className="text-lg font-black">Обзор рынка</h3>
              <span className="cp-num ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--acc) 12%, transparent)', color: 'var(--acc)' }}>BINANCE · BYBIT · OKX</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
              Свечной график с рисовалками: трендовые, фибо, прямоугольники, линейка на колёсико.
              Зум, панорама во всех направлениях, магнит к OHLC на Ctrl — как в терминале.
            </p>
            <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
              <svg viewBox="0 0 420 110" className="h-24 w-full">
                {[40, 76, 112, 148, 184, 220, 256, 292, 328, 364, 400].map((x, i) => {
                  const o = 78 - (i * 5.2 + (i % 3) * 4)
                  const c = o - 8 - (i % 4) * 3
                  const up = i % 3 !== 1
                  const col = up ? 'var(--pos)' : 'var(--neg)'
                  const top = Math.min(o, c)
                  const h = Math.max(4, Math.abs(o - c))
                  return (
                    <g key={x}>
                      <line x1={x} y1={Math.min(o, c) - 9} x2={x} y2={Math.max(o, c) + 9} stroke={col} strokeWidth="1.4" />
                      <rect x={x - 4} y={top} width="8" height={h} rx="1" fill={col} />
                    </g>
                  )
                })}
              </svg>
              <div className="cp-num space-y-1 text-right text-[11px]">
                <div className="font-bold">ETH/USDT · 15м</div>
                <div style={{ color: 'var(--pos)' }}>+2.2% за час</div>
                <div className="text-[var(--muted-foreground)]">объём $6.6B</div>
              </div>
            </div>
          </motion.div>

          {/* Уведомления + монитор + аккаунты — стек */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }} className="grid gap-4 md:col-span-5">
            {[
              { icon: <BellRing size={18} />, t: 'Умные уведомления', d: 'Тосты, звуки и голос: для каждого типа событий — свой звук, громкость и правила.', ac: '#a78bfa' },
              { icon: <Activity size={18} />, t: 'Монитор сервера', d: 'CPU по ядрам, цикл событий, heap, WS-клиенты и статус коннектов — вся телеметрия.', ac: '#38bdf8' },
              { icon: <ShieldCheck size={18} />, t: 'Аккаунты и роли', d: 'Регистрация по почте, профили, роли администратора и управление пользователями.', ac: '#e879f9' },
            ].map((f) => (
              <div key={f.t} className="cp-border-glow group flex items-start gap-3.5 rounded-2xl bg-card p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110" style={{ borderColor: `${f.ac}40`, background: `${f.ac}14`, color: f.ac }}>
                  {f.icon}
                </span>
                <div>
                  <h3 className="font-black">{f.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">{f.d}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── БИРЖИ ─── */}
      <section id="exchanges" className="border-y border-[var(--border)] bg-[var(--muted)] py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <SectionHead tag="покрытие" title="Восемь бирж — один поток" sub="Фьючерсы и спот по каждой площадке, собственное окно плотностей и общий движок арбитража." />
          <motion.div {...fadeUp} className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EXCHANGES.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.35 }}
                className="cp-border-glow group flex items-center gap-3 rounded-xl bg-card p-4"
                style={{ boxShadow: `0 8px 30px -18px ${e.color}` }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black" style={{ background: `${e.color}1e`, color: e.color }}>
                  {e.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{e.name}</div>
                  <div className="cp-num flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> F + S · WS
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── ТЕМЫ ─── */}
      <section id="themes" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHead tag="оформление" title="Четыре живые темы" sub="Нажмите на тему, чтобы примерить её прямо сейчас — эффекты применяются мгновенно." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map((t, i) => {
            const active = theme === t.id
            const previews: Record<string, { bg: string; main: string; second: string; label: string }> = {
              midnight: { bg: '#070b16', main: '#22d3ee', second: '#8b5cf6', label: 'звёзды · неон' },
              terminal: { bg: '#030b06', main: '#34d399', second: '#a3e635', label: 'сканлайны · CRT' },
              sunset: { bg: '#140a13', main: '#f472b6', second: '#fb923c', label: 'аврора · градиент' },
              crystal: { bg: '#f2f4fa', main: '#7c3aed', second: '#0d9488', label: 'стекло · пастель' },
            }
            const p = previews[t.id]
            return (
              <motion.button
                key={t.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.07 }}
                onClick={() => setTheme(t.id)}
                className={`group overflow-hidden rounded-2xl border-2 text-left transition-all duration-300 hover:-translate-y-1 ${active ? 'cp-glow' : 'border-[var(--border)]'}`}
                style={{ borderColor: active ? p.main : undefined }}
              >
                <div className="relative h-32 overflow-hidden" style={{ background: p.bg }}>
                  <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full opacity-60 blur-2xl" style={{ background: p.main }} />
                  <div className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full opacity-40 blur-2xl" style={{ background: p.second }} />
                  <div className="absolute inset-x-4 top-5 space-y-1.5">
                    {[0.85, 0.6, 0.7].map((w, r) => (
                      <div key={r} className="h-2 rounded-full" style={{ width: `${w * 100}%`, background: `${p.main}30` }} />
                    ))}
                  </div>
                  {t.id === 'terminal' && (
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px)' }} />
                  )}
                  {t.id === 'crystal' && <div className="absolute inset-0 bg-white/10" />}
                  {active && (
                    <div className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white" style={{ background: p.main }}>
                      активна
                    </div>
                  )}
                </div>
                <div className="bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{t.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: p.main }}>{p.label}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">{t.desc}</p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* ─── КАК РАБОТАЕТ ─── */}
      <section id="how" className="border-t border-[var(--border)] bg-[var(--muted)] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <SectionHead tag="быстрый старт" title="Три шага до первых сигналов" />
          <div className="relative mt-12 grid gap-6 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-px md:block" style={{ background: 'linear-gradient(90deg, transparent, var(--acc), var(--acc-2), transparent)' }} />
            {[
              { n: '01', t: 'Создайте аккаунт', d: 'Регистрация по email за 30 секунд. Настройки сохраняются на сервере и синхронизируются между сессиями.' },
              { n: '02', t: 'Настройте окна', d: 'Добавьте биржи, задайте фильтры плотностей и движений для фьючерсов и спота отдельно. Чёрные списки — свои для каждого окна.' },
              { n: '03', t: 'Ловите сигналы', d: 'Тосты, звуки и голосовые уведомления сработают моментально, как только монета пройдёт ваш порог движения.' },
            ].map((s, i) => (
              <motion.div key={s.n} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="relative text-center">
                <div className="cp-num relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-base font-black text-white" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', boxShadow: '0 10px 30px -12px var(--glow)' }}>
                  {s.n}
                </div>
                <h3 className="mt-5 font-black">{s.t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[var(--muted-foreground)]">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div
          {...fadeUp}
          className="cp-border-glow relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center sm:px-12"
          style={{ boxShadow: '0 40px 100px -50px var(--glow)' }}
        >
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc)' }} />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc-2)' }} />
          <div className="cp-num relative mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3.5 py-1.5 text-[11px] font-bold">
            <Bell className="h-3.5 w-3.5" style={{ color: 'var(--acc)' }} /> пока вы читаете это — терминал уже поймал несколько плотностей
          </div>
          <h2 className="relative text-3xl font-black tracking-tight sm:text-4xl">
            Начните скринить рынок <span className="cp-grad-text">прямо сейчас</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[var(--muted-foreground)]">Бесплатный аккаунт, все 8 бирж, полная настройка окон и уведомлений.</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onRegister} className="cp-glow h-12 px-8 text-base font-bold">
              Зарегистрироваться <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onLogin} className="h-12 px-6 text-base">
              Войти
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="mt-auto border-t border-[var(--border)] bg-[var(--muted)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
              <Radar className="h-4 w-4 text-white" />
            </div>
            <div className="text-sm font-bold">CryptoPulse <span className="font-normal text-[var(--muted-foreground)]">· скринер нового поколения</span></div>
          </div>
          <div className="flex items-center gap-5 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> v3.6.0</span>
            <span className="flex items-center gap-1.5"><LineChart className="h-3.5 w-3.5" /> LIVE-данные 8 бирж</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

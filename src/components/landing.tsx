'use client'

import { motion } from 'framer-motion'
import {
  Activity, ArrowRight, Bell, BellRing, ChartCandlestick, Gauge, Globe2, Layers,
  LineChart, Mic2, MonitorSmartphone, Palette, Radar, ShieldCheck, Sparkles, TrendingUp, Users2, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/stores/app-store'
import { THEMES } from '@/stores/app-store'
import { ExBadge } from '@/components/ui-bits'
import { EXCHANGES } from '@/engines/types'
import type { ReactNode } from 'react'

const fadeUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: 'easeOut' as const },
}

const TICKER = [
  { s: 'BTC', p: '96,412', c: 2.14 }, { s: 'ETH', p: '3,428', c: 3.02 }, { s: 'SOL', p: '206.4', c: 5.87 },
  { s: 'BNB', p: '688.2', c: 1.12 }, { s: 'XRP', p: '2.31', c: -1.84 }, { s: 'DOGE', p: '0.3184', c: 4.41 },
  { s: 'PEPE', p: '0.0000181', c: 8.92 }, { s: 'WIF', p: '2.87', c: -3.15 }, { s: 'SUI', p: '4.28', c: 6.24 },
  { s: 'AVAX', p: '37.4', c: -2.08 }, { s: 'LINK', p: '21.8', c: 2.95 }, { s: 'TURBO', p: '0.0092', c: 12.4 },
  { s: 'ARB', p: '0.841', c: -4.32 }, { s: 'TON', p: '5.35', c: 1.67 }, { s: 'ENA', p: '0.912', c: 7.18 },
  { s: 'WLD', p: '2.36', c: -5.02 }, { s: 'TIA', p: '4.75', c: 3.86 }, { s: 'BONK', p: '0.0000308', c: 9.71 },
]

const FEATURES: { icon: ReactNode; title: string; text: string; accent: string }[] = [
  { icon: <Layers size={20} />, title: 'Плотности', text: 'Отслеживание крупных лимитных заявок на 8 биржах. Индивидуальные фильтры, чёрные списки и тикеры для каждого окна и каждого режима F/S.', accent: '#f59e0b' },
  { icon: <ChartCandlestick size={20} />, title: 'Движения', text: 'Мгновенные алерты от открытия свечи: если монета прошла 3% за 2 секунды — уведомление придёт без задержки. Независимые окна с правилами.', accent: '#10b981' },
  { icon: <Gauge size={20} />, title: 'Арбитраж', text: 'Межбиржевые спреды в реальном времени: покупка на одной площадке, продажа на другой. Фильтры по спреду, объёму и биржам.', accent: '#22d3ee' },
  { icon: <Globe2 size={20} />, title: 'Новости', text: 'Важные события крипты и макро, влияющие на рынок. Высокий приоритет мгновенно превращается в уведомление.', accent: '#f472b6' },
  { icon: <BellRing size={20} />, title: 'Умные уведомления', text: 'Тосты, звуки, голосовые оповещения. Полный контроль: для каждого типа событий — свой звук, громкость и правила.', accent: '#a78bfa' },
  { icon: <Mic2 size={20} />, title: 'Голосовые алерты', text: 'Синтез речи на русском: «SOL. Рост 3.2 процента, Binance». Выбор голоса, скорости и тона озвучки.', accent: '#34d399' },
  { icon: <Palette size={20} />, title: '4 уникальные темы', text: 'Полночь со звёздами, неоновый терминал со сканлайнами, кибер-закат с авророй и светлый кристалл — с живыми эффектами.', accent: '#fb923c' },
  { icon: <MonitorSmartphone size={20} />, title: 'Монитор сервера', text: 'CPU по ядрам, цикл событий, RSS, heap, ОЗУ, WS-клиенты и статус коннектов — вся телеметрия для админа.', accent: '#38bdf8' },
  { icon: <ShieldCheck size={20} />, title: 'Аккаунты и роли', text: 'Регистрация по почте, профили, роли администратора, управление пользователями и их настройками.', accent: '#e879f9' },
]

export function Landing({ onLogin, onRegister, onDemo, demoLoading }: {
  onLogin: () => void
  onRegister: () => void
  onDemo: () => void
  demoLoading: boolean
}) {
  const setTheme = useApp((s) => s.setTheme)
  const theme = useApp((s) => s.theme)

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_78%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="cp-glow flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-black tracking-tight">CryptoPulse</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">screener pro</div>
            </div>
          </div>
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
      <section className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3.5 py-1.5 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--pos)' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--pos)' }} />
                </span>
                8 бирж · Фьючерсы + Спот · Задержка &lt; 1 сек
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Крипто-скринер,<br />который <span className="cp-grad-text">видит всё</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg"
            >
              Плотности, движения, арбитраж и новости — в одном экране. Мгновенные уведомления со звуком
              и голосом, индивидуальные фильтры для каждого окна и биржи.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" onClick={onRegister} className="cp-glow h-12 px-7 text-base font-bold">
                Начать бесплатно <Sparkles className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onDemo} disabled={demoLoading} className="h-12 px-6 text-base">
                {demoLoading ? 'Входим…' : 'Демо-вход (админ)'}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-9 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {[
                { v: '8', l: 'бирж' },
                { v: '2×', l: 'F + S рынки' },
                { v: '70+', l: 'монет' },
                { v: '<1с', l: 'отклик' },
              ].map((s) => (
                <div key={s.l} className="cp-border-glow rounded-xl bg-card p-3 text-center">
                  <div className="cp-num text-xl font-black" style={{ color: 'var(--acc)' }}>{s.v}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Мини-превью дашборда */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, rotateY: 8 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="cp-border-glow relative overflow-hidden rounded-2xl bg-card p-4 shadow-2xl"
            style={{ boxShadow: '0 30px 80px -30px var(--glow)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Layers className="h-4 w-4" style={{ color: 'var(--acc)' }} /> ПЛОТНОСТИ · LIVE
              </div>
              <div className="cp-num flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> 30 активных
              </div>
            </div>
            <div className="space-y-2">
              {[
                { ex: 'BINANCE', sym: 'SOL', vol: '$4.3M', str: 3.93, dir: 'LONG', color: '#F0B90B' },
                { ex: 'OKX', sym: 'BNB', vol: '$2.1M', str: 2.53, dir: 'SHORT', color: '#E2E8F0' },
                { ex: 'BYBIT', sym: 'PEPE', vol: '$8.7M', str: 5.12, dir: 'LONG', color: '#F7A600' },
                { ex: 'HL', sym: 'WIF', vol: '$1.4M', str: 4.08, dir: 'SHORT', color: '#9DF2D8' },
                { ex: 'BITGET', sym: 'SUI', vol: '$6.2M', str: 3.47, dir: 'LONG', color: '#00E5D0' },
              ].map((r, i) => (
                <motion.div
                  key={r.sym + r.ex}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.13, duration: 0.4 }}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="w-16 shrink-0 truncate font-bold">{r.sym}</span>
                  <span className="hidden w-20 shrink-0 text-[var(--muted-foreground)] sm:block">{r.ex}</span>
                  <span className="cp-num w-14 shrink-0 font-semibold">{r.vol}</span>
                  <div className="mx-2 hidden flex-1 sm:block">
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--muted)]">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${r.str * 16}%` }}
                        transition={{ delay: 0.7 + i * 0.13, duration: 0.7 }}
                        className="h-full rounded-full"
                        style={{ background: r.dir === 'LONG' ? 'var(--pos)' : 'var(--neg)' }}
                      />
                    </div>
                  </div>
                  <span className="cp-num w-12 shrink-0 text-right" style={{ color: 'var(--acc)' }}>{r.str}%</span>
                  <span className="w-14 shrink-0 text-right font-bold" style={{ color: r.dir === 'LONG' ? 'var(--pos)' : 'var(--neg)' }}>{r.dir}</span>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
              className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{ borderColor: 'color-mix(in srgb, var(--pos) 35%, transparent)', background: 'color-mix(in srgb, var(--pos) 8%, transparent)' }}
            >
              <BellRing className="h-3.5 w-3.5" style={{ color: 'var(--pos)' }} />
              <span className="font-semibold" style={{ color: 'var(--pos)' }}>TURBO ▲ 12.4% за 1м</span>
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">только что · голос вкл</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── БЕГУЩАЯ СТРОКА ─── */}
      <section className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--muted)] py-3">
        <div className="cp-ticker-track flex w-max gap-8">
          {[...TICKER, ...TICKER].map((t, i) => (
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

      {/* ─── ВОЗМОЖНОСТИ ─── */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--acc)' }}>возможности</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Всё, что нужно скальперу и свинг-трейдеру</h2>
          <p className="mt-3 text-[var(--muted-foreground)]">Девять вкладок, десятки фильтров, полный контроль над потоком сигналов.</p>
        </motion.div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}
              className="group cp-border-glow rounded-2xl bg-card p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110"
                style={{ borderColor: `${f.accent}40`, background: `${f.accent}14`, color: f.accent }}
              >
                {f.icon}
              </div>
              <h3 className="mt-4 text-base font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── БИРЖИ ─── */}
      <section id="exchanges" className="border-y border-[var(--border)] bg-[var(--muted)] py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--acc)' }}>покрытие</div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">8 бирж · фьючерсы и спот</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Один движок — все рынки. Каждая биржа получает собственное окно плотностей.</p>
          </motion.div>
          <motion.div {...fadeUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {EXCHANGES.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }}
                className="cp-border-glow flex items-center gap-2.5 rounded-xl bg-card px-4 py-3"
                style={{ boxShadow: `0 8px 30px -18px ${e.color}` }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black" style={{ background: `${e.color}1e`, color: e.color }}>
                  {e.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="text-sm font-bold">{e.name}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">F + S · WS поток</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── ТЕМЫ ─── */}
      <section id="themes" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--acc)' }}>оформление</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">4 темы с живыми эффектами</h2>
          <p className="mt-3 text-[var(--muted-foreground)]">Нажмите на тему, чтобы примерить её прямо сейчас — эффекты применяются мгновенно.</p>
        </motion.div>
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
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--acc)' }}>быстрый старт</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Три шага до первых сигналов</h2>
          </motion.div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', icon: <Users2 className="h-5 w-5" />, t: 'Создайте аккаунт', d: 'Регистрация по email за 30 секунд. Настройки сохраняются на сервере и синхронизируются между сессиями.' },
              { n: '02', icon: <SlidersIcon />, t: 'Настройте окна', d: 'Добавьте биржи, задайте фильтры плотностей и движений для фьючерсов и спота отдельно. Чёрные списки — свои для каждого окна.' },
              { n: '03', icon: <Bell className="h-5 w-5" />, t: 'Ловите сигналы', d: 'Тосты, звуки и голосовые уведомления сработают моментально, как только монета пройдёт ваш порог движения.' },
            ].map((s, i) => (
              <motion.div key={s.n} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="relative cp-border-glow rounded-2xl bg-card p-6">
                <div className="cp-num absolute -top-3 right-5 rounded-lg px-2.5 py-1 text-sm font-black" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', color: '#fff' }}>
                  {s.n}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]" style={{ color: 'var(--acc)' }}>{s.icon}</div>
                <h3 className="mt-4 font-bold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted-foreground)]">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <motion.div
          {...fadeUp}
          className="cp-border-glow relative overflow-hidden rounded-3xl bg-card px-6 py-14 text-center sm:px-12"
          style={{ boxShadow: '0 40px 100px -50px var(--glow)' }}
        >
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc)' }} />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--acc-2)' }} />
          <h2 className="relative text-3xl font-black tracking-tight sm:text-4xl">Начните скринить рынок <span className="cp-grad-text">прямо сейчас</span></h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[var(--muted-foreground)]">Бесплатный аккаунт, все 8 бирж, полная настройка окон и уведомлений.</p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onRegister} className="cp-glow h-12 px-8 text-base font-bold">
              Зарегистрироваться <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={onDemo} disabled={demoLoading} className="h-12 px-6 text-base">
              {demoLoading ? 'Входим…' : 'Демо-вход'}
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
            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> v2.4.1</span>
            <span className="flex items-center gap-1.5"><LineChart className="h-3.5 w-3.5" /> LIVE-данные 8 бирж</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="21" x4="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

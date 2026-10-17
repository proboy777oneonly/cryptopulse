'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, CandlestickChart, Clock, Flame, Gauge, Layers,
  ListPlus, Newspaper, Radar, Snowflake, TrendingDown, TrendingUp, Zap,
} from 'lucide-react'
import { useApp, type ViewId } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { EX_MAP, FG_LABEL, fmtPrice, fmtTime, fmtUsd, type AppNotification, type ExchangeId, type TickerSnapshot } from '@/engines/types'
import {
  AnimatedNumber, EmptyState, ExBadge, FearGreedGauge, Pct, SlideBar, Sparkline, StatCard, TickerCopy, splitQuote, useUptime,
} from '@/components/ui-bits'
import { CpMark } from '@/components/logo'
import { ExIcon } from '@/components/ex-icons'

// ─── Мета типов сигналов ─────────────────────────────────────────────

const SIG_META: Record<string, { label: string; color: string; icon: typeof Bell }> = {
  density: { label: 'ПЛОТНОСТЬ', color: '#f59e0b', icon: Layers },
  movement: { label: 'ДВИЖЕНИЕ', color: '#10b981', icon: TrendingUp },
  arbitrage: { label: 'АРБИТРАЖ', color: '#22d3ee', icon: ArrowDownRight },
  news: { label: 'НОВОСТЬ', color: '#f472b6', icon: Newspaper },
  listing: { label: 'ЛИСТИНГ', color: '#a3e635', icon: ListPlus },
  system: { label: 'СИСТЕМА', color: '#8b5cf6', icon: Activity },
}

const SIG_ROUTE: Record<string, ViewId> = {
  density: 'densities', movement: 'movements', arbitrage: 'arbitrage',
  news: 'news', listing: 'listings', system: 'notifications',
}

/** приоритет источников живой цены крупной монеты */
const HERO_SOURCES: { ex: ExchangeId; m: 'F' | 'S' }[] = [
  { ex: 'BINANCE', m: 'F' }, { ex: 'BINANCE', m: 'S' }, { ex: 'BYBIT', m: 'F' }, { ex: 'OKX', m: 'F' },
]

function pickTicker(symbol: string): TickerSnapshot | undefined {
  const map = useLive.getState().tickers
  for (const src of HERO_SOURCES) {
    const t = map[`${src.ex}:${src.m}:${symbol}`]
    if (t) return t
  }
  return undefined
}

/** Живая цена крупной монеты — изолированный компонент, обновляется сам */
function HeroCoin({ symbol, name, delay }: { symbol: string; name: string; delay: number }) {
  const [snap, setSnap] = useState<TickerSnapshot | undefined>(() => pickTicker(symbol))
  useEffect(() => {
    const iv = setInterval(() => setSnap(pickTicker(symbol)), 2500)
    return () => clearInterval(iv)
  }, [symbol])
  const price = snap?.price
  const chg = snap?.change24hPct
  const up = (chg ?? 0) >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      className="cp-border-glow group relative min-w-[168px] flex-1 overflow-hidden rounded-2xl bg-card p-4"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ background: up ? 'linear-gradient(90deg, transparent, var(--pos), transparent)' : 'linear-gradient(90deg, transparent, var(--neg), transparent)' }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-black tracking-tight">{name}</span>
          <span className="rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[8px] font-bold text-[var(--muted-foreground)]">{symbol.replace('USDT', '')}/USDT</span>
        </span>
        <ExIconInline ex="BINANCE" />
      </div>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="cp-num text-[26px] font-black leading-none tracking-tight transition-colors" style={{ color: price === undefined ? 'var(--muted-foreground)' : undefined }}>
          {price === undefined ? '—' : fmtPrice(price)}
        </span>
        {chg !== undefined && (
          <span
            className="cp-num flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black"
            style={{
              background: up ? 'color-mix(in srgb, var(--pos) 12%, transparent)' : 'color-mix(in srgb, var(--neg) 12%, transparent)',
              color: up ? 'var(--pos)' : 'var(--neg)',
            }}
          >
            {up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
          </span>
        )}
      </div>
      {/* микробар амплитуды */}
      <div className="mt-2.5">
        <SlideBar pct={chg ?? 0} max={Math.max(Math.abs(chg ?? 0) * 1.6, 4)} positive={up} delay={delay * 1000} />
      </div>
    </motion.div>
  )
}

function ExIconInline({ ex }: { ex: ExchangeId }) {
  const meta = EX_MAP[ex]
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-md border"
      style={{ color: meta.color, borderColor: `${meta.color}33`, background: `${meta.color}0f` }}
      aria-hidden
    >
      <ExIcon ex={ex} size={11} />
    </span>
  )
}

// ─── Строка топа ──────────────────────────────────────────────────────

function TopRow({ t, i, max, positive }: { t: TickerSnapshot; i: number; max: number; positive?: boolean }) {
  const { base, quote } = splitQuote(t.symbol)
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="group">
      <div className="flex items-center gap-2">
        <span className="cp-num w-4 shrink-0 text-[10px] font-bold text-[var(--muted-foreground)]">{i + 1}</span>
        <span className="flex min-w-0 flex-1 items-baseline gap-1">
          <TickerCopy
            symbol={t.symbol}
            display={base}
            className="min-w-0 truncate text-[14px] font-black tracking-tight transition-colors group-hover:text-[var(--acc)]"
          />
          {quote && <span className="shrink-0 text-[9px] font-bold text-[var(--muted-foreground)] opacity-60">{quote}</span>}
        </span>
        <ExBadge ex={t.exchange} size="sm" />
        <span className="cp-num hidden w-[58px] shrink-0 text-right text-[10px] text-[var(--muted-foreground)] sm:block">{fmtUsd(t.vol24h)}</span>
        <Pct v={t.change24hPct} bold className="w-[68px] shrink-0 text-right text-[13px]" />
      </div>
      <div className="mt-1 pl-6">
        <SlideBar pct={t.change24hPct} max={max} positive={positive} delay={i * 40} />
      </div>
    </motion.div>
  )
}

// ─── Строка живой ленты сигналов ─────────────────────────────────────

function SignalRow({ n, i }: { n: AppNotification; i: number }) {
  const setView = useApp((s) => s.setView)
  const meta = SIG_META[n.type] ?? SIG_META.system
  const Icon = meta.icon
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: -18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      onClick={() => setView(SIG_ROUTE[n.type] ?? 'notifications')}
      className="cp-row-in flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-left transition-all hover:translate-x-0.5 hover:border-[color-mix(in_srgb,var(--acc)_40%,transparent)]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ background: `${meta.color}14`, borderColor: `${meta.color}30`, color: meta.color }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] font-black tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
          {n.ticker && <span className="truncate text-xs font-black">{n.ticker}</span>}
          <span className="cp-num ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">{fmtTime(n.time)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--muted-foreground)]">{n.title}</span>
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
}

// ─── Быстрые действия ────────────────────────────────────────────────

const QUICK: { id: ViewId; label: string; desc: string; icon: typeof Radar; color: string }[] = [
  { id: 'market', label: 'Обзор рынка', desc: 'Графики · ТФ · рисовалки', icon: CandlestickChart, color: '#8b5cf6' },
  { id: 'densities', label: 'Плотности', desc: 'Стены заявок в окнах', icon: Layers, color: '#f59e0b' },
  { id: 'arbitrage', label: 'Арбитраж', desc: 'Спреды F-F · F-S · S-S', icon: Gauge, color: '#22d3ee' },
  { id: 'movements', label: 'Движения', desc: 'Импульсы по окнам', icon: TrendingUp, color: '#10b981' },
  { id: 'news', label: 'Новости', desc: 'Лента + перевод на RU', icon: Newspaper, color: '#f472b6' },
  { id: 'listings', label: 'Листинги', desc: 'Анонсы 3 бирж', icon: ListPlus, color: '#a3e635' },
]

// ─── Вкладка ─────────────────────────────────────────────────────────

export function HomeView() {
  const setView = useApp((s) => s.setView)
  const topMovers = useLive((s) => s.topMovers)
  const fearGreed = useLive((s) => s.fearGreed)
  const notifications = useLive((s) => s.notifications)
  const stats = useLive((s) => s.stats)
  const arbitrageOpps = useLive((s) => s.arbitrageOpps)
  const news = useLive((s) => s.news)
  const uptime = useUptime()
  // редкая подписка для фолбэка топов (раз в ~12 тиков)
  const slowTick = useLive((s) => Math.floor(s.tick / 12))

  const { gainers, losers } = useMemo(() => {
    if (topMovers.gainers.length > 0 || topMovers.losers.length > 0) {
      return { gainers: topMovers.gainers, losers: topMovers.losers }
    }
    const all = Object.values(useLive.getState().tickers)
    const liquid = all.filter((t) => t.vol24h >= 20e6)
    const bySymbol = new Map<string, TickerSnapshot>()
    for (const t of liquid) {
      const prev = bySymbol.get(t.symbol)
      if (!prev || t.vol24h > prev.vol24h) bySymbol.set(t.symbol, t)
    }
    const arr = [...bySymbol.values()]
    return {
      gainers: [...arr].sort((a, b) => b.change24hPct - a.change24hPct).slice(0, 8),
      losers: [...arr].sort((a, b) => a.change24hPct - b.change24hPct).slice(0, 8),
    }
  }, [topMovers, slowTick])

  const activeDensities = useMemo(
    () => Object.values(useLive.getState().densityEvents).reduce((acc, list) => acc + list.length, 0),
    [slowTick],
  )
  const movementsToday = stats.movements
  const maxG = Math.max(...gainers.map((t) => Math.abs(t.change24hPct)), 1)
  const maxL = Math.max(...losers.map((t) => Math.abs(t.change24hPct)), 1)
  const feed = notifications.slice(0, 12)

  return (
    <div className="space-y-5">
      {/* ═══ HERO: пульс рынка ═══ */}
      <div className="cp-border-glow relative overflow-hidden rounded-2xl bg-card p-5">
        {/* фоновая волна-пульс */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.12]" viewBox="0 0 900 96" preserveAspectRatio="none" aria-hidden>
          <motion.path
            d="M0 52 L90 52 L120 38 L156 70 L192 22 L226 60 L300 52 L420 52 L450 40 L480 66 L520 44 L600 52 L700 52 L730 34 L770 72 L820 46 L900 52"
            fill="none" stroke="var(--acc)" strokeWidth="2"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />
        </svg>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[220px]">
            <div className="flex items-center gap-2.5">
              <CpMark className="h-6 w-6 text-white" animate />
              <h2 className="text-lg font-black tracking-tight">Пульс рынка</h2>
              <span className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--pos)_35%,transparent)] bg-[color-mix(in_srgb,var(--pos)_10%,transparent)] px-2 py-0.5 text-[9px] font-black tracking-widest" style={{ color: 'var(--pos)' }}>
                <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> LIVE · 8 бирж
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
              Плотности, движения и арбитраж — в реальном времени, без задержек
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            <HeroCoin symbol="BTCUSDT" name="Bitcoin" delay={0.08} />
            <HeroCoin symbol="ETHUSDT" name="Ethereum" delay={0.16} />
            <HeroCoin symbol="SOLUSDT" name="Solana" delay={0.24} />
          </div>
        </div>
      </div>

      {/* ═══ Стат-карточки ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'Аптайм сессии', value: uptime, sub: `${stats.ticks.toLocaleString('ru-RU')} тиков движка`, icon: <Clock className="h-4 w-4" />, accent: undefined as string | undefined, num: undefined as number | undefined },
          { label: 'Активные плотности', value: undefined, num: activeDensities, sub: `${stats.densities.toLocaleString('ru-RU')} за сессию`, icon: <Layers className="h-4 w-4" />, accent: '#f59e0b' },
          { label: 'Движения', value: undefined, num: movementsToday, sub: 'сработавших алертов', icon: <TrendingUp className="h-4 w-4" />, accent: '#10b981' },
          { label: 'Арбитраж', value: undefined, num: arbitrageOpps.length, sub: `спред ≥ ${(useApp.getState().arbitrage.minSpreadPct).toFixed(1)}%`, icon: <Gauge className="h-4 w-4" />, accent: '#22d3ee' },
          { label: 'Новости', value: undefined, num: news.length, sub: 'в ленте движка', icon: <Newspaper className="h-4 w-4" />, accent: '#f472b6' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}>
            <StatCard
              label={s.label}
              value={s.num !== undefined ? <AnimatedNumber value={s.num} /> : s.value}
              sub={s.sub}
              icon={s.icon}
              accent={s.accent}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* ═══ Живая лента сигналов ═══ */}
        <div className="cp-border-glow rounded-2xl bg-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Radar className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Живая лента сигналов
              {feed.length > 0 && (
                <span className="cp-num rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}>
                  {feed.length}
                </span>
              )}
            </h3>
            <button onClick={() => setView('notifications')} className="text-xs font-semibold transition-opacity hover:opacity-80" style={{ color: 'var(--acc)' }}>
              Весь журнал →
            </button>
          </div>
          <div className="mt-3 flex max-h-[430px] flex-col gap-2 overflow-y-auto pr-1">
            {feed.length === 0 && (
              <EmptyState
                icon={<Radar className="h-8 w-8" />}
                title="Сканируем рынок…"
                hint="Как только плотность, движение или арбитраж пройдут ваши фильтры — они появятся здесь первыми"
              />
            )}
            <AnimatePresence initial={false}>
              {feed.map((n, i) => (
                <SignalRow key={n.id} n={n} i={i} />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ═══ Правая колонка: F&G + быстрые действия ═══ */}
        <div className="flex flex-col gap-5">
          <div className="cp-border-glow rounded-2xl bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                {fearGreed.value <= 44 ? <Snowflake className="h-4 w-4" style={{ color: '#fb923c' }} /> : <Flame className="h-4 w-4" style={{ color: '#f43f5e' }} />}
                Индекс страха и жадности
              </h3>
              <span
                className="rounded-md border px-2 py-0.5 text-[9px] font-black tracking-widest"
                style={{
                  color: fearGreed.source === 'live' ? 'var(--pos)' : 'var(--muted-foreground)',
                  borderColor: fearGreed.source === 'live' ? 'color-mix(in srgb, var(--pos) 40%, transparent)' : 'var(--border)',
                }}
              >
                {fearGreed.source === 'live' ? 'LIVE' : 'DEMO'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <FearGreedGauge value={fearGreed.value} size={132} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-black" style={{ color: fearGreed.value <= 24 ? '#f43f5e' : fearGreed.value <= 44 ? '#fb923c' : fearGreed.value <= 55 ? '#fbbf24' : fearGreed.value <= 74 ? '#a3e635' : '#34d399' }}>
                  {FG_LABEL(fearGreed.value)}
                </div>
                {fearGreed.yesterday !== undefined && (
                  <div
                    className="cp-num mt-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black"
                    style={{
                      background: fearGreed.value >= fearGreed.yesterday ? 'color-mix(in srgb, var(--pos) 12%, transparent)' : 'color-mix(in srgb, var(--neg) 12%, transparent)',
                      color: fearGreed.value >= fearGreed.yesterday ? 'var(--pos)' : 'var(--neg)',
                    }}
                  >
                    {fearGreed.value >= fearGreed.yesterday ? '▲' : '▼'}
                    {Math.abs(fearGreed.value - fearGreed.yesterday)} за сутки
                  </div>
                )}
                <Sparkline data={fearGreed.history} width={190} height={38} className="mt-2" positive={fearGreed.history[fearGreed.history.length - 1] >= (fearGreed.history[0] ?? 0)} />
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {([
                    { label: 'Вчера', v: fearGreed.yesterday },
                    { label: 'Неделя', v: fearGreed.lastWeek },
                    { label: 'Месяц', v: fearGreed.lastMonth },
                  ] as const).map((row) => (
                    <div key={row.label} className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-1.5 py-1.5 text-center">
                      <div className="text-[8px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{row.label}</div>
                      <div
                        className="cp-num mt-0.5 text-sm font-black"
                        style={{ color: row.v === undefined ? 'var(--muted-foreground)' : row.v <= 24 ? '#f43f5e' : row.v <= 44 ? '#fb923c' : row.v <= 55 ? '#fbbf24' : row.v <= 74 ? '#a3e635' : '#34d399' }}
                      >
                        {row.v ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* быстрые действия */}
          <div className="cp-border-glow rounded-2xl bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Быстрые действия
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {QUICK.map((q, i) => {
                const Icon = q.icon
                return (
                  <motion.button
                    key={q.id}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                    onClick={() => setView(q.id)}
                    className="group flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_var(--glow)]"
                    style={{ transitionProperty: 'transform, box-shadow, border-color' }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                      style={{ background: `${q.color}16`, color: q.color }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold">{q.label}</span>
                      <span className="block truncate text-[9px] text-[var(--muted-foreground)]">{q.desc}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Топы ═══ */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--pos)' }} /> Топ роста · 24ч
          </h3>
          <div className="mt-4 space-y-2.5">
            {gainers.length === 0 && <EmptyState title="Сбор данных рынка…" />}
            {gainers.map((t, i) => (
              <TopRow key={t.symbol} t={t} i={i} max={maxG} positive />
            ))}
          </div>
        </div>
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingDown className="h-4 w-4" style={{ color: 'var(--neg)' }} /> Топ падения · 24ч
          </h3>
          <div className="mt-4 space-y-2.5">
            {losers.length === 0 && <EmptyState title="Сбор данных рынка…" />}
            {losers.map((t, i) => (
              <TopRow key={t.symbol} t={t} i={i} max={maxL} />
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Движки сессии ═══ */}
      <div className="cp-border-glow rounded-2xl bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Activity className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Движки сессии
        </h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { name: 'Плотности', count: stats.densities, color: '#f59e0b', icon: <Layers className="h-3.5 w-3.5" /> },
            { name: 'Движения', count: stats.movements, color: '#10b981', icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
            { name: 'Арбитраж', count: stats.arbitrages, color: '#22d3ee', icon: <ArrowDownRight className="h-3.5 w-3.5" /> },
            { name: 'Новости', count: stats.news, color: '#f472b6', icon: <Newspaper className="h-3.5 w-3.5" /> },
          ].map((e) => (
            <div key={e.name} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 transition-colors hover:border-[color-mix(in_srgb,var(--acc)_30%,transparent)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${e.color}18`, color: e.color }}>{e.icon}</span>
              <span className="flex-1 text-xs font-semibold">{e.name}</span>
              <span className="cp-num text-sm font-bold" style={{ color: e.color }}>{e.count.toLocaleString('ru-RU')}</span>
              <div className="hidden w-24 sm:block">
                <SlideBar pct={e.count} max={Math.max(stats.densities, stats.movements, stats.arbitrages, stats.news, 1)} positive={false} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
          <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} />
          Движки активны · аптайм {uptime} · тикеров в потоке: {useLive.getState().tickers ? Object.keys(useLive.getState().tickers).length.toLocaleString('ru-RU') : '…'}
        </div>
      </div>
    </div>
  )
}

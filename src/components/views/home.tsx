'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Bell, Clock, Flame, Gauge, Layers, Newspaper, Snowflake, TrendingDown, TrendingUp } from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { EX_MAP, FG_LABEL, fmtTime, fmtUsd, type TickerSnapshot } from '@/engines/types'
import { AnimatedNumber, EmptyState, ExBadge, FearGreedGauge, Pct, SlideBar, Sparkline, StatCard, useUptime } from '@/components/ui-bits'

export function HomeView() {
  const setView = useApp((s) => s.setView)
  const tickers = useLive((s) => s.tickers)
  const topMovers = useLive((s) => s.topMovers)
  const fearGreed = useLive((s) => s.fearGreed)
  const notifications = useLive((s) => s.notifications)
  const stats = useLive((s) => s.stats)
  const densityEvents = useLive((s) => s.densityEvents)
  const arbitrageOpps = useLive((s) => s.arbitrageOpps)
  const news = useLive((s) => s.news)
  const uptime = useUptime()

  const { gainers, losers } = useMemo(() => {
    // основной источник — реальные топы с market-сервиса;
    // до их прихода — то, что накопилось в потоке тикеров
    if (topMovers.gainers.length > 0 || topMovers.losers.length > 0) {
      return { gainers: topMovers.gainers, losers: topMovers.losers }
    }
    const all = Object.values(tickers)
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
  }, [tickers, topMovers])

  const activeDensities = useMemo(
    () => Object.values(densityEvents).reduce((acc, list) => acc + list.length, 0),
    [densityEvents],
  )
  const movementsToday = stats.movements
  const maxG = Math.max(...gainers.map((t) => Math.abs(t.change24hPct)), 1)
  const maxL = Math.max(...losers.map((t) => Math.abs(t.change24hPct)), 1)

  return (
    <div className="space-y-6">
      {/* Стат-карточки */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Аптайм сессии" value={uptime} sub={`${stats.ticks.toLocaleString('ru-RU')} тиков движка`} icon={<Clock className="h-4 w-4" />}
        />
        <StatCard label="Активные плотности" value={<AnimatedNumber value={activeDensities} />} sub={`${stats.densities.toLocaleString('ru-RU')} за сессию`} icon={<Layers className="h-4 w-4" />} accent="#f59e0b" />
        <StatCard label="Движения" value={<AnimatedNumber value={movementsToday} />} sub="сработавших алертов" icon={<TrendingUp className="h-4 w-4" />} accent="#10b981" />
        <StatCard label="Арбитраж" value={<AnimatedNumber value={arbitrageOpps.length} />} sub={`спред ≥ ${(useApp.getState().arbitrage.minSpreadPct).toFixed(1)}%`} icon={<Gauge className="h-4 w-4" />} accent="#22d3ee" />
        <StatCard label="Новости" value={<AnimatedNumber value={news.length} />} sub="в ленте движка" icon={<Newspaper className="h-4 w-4" />} accent="#f472b6" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Страх и жадность */}
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
          <div className="mt-4 flex flex-col items-center">
            <FearGreedGauge value={fearGreed.value} size={190} />
            <div className="mt-2 text-sm font-bold" style={{ color: fearGreed.value <= 24 ? '#f43f5e' : fearGreed.value <= 44 ? '#fb923c' : fearGreed.value <= 55 ? '#fbbf24' : fearGreed.value <= 74 ? '#a3e635' : '#34d399' }}>
              {FG_LABEL(fearGreed.value)}
            </div>
            <Sparkline data={fearGreed.history} width={220} height={36} className="mt-3" positive={fearGreed.history[fearGreed.history.length - 1] >= (fearGreed.history[0] ?? 0)} />
            <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">динамика за 30 периодов</div>
          </div>
        </div>

        {/* Топ роста */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--pos)' }} /> Топ роста · 24ч
          </h3>
          <div className="mt-4 space-y-2.5">
            {gainers.length === 0 && <EmptyState title="Сбор данных рынка…" />}
            {gainers.map((t, i) => (
              <motion.div key={t.symbol} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="group">
                <div className="flex items-center gap-2 text-xs">
                  <span className="cp-num w-4 text-[10px] font-bold text-[var(--muted-foreground)]">{i + 1}</span>
                  <span className="w-14 truncate font-bold">{t.symbol}</span>
                  <ExBadge ex={t.exchange} size="sm" />
                  <span className="cp-num ml-auto text-[10px] text-[var(--muted-foreground)]">{fmtUsd(t.vol24h)}</span>
                  <Pct v={t.change24hPct} bold className="w-16 text-right" />
                </div>
                <div className="mt-1 pl-6">
                  <SlideBar pct={t.change24hPct} max={maxG} positive delay={i * 40} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Топ падения */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TrendingDown className="h-4 w-4" style={{ color: 'var(--neg)' }} /> Топ падения · 24ч
          </h3>
          <div className="mt-4 space-y-2.5">
            {losers.length === 0 && <EmptyState title="Сбор данных рынка…" />}
            {losers.map((t, i) => (
              <motion.div key={t.symbol} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="cp-num w-4 text-[10px] font-bold text-[var(--muted-foreground)]">{i + 1}</span>
                  <span className="w-14 truncate font-bold">{t.symbol}</span>
                  <ExBadge ex={t.exchange} size="sm" />
                  <span className="cp-num ml-auto text-[10px] text-[var(--muted-foreground)]">{fmtUsd(t.vol24h)}</span>
                  <Pct v={t.change24hPct} bold className="w-16 text-right" />
                </div>
                <div className="mt-1 pl-6">
                  <SlideBar pct={t.change24hPct} max={maxL} delay={i * 40} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Последние уведомления */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Bell className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Последние уведомления
            </h3>
            <button onClick={() => setView('notifications')} className="text-xs font-semibold transition-opacity hover:opacity-80" style={{ color: 'var(--acc)' }}>
              Весь журнал →
            </button>
          </div>
          <div className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {notifications.length === 0 && <EmptyState icon={<Bell className="h-8 w-8" />} title="Сигналов пока нет" hint="Как только плотность, движение или арбитраж пройдут ваши фильтры — они появятся здесь" />}
            {notifications.slice(0, 10).map((n) => (
              <button key={n.id} onClick={() => setView('notifications')} className="cp-row-in flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--acc)_40%,transparent)]">
                <span className="cp-num w-11 shrink-0 text-[10px] text-[var(--muted-foreground)]">{fmtTime(n.time)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{n.title}</span>
                  <span className="block truncate text-[11px] text-[var(--muted-foreground)]">{n.message}</span>
                </span>
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--acc)', boxShadow: '0 0 8px var(--acc)' }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Аптайм и движки */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Аптайм и движки
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Аптайм сессии</div>
              <div className="cp-num mt-1 text-2xl font-black" style={{ color: 'var(--acc)' }}>{uptime}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: 'var(--pos)' }} /> движки активны
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Тикеров в потоке</div>
              <div className="cp-num mt-1 text-2xl font-black">{Object.keys(tickers).length > 0 ? Object.keys(tickers).length.toLocaleString('ru-RU') : '…'}</div>
              <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">реальные данные 8 бирж · F+S</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { name: 'Плотности', count: stats.densities, color: '#f59e0b', icon: <Layers className="h-3.5 w-3.5" /> },
              { name: 'Движения', count: stats.movements, color: '#10b981', icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
              { name: 'Арбитраж', count: stats.arbitrages, color: '#22d3ee', icon: <ArrowDownRight className="h-3.5 w-3.5" /> },
              { name: 'Новости', count: stats.news, color: '#f472b6', icon: <Newspaper className="h-3.5 w-3.5" /> },
            ].map((e) => (
              <div key={e.name} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${e.color}18`, color: e.color }}>{e.icon}</span>
                <span className="flex-1 text-xs font-semibold">{e.name}</span>
                <span className="cp-num text-sm font-bold" style={{ color: e.color }}>{e.count.toLocaleString('ru-RU')}</span>
                <div className="hidden w-24 sm:block">
                  <SlideBar pct={e.count} max={Math.max(stats.densities, stats.movements, stats.arbitrages, stats.news, 1)} positive={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


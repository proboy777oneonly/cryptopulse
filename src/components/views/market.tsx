'use client'

// ════════════════════════════════════════════════════════════════════
// Вкладка «Обзор рынка»: графики + тикеры, 3 биржи (BINANCE/BYBIT/OKX),
// автоварьировка тикера с наибольшим объёмом 24ч на бирже,
// рисовалки на графике и линейка на колёсико мыши.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickChart, ChevronDown, MousePointer2, MoveHorizontal, MoveVertical, RotateCcw,
  Ruler, Search, Sigma, Slash, Square, Trash2,
} from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { getHub } from '@/engines/hub'
import { fmtUsd, type SymbolRow, type TickerSnapshot } from '@/engines/types'
import { TickerCopy, splitQuote } from '@/components/ui-bits'
import { cn } from '@/lib/utils'
import { CandleChart, fmtChartPrice, type Candle, type ChartTool } from './chart-canvas'

type Ex3 = 'BINANCE' | 'BYBIT' | 'OKX'
type Mkt = 'F' | 'S'

const EX3: { id: Ex3; name: string; color: string }[] = [
  { id: 'BINANCE', name: 'Binance', color: '#F0B90B' },
  { id: 'BYBIT', name: 'Bybit', color: '#F7A600' },
  { id: 'OKX', name: 'OKX', color: '#97a7c4' },
]

const INTERVALS: { id: string; label: string }[] = [
  { id: '1m', label: '1м' }, { id: '5m', label: '5м' }, { id: '15m', label: '15м' },
  { id: '1h', label: '1ч' }, { id: '4h', label: '4ч' }, { id: '1d', label: '1Д' }, { id: '1w', label: '1Н' },
]

const TOOLS: { id: ChartTool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'cursor', icon: MousePointer2, label: 'Курсор' },
  { id: 'trend', icon: Slash, label: 'Линия тренда' },
  { id: 'hline', icon: MoveHorizontal, label: 'Горизонтальная линия' },
  { id: 'vline', icon: MoveVertical, label: 'Вертикальная линия' },
  { id: 'rect', icon: Square, label: 'Прямоугольник' },
  { id: 'fib', icon: Sigma, label: 'Уровни Фибоначчи' },
  { id: 'ruler', icon: Ruler, label: 'Линейка' },
]

/** выбранный тикер на бирже+рынке — переживает переключения вкладок */
const marketSel = new Map<string, string>()

/** фетч с ретраями: транзитные 5xx/сетевые сбои не должны оставлять график пустым */
async function fetchRetry(url: string, tries = 3, delayMs = 3000): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status < 500 || i === tries - 1) return r
    } catch {
      if (i === tries - 1) throw new Error('fetch failed')
    }
    await new Promise((res) => setTimeout(res, delayMs))
  }
  throw new Error('fetch failed')
}

function ChangeChip({ label, v }: { label: string; v?: number }) {
  if (v === undefined || !Number.isFinite(v)) return null
  const up = v >= 0
  return (
    <span
      className="cp-num flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold"
      style={{
        color: up ? 'var(--pos)' : 'var(--neg)',
        borderColor: up ? 'color-mix(in srgb, var(--pos) 30%, transparent)' : 'color-mix(in srgb, var(--neg) 30%, transparent)',
        background: up ? 'color-mix(in srgb, var(--pos) 8%, transparent)' : 'color-mix(in srgb, var(--neg) 8%, transparent)',
      }}
    >
      <span className="text-[9px] font-semibold opacity-70">{label}</span>
      {up ? '+' : ''}{v.toFixed(2)}%
    </span>
  )
}

// ─── Выбор тикера ──────────────────────────────────────────────────────

function SymbolPicker({ rows, value, onSelect }: { rows: SymbolRow[]; value: string; onSelect: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const qq = q.trim().toUpperCase()
    return (qq === '' ? rows : rows.filter((r) => r.symbol.includes(qq))).slice(0, 150)
  }, [rows, q])
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!open) {
            setQ('')
            setTimeout(() => inputRef.current?.focus(), 30)
          }
          setOpen((v) => !v)
        }}
        className="cp-num flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 text-[15px] font-black tracking-tight transition-all hover:border-[color-mix(in_srgb,var(--acc)_45%,transparent)]"
        aria-expanded={open}
      >
        {value || '—'}
        <ChevronDown className={cn('h-4 w-4 text-[var(--muted-foreground)] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-[52px] z-50 w-[340px] max-w-[92vw] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card-solid)]"
            style={{ boxShadow: '0 24px 60px -20px var(--glow)' }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск тикера…"
                className="cp-num h-7 w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
            <div className="max-h-[340px] overflow-y-auto p-1.5">
              {list.length === 0 && (
                <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">Ничего не найдено</div>
              )}
              {list.map((r) => {
                const { base, quote } = splitQuote(r.symbol)
                const active = r.symbol === value
                return (
                  <button
                    key={r.symbol}
                    onClick={() => { onSelect(r.symbol); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-[color-mix(in_srgb,var(--acc)_12%,transparent)]' : 'hover:bg-[var(--muted)]',
                    )}
                  >
                    <span className="cp-num min-w-0 flex-1 truncate text-[13px] font-bold">
                      {base}
                      {quote && <span className="text-[10px] font-semibold text-[var(--muted-foreground)] opacity-70"> {quote}</span>}
                    </span>
                    <span
                      className="cp-num w-[62px] shrink-0 text-right text-[11px] font-bold"
                      style={{ color: r.change24hPct >= 0 ? 'var(--pos)' : 'var(--neg)' }}
                    >
                      {r.change24hPct >= 0 ? '+' : ''}{r.change24hPct.toFixed(2)}%
                    </span>
                    <span className="cp-num w-[56px] shrink-0 text-right text-[10px] text-[var(--muted-foreground)]">{fmtUsd(r.vol24h)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Список монет ──────────────────────────────────────────────────────

function CoinsPanel({
  rows, tickers, selected, onSelect, exKey,
}: {
  rows: SymbolRow[]
  tickers: Record<string, TickerSnapshot>
  selected: string
  onSelect: (s: string) => void
  exKey: string
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const qq = q.trim().toUpperCase()
    return (qq === '' ? rows : rows.filter((r) => r.symbol.includes(qq))).slice(0, 90)
  }, [rows, q])

  return (
    <div className="cp-border-glow flex min-h-0 flex-1 flex-col rounded-2xl bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CandlestickChart className="h-4 w-4" style={{ color: 'var(--acc)' }} />
          Монеты
          <span className="cp-num rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">{rows.length}</span>
        </h3>
      </div>
      <div className="px-2.5 pt-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск монеты…"
            className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] pl-8 pr-3 text-xs font-semibold outline-none transition-colors focus:border-[color-mix(in_srgb,var(--acc)_45%,transparent)]"
          />
        </div>
      </div>
      {/* шапка колонок */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_64px_52px_58px] gap-1 px-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        <span>Тикер</span>
        <span className="text-right">24ч</span>
        <span className="text-right">5м</span>
        <span className="text-right">Объём</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {list.length === 0 && (
          <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">Список загружается…</div>
        )}
        {list.map((r, i) => {
          const live = tickers[`${exKey}:${r.symbol}`]
          const chg = live?.change24hPct ?? r.change24hPct
          const chg5 = live?.change5mPct
          const active = r.symbol === selected
          const { base, quote } = splitQuote(r.symbol)
          return (
            <div
              key={r.symbol}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(r.symbol)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.symbol) }}
              className={cn(
                'group grid cursor-pointer grid-cols-[minmax(0,1fr)_64px_52px_58px] items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors',
                active
                  ? 'bg-[color-mix(in_srgb,var(--acc)_14%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--acc)_35%,transparent)]'
                  : 'hover:bg-[var(--muted)]',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="cp-num w-4 shrink-0 text-[9px] font-bold text-[var(--muted-foreground)] opacity-60">{i + 1}</span>
                <TickerCopy
                  symbol={r.symbol}
                  display={base}
                  className="min-w-0 truncate text-[12px] font-black tracking-tight"
                />
                {quote && <span className="shrink-0 text-[8px] font-bold text-[var(--muted-foreground)] opacity-60">{quote}</span>}
              </span>
              <span
                className="cp-num text-right text-[11px] font-bold"
                style={{ color: chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}
              >
                {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
              </span>
              <span
                className="cp-num text-right text-[10px] font-semibold"
                style={chg5 === undefined ? { color: 'var(--muted-foreground)' } : { color: chg5 >= 0 ? 'var(--pos)' : 'var(--neg)' }}
              >
                {chg5 === undefined ? '—' : `${chg5 >= 0 ? '+' : ''}${chg5.toFixed(2)}%`}
              </span>
              <span className="cp-num text-right text-[10px] text-[var(--muted-foreground)]">{fmtUsd(r.vol24h)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Вкладка ───────────────────────────────────────────────────────────

export function MarketView() {
  const theme = useApp((s) => s.theme)
  const tickers = useLive((s) => s.tickers)

  const [ex, setEx] = useState<Ex3>('BINANCE')
  const [m, setM] = useState<Mkt>('F')
  const [symbol, setSymbol] = useState('')
  const [interval, setIntervalId] = useState('15m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [mini, setMini] = useState<Candle[]>([])
  const [symbols, setSymbols] = useState<SymbolRow[]>([])
  const [loadedKey, setLoadedKey] = useState('')
  const [tool, setTool] = useState<ChartTool>('cursor')
  const [clearTick, setClearTick] = useState(0)
  const [reload, setReload] = useState(0)
  const [miniReload, setMiniReload] = useState(0)

  const exMeta = EX3.find((e) => e.id === ex) ?? EX3[0]
  const selKey = `${ex}_${m}`

  // ── Символы биржи + автоварьировка топ-объёма ─────────────────────
  useEffect(() => {
    let cancel = false
    const load = async () => {
      const rows = await getHub().fetchSymbols(ex, m)
      if (cancel) return
      const sorted = [...rows].sort((a, b) => b.vol24h - a.vol24h)
      setSymbols(sorted)
      const saved = marketSel.get(selKey)
      if (saved && sorted.some((r) => r.symbol === saved)) {
        setSymbol((cur) => (cur === saved ? cur : saved))
      } else if (sorted.length > 0) {
        marketSel.set(selKey, sorted[0].symbol)
        setSymbol(sorted[0].symbol)
      }
    }
    void load()
    const iv = setInterval(() => void load(), 60_000)
    return () => { cancel = true; clearInterval(iv) }
  }, [ex, m, selKey])

  // ── Свечи основного графика ───────────────────────────────────────
  const reqKey = `${ex}|${m}|${symbol}|${interval}`
  const loading = loadedKey !== reqKey
  useEffect(() => {
    if (!symbol) return
    let cancel = false
    fetchRetry(`/api/klines?ex=${ex}&m=${m}&symbol=${symbol}&interval=${interval}&limit=400`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return (await r.json()) as { candles?: Candle[] }
      })
      .then((d) => {
        if (cancel) return
        setCandles(d.candles ?? [])
        setLoadedKey(reqKey)
      })
      .catch(() => {
        if (cancel) return
        setCandles([])
        setLoadedKey(reqKey)
      })
    return () => { cancel = true }
  }, [ex, m, symbol, interval, reqKey, reload])

  // ── Мини-график 1м ────────────────────────────────────────────────
  useEffect(() => {
    if (!symbol) return
    let cancel = false
    fetchRetry(`/api/klines?ex=${ex}&m=${m}&symbol=${symbol}&interval=1m&limit=160`, 2, 2000)
      .then(async (r) => (r.ok ? ((await r.json()) as { candles?: Candle[] }) : { candles: [] }))
      .then((d) => { if (!cancel) setMini(d.candles ?? []) })
      .catch(() => { if (!cancel) setMini([]) })
    return () => { cancel = true }
  }, [ex, m, symbol, miniReload])

  // автообновление: короткие ТФ — 30с, длинные — 120с; мини — 20с
  useEffect(() => {
    const fast = interval === '1m' || interval === '5m' || interval === '15m'
    const t = setTimeout(() => setReload((v) => v + 1), fast ? 30_000 : 120_000)
    return () => clearTimeout(t)
  }, [interval, reload])

  useEffect(() => {
    const t = setTimeout(() => setMiniReload((v) => v + 1), 20_000)
    return () => clearTimeout(t)
  }, [miniReload])

  // ── Живая цена выбранного тикера ──────────────────────────────────
  const live = tickers[`${ex}:${m}:${symbol}`]
  const lastC = candles.length > 0 ? candles[candles.length - 1] : null
  const price = live?.price ?? lastC?.c ?? 0
  const row = symbols.find((r) => r.symbol === symbol)
  const chg24 = live?.change24hPct ?? row?.change24hPct
  const chg1 = live?.change1mPct
  const chg5 = live?.change5mPct
  const vol = live?.vol24h ?? row?.vol24h

  const selectSymbol = (s: string) => {
    marketSel.set(selKey, s)
    setSymbol(s)
  }

  const chartKey = `${ex}|${m}|${symbol}|${interval}`
  const { base, quote } = splitQuote(symbol)

  return (
    <div className="flex h-[calc(100dvh-113px)] min-h-[560px] flex-col gap-3">
      {/* ── Верхняя панель: биржи · рынок · тикер · цена ───────────── */}
      <div className="cp-border-glow flex flex-wrap items-center gap-2 rounded-2xl bg-card px-3 py-2.5">
        {/* биржи */}
        <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {EX3.map((e) => (
            <button
              key={e.id}
              onClick={() => setEx(e.id)}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all',
                ex === e.id ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              style={ex === e.id ? { background: `${e.color}22`, boxShadow: `inset 0 0 0 1px ${e.color}55` } : undefined}
              aria-pressed={ex === e.id}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
              {e.name.toUpperCase()}
            </button>
          ))}
        </div>
        {/* рынок */}
        <div className="flex h-10 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-0.5">
          {(['F', 'S'] as Mkt[]).map((mm) => (
            <button
              key={mm}
              onClick={() => setM(mm)}
              className={cn(
                'flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-black transition-all',
                m === mm ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              style={m === mm ? { background: mm === 'F' ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#22d3ee,#06b6d4)' } : undefined}
              aria-pressed={m === mm}
            >
              {mm === 'F' ? 'ФЬЮЧЕРСЫ' : 'СПОТ'}
            </button>
          ))}
        </div>
        {/* тикер */}
        <SymbolPicker rows={symbols} value={symbol} onSelect={selectSymbol} />
        {/* цена */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="cp-num text-xl font-black tracking-tight" style={{ color: chg24 === undefined ? 'var(--foreground)' : chg24 >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
            {price > 0 ? fmtChartPrice(price) : '…'}
          </span>
          <ChangeChip label="1м" v={chg1} />
          <ChangeChip label="5м" v={chg5} />
          <ChangeChip label="24ч" v={chg24} />
          {vol !== undefined && (
            <span className="cp-num hidden h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2 text-[11px] font-bold text-[var(--muted-foreground)] sm:flex">
              объём {fmtUsd(vol)}
            </span>
          )}
        </div>
        {/* живой бейдж */}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted-foreground)]">
          <span className="cp-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: live ? 'var(--pos)' : '#f59e0b' }} />
          {live ? 'LIVE' : 'по свечам'}
        </span>
      </div>

      {/* ── Основная область ────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* график + тулбар */}
        <div className="flex min-h-[340px] flex-1 flex-col gap-2">
          {/* тулбар: рисовалки · таймфреймы · сброс */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-0.5">
              {TOOLS.map((t) => {
                const Icon = t.icon
                const active = tool === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    aria-label={t.label}
                    aria-pressed={active}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                      active ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                    )}
                    style={active ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))', boxShadow: '0 0 12px -4px var(--glow)' } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
              <button
                onClick={() => { localStorage.removeItem(`cp-draw-${chartKey}`); setClearTick((v) => v + 1) }}
                aria-label="Удалить все рисунки"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] hover:text-[var(--destructive)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {/* таймфреймы */}
            <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-0.5">
              {INTERVALS.map((iv) => (
                <button
                  key={iv.id}
                  onClick={() => setIntervalId(iv.id)}
                  className={cn(
                    'cp-num flex h-8 items-center justify-center rounded-lg px-2 text-[11px] font-black transition-all',
                    interval === iv.id ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                  )}
                  style={interval === iv.id ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
                  aria-pressed={interval === iv.id}
                >
                  {iv.label}
                </button>
              ))}
              <button
                onClick={() => setReload((v) => v + 1)}
                aria-label="Обновить свечи"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <RotateCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
            <span className="ml-auto hidden text-[10px] text-[var(--muted-foreground)] xl:block">
              колесо — зум · клик по колёсику — линейка · правый клик — удалить рисунок · двойной клик — сброс вида
            </span>
          </div>

          {/* график */}
          <div
            className="cp-border-glow relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[var(--card-solid)]"
            style={{ borderTop: `2px solid ${exMeta.color}55` }}
          >
            <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex items-center gap-2">
              <span className="cp-num rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
                {exMeta.name.toUpperCase()} · {m} · {base}
                {quote && <span className="opacity-60">/{quote}</span>} · {interval}
              </span>
            </div>
            <CandleChart
              candles={candles}
              interval={interval}
              chartKey={chartKey}
              tool={tool}
              onToolDone={() => setTool('cursor')}
              livePrice={live?.price}
              theme={theme}
              clearTick={clearTick}
            />
          </div>
        </div>

        {/* правая колонка: мини-график + монеты */}
        <div className="flex min-h-0 w-full shrink-0 flex-col gap-3 lg:w-[330px]">
          <div className="cp-border-glow relative h-[178px] shrink-0 overflow-hidden rounded-2xl bg-[var(--card-solid)]">
            <div className="pointer-events-none absolute left-3 top-2 z-10">
              <span className="cp-num rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">1м · {base}</span>
            </div>
            <CandleChart
              candles={mini}
              interval="1m"
              livePrice={live?.price}
              theme={theme}
              showVolume={false}
              interactive={false}
            />
          </div>
          <CoinsPanel
            rows={symbols}
            tickers={tickers}
            selected={symbol}
            onSelect={selectSymbol}
            exKey={`${ex}:${m}`}
          />
        </div>
      </div>
    </div>
  )
}

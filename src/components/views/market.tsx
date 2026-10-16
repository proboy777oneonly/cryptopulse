'use client'

// ════════════════════════════════════════════════════════════════════
// Вкладка «Обзор рынка»: график с рисовалками (вертикально слева) и
// таймфреймами (сверху по центру); справа — выбор биржи BINANCE/BYBIT/OKX,
// рынок F/S и список монет с автоварьировкой топ-объёма 24ч.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react'
import {
  MousePointer2, MoveHorizontal, MoveVertical, RotateCcw,
  Ruler, Search, Sigma, Slash, Square, Trash2,
} from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { getHub } from '@/engines/hub'
import { fmtUsd, type SymbolRow, type TickerSnapshot } from '@/engines/types'
import { TickerCopy, splitQuote } from '@/components/ui-bits'
import { cn } from '@/lib/utils'
import { CandleChart, type Candle, type ChartTool } from './chart-canvas'

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

// ─── Правая колонка: биржа · рынок · список монет ──────────────────────

function CoinsPanel({
  rows, tickers, selected, onSelect, exKey, ex, m, onEx, onM,
}: {
  rows: SymbolRow[]
  tickers: Record<string, TickerSnapshot>
  selected: string
  onSelect: (s: string) => void
  exKey: string
  ex: Ex3
  m: Mkt
  onEx: (e: Ex3) => void
  onM: (mm: Mkt) => void
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const qq = q.trim().toUpperCase()
    return (qq === '' ? rows : rows.filter((r) => r.symbol.includes(qq))).slice(0, 90)
  }, [rows, q])

  return (
    <div className="cp-border-glow flex min-h-0 flex-1 flex-col rounded-2xl bg-card">
      {/* биржи + рынок — вместо прежнего заголовка «Монеты» */}
      <div className="flex flex-col gap-1.5 border-b border-[var(--border)] p-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {EX3.map((e) => {
            const active = ex === e.id
            return (
              <button
                key={e.id}
                onClick={() => onEx(e.id)}
                className={cn(
                  'flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-black tracking-tight transition-all',
                  active
                    ? 'text-[var(--foreground)]'
                    : 'border-transparent bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
                style={active ? { background: `${e.color}1f`, borderColor: `${e.color}66` } : undefined}
                aria-pressed={active}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                {e.name.toUpperCase()}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(['F', 'S'] as Mkt[]).map((mm) => (
            <button
              key={mm}
              onClick={() => onM(mm)}
              className={cn(
                'flex h-9 items-center justify-center rounded-lg text-[10px] font-black transition-all',
                m === mm ? 'text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              style={m === mm ? { background: mm === 'F' ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#22d3ee,#06b6d4)' } : undefined}
              aria-pressed={m === mm}
            >
              {mm === 'F' ? 'ФЬЮЧЕРСЫ' : 'СПОТ'}
            </button>
          ))}
        </div>
      </div>
      {/* поиск */}
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
  const [symbols, setSymbols] = useState<SymbolRow[]>([])
  const [loadedKey, setLoadedKey] = useState('')
  const [tool, setTool] = useState<ChartTool>('cursor')
  const [clearTick, setClearTick] = useState(0)
  const [reload, setReload] = useState(0)

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

  // автообновление: короткие ТФ — 30с, длинные — 120с
  useEffect(() => {
    const fast = interval === '1m' || interval === '5m' || interval === '15m'
    const t = setTimeout(() => setReload((v) => v + 1), fast ? 30_000 : 120_000)
    return () => clearTimeout(t)
  }, [interval, reload])

  // ── Живая цена выбранного тикера (для легенды графика) ───────────
  const live = tickers[`${ex}:${m}:${symbol}`]
  const row = symbols.find((r) => r.symbol === symbol)
  const chg24 = live?.change24hPct ?? row?.change24hPct

  const selectSymbol = (s: string) => {
    marketSel.set(selKey, s)
    setSymbol(s)
  }

  const chartKey = `${ex}|${m}|${symbol}|${interval}`
  const { base, quote } = splitQuote(symbol)
  const ivLabel = INTERVALS.find((iv) => iv.id === interval)?.label ?? interval

  return (
    <div className="flex h-[calc(100dvh-113px)] min-h-[560px] gap-3">
      {/* график: таймфреймы сверху по центру, рисовалки слева */}
      <div
        className="cp-border-glow relative min-h-[340px] min-w-0 flex-1 overflow-hidden rounded-2xl bg-[var(--card-solid)]"
        style={{ borderTop: `2px solid ${exMeta.color}55` }}
      >
          {/* таймфреймы — верхняя линия, по центру */}
          <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-0.5 shadow-lg">
            {INTERVALS.map((iv) => (
              <button
                key={iv.id}
                onClick={() => setIntervalId(iv.id)}
                className={cn(
                  'cp-num flex h-7 items-center justify-center rounded-lg px-2 text-[10px] font-black transition-all',
                  interval === iv.id ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
                style={interval === iv.id ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
                aria-pressed={interval === iv.id}
              >
                {iv.label}
              </button>
            ))}
            <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
            <button
              onClick={() => setReload((v) => v + 1)}
              aria-label="Обновить свечи"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* рисовалки — слева, вертикально */}
          <div className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-0.5 shadow-lg">
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
            <div className="my-0.5 h-px bg-[var(--border)]" />
            <button
              onClick={() => { localStorage.removeItem(`cp-draw-${chartKey}`); setClearTick((v) => v + 1) }}
              aria-label="Удалить все рисунки"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] hover:text-[var(--destructive)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <CandleChart
            candles={candles}
            interval={interval}
            chartKey={chartKey}
            tool={tool}
            onToolDone={() => setTool('cursor')}
            livePrice={live?.price}
            chg24={chg24}
            theme={theme}
            clearTick={clearTick}
            label={`${exMeta.name.toUpperCase()} · ${m} · ${base}${quote ? `/${quote}` : ''} · ${ivLabel}`}
            padLeft={46}
          />
        </div>

        {/* правая колонка: биржи · рынок · монеты */}
        <div className="flex min-h-0 w-full shrink-0 flex-col lg:w-[330px]">
          <CoinsPanel
            rows={symbols}
            tickers={tickers}
            selected={symbol}
            onSelect={selectSymbol}
            exKey={`${ex}:${m}`}
            ex={ex}
            m={m}
            onEx={setEx}
            onM={setM}
          />
        </div>
    </div>
  )
}

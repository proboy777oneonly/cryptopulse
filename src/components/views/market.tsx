'use client'

// ════════════════════════════════════════════════════════════════════
// Вкладка «Обзор рынка»: терминал графиков.
// • Режим 1 / 2 графика: один тикер, независимые таймфреймы
// • Зум колесом + кнопки +/−/сброс, панорама, рисовалки, линейка
// • Живая последняя свеча из потока (реальное время)
// • Ценовые уведомления при пересечении уровня
// • До 1000+ свечей истории (OKX — пагинация)
// • Правая колонка: биржи+F/S в одну строку, сортировка 24ч/NATR/объём,
//   клик по тикеру копирует его
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BellPlus, BellRing, Columns2, Maximize, Minimize, MousePointer2, MoveHorizontal, MoveVertical,
  RotateCcw, Ruler, Search, Sigma, Slash, Square, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import { getHub } from '@/engines/hub'
import { emitNotification } from '@/engines/notifier'
import { fmtPrice, fmtUsd, type SymbolRow, type TickerSnapshot } from '@/engines/types'
import { copyText, splitQuote, useTickersThrottled } from '@/components/ui-bits'
import { ExIcon } from '@/components/ex-icons'
import { cn } from '@/lib/utils'
import { CandleChart, type Candle, type ChartHandle, type ChartTool } from './chart-canvas'

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
  { id: 'alert', icon: BellPlus, label: 'Ценовое уведомление' },
]

const CANDLE_LIMIT = 1000

/** выбранный тикер на бирже+рынке — переживает переключения вкладок */
const marketSel = new Map<string, string>()
/** раскладка 1/2 графика — тоже переживает */
let marketLayout: '1' | '2' = '1'

// ─── Ценовые уведомления ─────────────────────────────────────────────

interface PriceAlert {
  id: string
  ex: Ex3
  m: Mkt
  symbol: string
  price: number
  createdAt: number
}

const ALERTS_KEY = 'cp-price-alerts-v1'

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as PriceAlert[]
    return Array.isArray(arr) ? arr.filter((a) => a && a.id && a.price > 0 && a.symbol) : []
  } catch {
    return []
  }
}

function saveAlerts(list: PriceAlert[]) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

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

/** свечи одного графика: загрузка + автообновление; loading вычисляется из загруженного ключа */
function useCandles(ex: Ex3, m: Mkt, symbol: string, interval: string, reload: number) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loadedKey, setLoadedKey] = useState('')
  const reqKey = `${ex}|${m}|${symbol}|${interval}`

  useEffect(() => {
    if (!symbol) return
    let cancel = false
    fetchRetry(`/api/klines?ex=${ex}&m=${m}&symbol=${symbol}&interval=${interval}&limit=${CANDLE_LIMIT}`)
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

  return { candles, loading: loadedKey !== reqKey }
}

// ─── Карточка одного графика ─────────────────────────────────────────

function ChartCard({
  ex, m, symbol, interval, setIntervalId, reload, onReload, tool, onToolSelect, onToolDone,
  alerts, onAlertSet, onAlertRemove, theme, exMeta, tag,
}: {
  ex: Ex3
  m: Mkt
  symbol: string
  interval: string
  setIntervalId: (v: string) => void
  reload: number
  onReload: () => void
  tool: ChartTool
  onToolSelect: (t: ChartTool) => void
  onToolDone: () => void
  alerts: PriceAlert[]
  onAlertSet: (price: number) => void
  onAlertRemove: (id: string) => void
  theme: string
  exMeta: { name: string; color: string }
  tag?: string
}) {
  const chartRef = useRef<ChartHandle>(null)
  const [clearTick, setClearTick] = useState(0)
  const { candles, loading } = useCandles(ex, m, symbol, interval, reload)

  // живая цена этого тикера — изолированная подписка (график дышит сам)
  const live = useTickersThrottled<TickerSnapshot | undefined>(1200, (t) => t[`${ex}:${m}:${symbol}`])
  const chg24 = live?.change24hPct

  const chartKey = `${ex}|${m}|${symbol}|${interval}`
  const { base, quote } = splitQuote(symbol)
  const ivLabel = INTERVALS.find((iv) => iv.id === interval)?.label ?? interval
  const priceMarks = useMemo(
    () => alerts.filter((a) => a.ex === ex && a.m === m && a.symbol === symbol).map((a) => ({ id: a.id, price: a.price })),
    [alerts, ex, m, symbol],
  )

  return (
    <div
      className="cp-border-glow relative flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--card-solid)]"
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
          onClick={onReload}
          aria-label="Обновить свечи"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <RotateCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* бейдж графика (во 2-режиме) — внизу слева, не мешает легенде и тостам */}
      {tag && (
        <span
          className="absolute bottom-7 left-14 z-20 rounded-md px-2 py-1 text-[9px] font-black tracking-wider text-white"
          style={{ background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' }}
        >
          {tag}
        </span>
      )}

      {/* рисовалки — слева, вертикально */}
      <div className="absolute left-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-0.5 shadow-lg">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const active = tool === t.id
          return (
            <button
              key={t.id}
              onClick={() => onToolSelect(t.id)}
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

      {/* зум-кнопки — справа, вертикально */}
      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-0.5 shadow-lg">
        <button
          onClick={() => chartRef.current?.zoomBy(1 / 1.3)}
          aria-label="Приблизить (сжать шкалу)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => chartRef.current?.zoomBy(1.3)}
          aria-label="Отдалить (растянуть шкалу)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="my-0.5 h-px bg-[var(--border)]" />
        <button
          onClick={() => chartRef.current?.reset()}
          aria-label="Сбросить масштаб"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <CandleChart
        ref={chartRef}
        candles={candles}
        interval={interval}
        chartKey={chartKey}
        tool={tool}
        onToolDone={onToolDone}
        livePrice={live?.price}
        chg24={chg24}
        theme={theme}
        clearTick={clearTick}
        label={`${exMeta.name.toUpperCase()} · ${m} · ${base}${quote ? `/${quote}` : ''} · ${ivLabel}`}
        padLeft={46}
        priceMarks={priceMarks}
        onAlertSet={onAlertSet}
        onAlertRemove={onAlertRemove}
      />
    </div>
  )
}

// ─── Правая колонка: биржи · рынок · список монет ────────────────────

type SortKey = 'vol' | 'chg' | 'natr'
type SortDir = 'asc' | 'desc'

/** кликабельный заголовок сортировки */
function SortHead({ k, label, sortKey, sortDir, onSort }: { k: SortKey; label: string; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void }) {
  return (
    <button
      onClick={() => onSort(k)}
      className="flex items-center justify-end gap-0.5 transition-colors hover:text-[var(--foreground)]"
      title={k === 'natr' ? 'NATR — нормализованная волатильность за 24ч' : undefined}
    >
      {label}
      <span className="text-[7px] leading-none" style={{ opacity: sortKey === k ? 1 : 0.25 }}>
        {sortKey === k && sortDir === 'asc' ? '▲' : '▼'}
      </span>
    </button>
  )
}

function CoinsPanel({
  rows, selected, onSelect, ex, m, onEx, onM, natr, sortKey, sortDir, onSort,
}: {
  rows: SymbolRow[]
  selected: string
  onSelect: (s: string) => void
  ex: Ex3
  m: Mkt
  onEx: (e: Ex3) => void
  onM: (mm: Mkt) => void
  natr: Record<string, number>
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState('')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exKey = `${ex}:${m}`

  // живые 24ч — троттлинг 2.5с, список не перерисовывается каждый тик
  const tickers = useTickersThrottled(2500, (t) => t)

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const list = useMemo(() => {
    const qq = q.trim().toUpperCase()
    let arr = qq === '' ? rows : rows.filter((r) => r.symbol.includes(qq))
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'vol') arr = [...arr].sort((a, b) => (a.vol24h - b.vol24h) * dir)
    else if (sortKey === 'chg') arr = [...arr].sort((a, b) => (a.change24hPct - b.change24hPct) * dir)
    else if (sortKey === 'natr') arr = [...arr].sort((a, b) => ((natr[a.symbol] ?? -1) - (natr[b.symbol] ?? -1)) * dir)
    return arr.slice(0, 90)
  }, [rows, q, sortKey, sortDir, natr])

  const pick = (s: string) => {
    onSelect(s)
    // выбрали тикер — сразу скопировали в буфер
    void copyText(s).then((ok) => {
      if (!ok) return
      setCopied(s)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(''), 1100)
    })
  }

  const SortHeadCmp = SortHead

  return (
    <div className="cp-border-glow flex min-h-0 flex-1 flex-col rounded-2xl bg-card">
      {/* биржи + F/S — одной строкой */}
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] p-2.5">
        <div className="flex flex-1 items-center gap-1.5">
          {EX3.map((e) => {
            const active = ex === e.id
            return (
              <button
                key={e.id}
                onClick={() => onEx(e.id)}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-black tracking-tight transition-all',
                  active
                    ? 'text-[var(--foreground)]'
                    : 'border-transparent bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                )}
                style={active ? { background: `${e.color}1f`, borderColor: `${e.color}66` } : undefined}
                aria-pressed={active}
                title={e.name}
              >
                <ExIcon ex={e.id} size={14} />
                {e.name.toUpperCase()}
              </button>
            )
          })}
        </div>
        <div className="h-6 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-1">
          {(['F', 'S'] as Mkt[]).map((mm) => (
            <button
              key={mm}
              onClick={() => onM(mm)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-[11px] font-black transition-all',
                m === mm ? 'text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              style={m === mm ? { background: mm === 'F' ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#22d3ee,#06b6d4)' } : undefined}
              aria-pressed={m === mm}
              aria-label={mm === 'F' ? 'Фьючерсы' : 'Спот'}
            >
              {mm}
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
      {/* шапка колонок: тикер | 24ч | NATR | объём */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_62px_56px_62px] gap-1 px-3.5 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
        <span>Тикер</span>
        <SortHeadCmp k="chg" label="24ч" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeadCmp k="natr" label="NATR" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <SortHeadCmp k="vol" label="Объём" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {list.length === 0 && (
          <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">Список загружается…</div>
        )}
        {list.map((r, i) => {
          const live = tickers[`${exKey}:${r.symbol}`]
          const chg = live?.change24hPct ?? r.change24hPct
          const nv = natr[r.symbol]
          const active = r.symbol === selected
          const wasCopied = copied === r.symbol
          const { base, quote } = splitQuote(r.symbol)
          return (
            <div
              key={r.symbol}
              role="button"
              tabIndex={0}
              onClick={() => pick(r.symbol)}
              onKeyDown={(e) => { if (e.key === 'Enter') pick(r.symbol) }}
              className={cn(
                'group grid cursor-pointer grid-cols-[minmax(0,1fr)_62px_56px_62px] items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors',
                active
                  ? 'bg-[color-mix(in_srgb,var(--acc)_14%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--acc)_35%,transparent)]'
                  : 'hover:bg-[var(--muted)]',
              )}
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="cp-num w-4 shrink-0 text-[9px] font-bold text-[var(--muted-foreground)] opacity-60">{i + 1}</span>
                <span className={cn('min-w-0 truncate text-[12px] font-black tracking-tight transition-colors group-hover:text-[var(--acc)]', wasCopied && 'text-[var(--pos)]')}>
                  {wasCopied ? '✓ скопировано' : base}
                </span>
                {!wasCopied && quote && <span className="shrink-0 text-[8px] font-bold text-[var(--muted-foreground)] opacity-60">{quote}</span>}
              </span>
              <span
                className="cp-num text-right text-[11px] font-bold"
                style={{ color: chg >= 0 ? 'var(--pos)' : 'var(--neg)' }}
              >
                {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
              </span>
              <span
                className="cp-num text-right text-[10px] font-semibold"
                style={nv === undefined ? { color: 'var(--muted-foreground)' } : { color: nv >= 15 ? '#f43f5e' : nv >= 8 ? '#fbbf24' : 'var(--foreground)' }}
              >
                {nv === undefined ? '—' : `${nv.toFixed(1)}%`}
              </span>
              <span className="cp-num text-right text-[10px] text-[var(--muted-foreground)]">{fmtUsd(r.vol24h)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Вкладка ─────────────────────────────────────────────────────────

export function MarketView() {
  const theme = useApp((s) => s.theme)

  const [ex, setEx] = useState<Ex3>('BINANCE')
  const [m, setM] = useState<Mkt>('F')
  const [symbol, setSymbol] = useState('')
  const [symbols, setSymbols] = useState<SymbolRow[]>([])
  const [intervalA, setIntervalA] = useState('15m')
  const [intervalB, setIntervalB] = useState('1h')
  const [tool, setTool] = useState<ChartTool>('cursor')
  const [reload, setReload] = useState(0)
  const [layout, setLayout] = useState<'1' | '2'>(marketLayout)
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => (typeof window === 'undefined' ? [] : loadAlerts()))
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [isFs, setIsFs] = useState(false)
  const [natr, setNatr] = useState<Record<string, number>>({})
  const [sortKey, setSortKey] = useState<SortKey>('vol')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rootRef = useRef<HTMLDivElement>(null)
  const alertsRef = useRef<PriceAlert[]>([])
  const prevPrices = useRef<Map<string, number>>(new Map())
  const exMeta = EX3.find((e) => e.id === ex) ?? EX3[0]
  const selKey = `${ex}_${m}`

  useEffect(() => { alertsRef.current = alerts }, [alerts])

  const persistAlerts = useCallback((list: PriceAlert[]) => {
    setAlerts(list)
    saveAlerts(list)
  }, [])

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

  // ── NATR ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancel = false
    const load = async () => {
      try {
        const r = await fetch(`/api/natr?ex=${ex}&m=${m}`)
        if (!r.ok) return
        const d = (await r.json()) as { natr?: Record<string, number> }
        if (!cancel && d.natr) setNatr(d.natr)
      } catch { /* ignore */ }
    }
    void load()
    const iv = setInterval(() => void load(), 90_000)
    return () => { cancel = true; clearInterval(iv) }
  }, [ex, m])

  // ── Автообновление свечей (полный рефетч) ─────────────────────────
  useEffect(() => {
    const fast = ['1m', '5m', '15m'].includes(intervalA) || ['1m', '5m', '15m'].includes(intervalB)
    const t = setTimeout(() => setReload((v) => v + 1), fast ? 30_000 : 120_000)
    return () => clearTimeout(t)
  }, [intervalA, intervalB, reload])

  // ── Проверка ценовых уведомлений (подписка на стор — без перерисовок) ──
  useEffect(() => {
    let lastMap: Record<string, TickerSnapshot> | null = null
    const unsub = useLive.subscribe((state) => {
      if (state.tickers === lastMap) return
      lastMap = state.tickers
      const cur = state.tickers
      const prev = prevPrices.current
      const fired: string[] = []
      const next = new Map<string, number>()
      for (const a of alertsRef.current) {
        const t = cur[`${a.ex}:${a.m}:${a.symbol}`]
        if (!t || !t.price) continue
        const was = prev.get(a.id)
        next.set(a.id, t.price)
        if (was !== undefined && was !== t.price) {
          const crossed = (was < a.price && t.price >= a.price) || (was > a.price && t.price <= a.price)
          if (crossed) fired.push(a.id)
        }
      }
      prevPrices.current = next
      if (fired.length > 0) {
        const firedAlerts = alertsRef.current.filter((a) => fired.includes(a.id))
        persistAlerts(alertsRef.current.filter((a) => !fired.includes(a.id)))
        for (const a of firedAlerts) {
          const up = (next.get(a.id) ?? a.price) >= a.price
          emitNotification({
            type: 'system',
            severity: 'warning',
            title: `${a.symbol} ${up ? 'поднялась выше уровня' : 'опустилась ниже уровня'}`,
            message: `Цена пересекла ${fmtPrice(a.price)} — уведомление сработало`,
            ticker: a.symbol.replace('USDT', ''),
            exchange: a.ex,
            market: a.m,
            voiceText: `${a.symbol.replace('USDT', '')} ${up ? 'поднялась выше' : 'опустилась ниже'} уровня ${fmtPrice(a.price)}`,
          })
        }
      }
    })
    return unsub
  }, [persistAlerts])

  // ── Fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFs = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else if (rootRef.current) {
      void rootRef.current.requestFullscreen().catch(() => {})
    }
  }

  const toggleLayout = () => {
    const next = layout === '1' ? '2' : '1'
    marketLayout = next
    setLayout(next)
  }

  const onSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  const selectSymbol = (s: string) => {
    marketSel.set(selKey, s)
    setSymbol(s)
  }

  const onAlertSet = (price: number) => {
    if (!symbol || !Number.isFinite(price) || price <= 0) return
    const a: PriceAlert = {
      id: `al_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ex, m, symbol, price, createdAt: Date.now(),
    }
    persistAlerts([...alertsRef.current, a])
  }

  const onAlertRemove = (id: string) => {
    persistAlerts(alertsRef.current.filter((a) => a.id !== id))
  }

  const doReload = useCallback(() => setReload((v) => v + 1), [])

  return (
    <div ref={rootRef} className="relative flex h-full min-h-[540px] gap-2.5">
      {/* графики */}
      <div className={cn('flex min-h-0 min-w-0 flex-1 gap-2.5', layout === '2' && 'flex-col lg:flex-row')}>
        <ChartCard
          ex={ex} m={m} symbol={symbol}
          interval={intervalA} setIntervalId={setIntervalA}
          reload={reload} onReload={doReload}
          tool={tool} onToolSelect={setTool} onToolDone={() => setTool('cursor')}
          alerts={alerts} onAlertSet={onAlertSet} onAlertRemove={onAlertRemove}
          theme={theme} exMeta={exMeta}
        />
        {layout === '2' && (
          <ChartCard
            ex={ex} m={m} symbol={symbol}
            interval={intervalB} setIntervalId={setIntervalB}
            reload={reload} onReload={doReload}
            tool={tool} onToolSelect={setTool} onToolDone={() => setTool('cursor')}
            alerts={alerts} onAlertSet={onAlertSet} onAlertRemove={onAlertRemove}
            theme={theme} exMeta={exMeta}
            tag="ГРАФИК 2"
          />
        )}
      </div>

      {/* правая колонка: биржи · рынок · монеты */}
      <div className="flex min-h-0 w-full shrink-0 flex-col lg:w-[336px]">
        <CoinsPanel
          rows={symbols}
          selected={symbol}
          onSelect={selectSymbol}
          ex={ex}
          m={m}
          onEx={setEx}
          onM={setM}
          natr={natr}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>

      {/* кластер управления: алерты · раскладка · полный экран */}
      <div className="absolute bottom-2.5 right-2.5 z-30 flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-0.5 shadow-lg lg:right-[350px]">
        <div className="relative">
          <button
            onClick={() => setAlertsOpen((v) => !v)}
            aria-label="Ценовые уведомления"
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-lg transition-all',
              alertsOpen ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
            style={alertsOpen ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
          >
            <BellRing className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="cp-num absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-black text-white" style={{ background: '#f59e0b' }}>
                {alerts.length}
              </span>
            )}
          </button>
          {alertsOpen && (
            <div className="absolute bottom-10 right-0 w-64 rounded-xl border border-[var(--border)] bg-[var(--card-solid)] p-2 shadow-xl">
              <div className="px-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Ценовые уведомления · {alerts.length}
              </div>
              {alerts.length === 0 && (
                <div className="px-1.5 py-3 text-center text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                  Выберите инструмент «колокольчик» слева и кликните по графику — уведомим при пересечении уровня
                </div>
              )}
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-black">{a.symbol}</span>
                      <span className="cp-num block text-[10px] text-[var(--muted-foreground)]">
                        {a.ex} · {a.m} · уровень {fmtPrice(a.price)}
                      </span>
                    </span>
                    <button
                      onClick={() => onAlertRemove(a.id)}
                      aria-label="Удалить уведомление"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_15%,transparent)] hover:text-[var(--destructive)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
        <button
          onClick={toggleLayout}
          aria-label={layout === '1' ? 'Включить второй график' : 'Один график'}
          aria-pressed={layout === '2'}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
            layout === '2' ? 'text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
          style={layout === '2' ? { background: 'linear-gradient(135deg, var(--acc), var(--acc-2))' } : undefined}
          title={layout === '1' ? 'Режим 2 графиков: один тикер, разные таймфреймы' : 'Вернуть один график'}
        >
          <Columns2 className="h-4 w-4" />
        </button>
        <button
          onClick={toggleFs}
          aria-label={isFs ? 'Выйти из полного экрана' : 'Развернуть на весь экран'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {isFs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

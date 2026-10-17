// ════════════════════════════════════════════════════════════════════
// CryptoPulse Market Service — реальные данные 8 бирж
// socket.io на порту 3003 (path '/', за Caddy-гейтвеем)
// ════════════════════════════════════════════════════════════════════

import { createServer } from 'http'
import { Server } from 'socket.io'
import { BinanceWs } from './binance-ws'
import { BookEngine } from './books'
import { TickerHub, symbolRows } from './exchanges'
import { HlWs } from './hl-ws'
import { ListingsEngine, type ListingEvent } from './listings'
import { NewsEngine, fetchFearGreed, type FgData } from './news'
import { collectStats } from './telemetry'
import { type ConnectRow, type MoverRow, type NewsItem, type ServiceStats, type SpreadSets, type WallRow } from './types'

const PORT = 3003

// ─── Живучесть: сервис должен работать неделями без присмотра ───────
// Случайная непойманная ошибка не должна ронять весь процесс — логируем и живём дальше.
process.on('uncaughtException', (e) => {
  console.error('[GUARD] uncaughtException:', e)
})
process.on('unhandledRejection', (e) => {
  console.error('[GUARD] unhandledRejection:', e)
})

const httpServer = createServer()
const io = new Server(httpServer, {
  // путь не менять — Caddy использует его для форварда
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
  maxHttpBufferSize: 4e6,
})

// ─── Состояние ───────────────────────────────────────────────────────

const tickerHub = new TickerHub()
const bookEngine = new BookEngine(tickerHub)
const binanceWs = new BinanceWs(tickerHub, bookEngine)
const hlWs = new HlWs(tickerHub, bookEngine)
const newsEngine = new NewsEngine()
const listingsEngine = new ListingsEngine()
listingsEngine.setTickerHub(tickerHub)

const state = {
  startedAt: Date.now(),
  ticks: 0,
  movers: 0,
  walls: 0,
  spreads: 0,
  news: 0,
  errors: 0,
  fg: null as FgData | null,
  moversQueue: [] as MoverRow[],
  wallsQueue: [] as WallRow[],
}

// ─── Потоки данных ───────────────────────────────────────────────────

tickerHub.onMovers = (rows) => {
  state.moversQueue.push(...rows)
  state.movers += rows.length
  state.ticks += 1
}

bookEngine.onWalls = (rows) => {
  state.wallsQueue.push(...rows)
  state.walls += rows.length
}

newsEngine.onNews = (fresh: NewsItem[]) => {
  state.news += fresh.length
  io.emit('news', fresh)
}

listingsEngine.onListings = (fresh: ListingEvent[]) => {
  io.emit('listings:new', fresh.map(toClientListing))
}

/** Сервер хранит ex/m — клиент ожидает exchange/market (единый формат) */
function toClientListing(e: ListingEvent) {
  return { ...e, exchange: e.ex, market: e.m }
}

// ─── Трансляции ──────────────────────────────────────────────────────

/** Есть ли подключённые клиенты — без них тяжёлые расчёты и эмиты не нужны */
function hasClients(): boolean {
  return io.engine.clientsCount > 0
}

// movers — каждые 3 секунды пакетом (дедуп по ключу: берём последнее состояние)
setInterval(() => {
  if (state.moversQueue.length === 0) return
  if (!hasClients()) { state.moversQueue.length = 0; return }
  const byKey = new Map<string, MoverRow>()
  for (const r of state.moversQueue) byKey.set(r.key, r)
  const batch = [...byKey.values()].slice(0, 1200)
  state.moversQueue.length = 0
  io.emit('movers', batch)
}, 3000)

// стены — каждые 4 секунды пакетом
setInterval(() => {
  if (state.wallsQueue.length === 0) return
  if (!hasClients()) { state.wallsQueue.length = 0; return }
  const batch = state.wallsQueue.splice(0, 500)
  io.emit('walls', batch)
}, 4000)

// топы 24ч — каждые 15 секунд
setInterval(() => {
  if (!hasClients()) return
  io.emit('top', tickerHub.topLists())
}, 15_000)

// спреды — каждые 6 секунд (4 режима: F-F, F-S, S-F, S-S)
setInterval(() => {
  if (!hasClients()) return
  const spreads: SpreadSets = tickerHub.spreads()
  state.spreads = spreads.FF.length + spreads.FS.length + spreads.SF.length + spreads.SS.length
  io.emit('spreads', spreads)
}, 6000)

// коннекты — каждые 5 секунд
let prevBnbMsgsF = 0
let prevBnbMsgsS = 0
let prevHlMsgs = 0
setInterval(() => {
  const hf = binanceWs.health('F')
  const hs = binanceWs.health('S')
  bookEngine.wsHealth.set('BINANCE_F', { status: hf.status, booksLive: hf.booksLive, booksTotal: bookEngine.getWatch('BINANCE', 'F').length, msgsPerSec: Math.max(0, Math.round((hf.msgs - prevBnbMsgsF) / 5)), lastMsg: hf.lastMsg })
  bookEngine.wsHealth.set('BINANCE_S', { status: hs.status, booksLive: hs.booksLive, booksTotal: bookEngine.getWatch('BINANCE', 'S').length, msgsPerSec: Math.max(0, Math.round((hs.msgs - prevBnbMsgsS) / 5)), lastMsg: hs.lastMsg })
  prevBnbMsgsF = hf.msgs
  prevBnbMsgsS = hs.msgs
  const hh = hlWs.health('F')
  bookEngine.wsHealth.set('HL_F', { status: hh.status, booksLive: hh.booksLive, booksTotal: bookEngine.getWatch('HL', 'F').length, msgsPerSec: Math.max(0, Math.round((hh.msgs - prevHlMsgs) / 5)), lastMsg: hh.lastMsg })
  prevHlMsgs = hh.msgs
  if (hasClients()) {
    const rows: ConnectRow[] = bookEngine.connectRows()
    io.emit('connects', rows)
  }
}, 5000)

// телеметрия — каждые 5 секунд
setInterval(() => {
  if (!hasClients()) return
  const stats: ServiceStats = collectStats({
    ticks: state.ticks,
    walls: state.walls,
    movers: state.movers,
    spreads: state.spreads,
    news: state.news,
    errors: state.errors + tickerHub.errors + bookEngine.errors + newsEngine.errors,
    startedAt: state.startedAt,
    wsClients: io.engine.clientsCount,
    symbols: tickerHub.symbolsCount(),
  })
  io.emit('stats', stats)
}, 5000)

// Fear & Greed — старт + каждые 10 минут
async function fgLoop() {
  const fg = await fetchFearGreed()
  if (fg) {
    state.fg = fg
    io.emit('fg', fg)
  }
}
setInterval(() => void fgLoop(), 10 * 60_000)

// ─── Подключения клиентов ────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[WS+] client ${socket.id}, total ${io.engine.clientsCount}`)

  socket.emit('hello', {
    service: { version: '3.5.0', startedAt: state.startedAt },
    fg: state.fg,
    news: newsEngine.items,
    listings: listingsEngine.items.map(toClientListing),
    top: tickerHub.topLists(),
    symbols: tickerHub.symbolsCount(),
  })

  socket.on('getSymbols', (payload: { ex?: string; m?: string }, cb?: (rows: unknown) => void) => {
    try {
      const ex = (payload?.ex ?? '') as never
      const m = (payload?.m ?? 'F') as never
      const rows = symbolRows(tickerHub, ex, m)
      if (typeof cb === 'function') cb(rows)
    } catch (e) {
      console.error('[getSymbols] error', e)
      if (typeof cb === 'function') cb([])
    }
  })

  socket.on('disconnect', () => {
    console.log(`[WS-] client ${socket.id}, total ${io.engine.clientsCount}`)
  })
})

// ─── Запуск ──────────────────────────────────────────────────────────

async function main() {
  console.log('════════════════════════════════════════════════')
  console.log('  CryptoPulse Market Service v3.5.0')
  console.log(`  port ${PORT} · 8 exchanges · F+S · real data · arb 4 modes · hardened`)
  console.log('════════════════════════════════════════════════')

  tickerHub.start()
  bookEngine.start()
  binanceWs.start()
  hlWs.start()
  void newsEngine.start().then(() => console.log('[NEWS] engine ready'))
  listingsEngine.start()
  console.log('[LISTINGS] engine started (BINANCE·BYBIT·OKX · F+S)')
  void fgLoop().then(() => console.log('[FG] fetched'))

  httpServer.listen(PORT, () => {
    console.log(`[OK] socket.io listening on :${PORT}`)
  })

  // самопроверка раз в минуту + зомби-детект:
  // если после прогрева (20 мин) нет ни одного символа 15 минут подряд —
  // выходим с кодом 1, watchdog поднимет сервис заново (чистое состояние)
  let emptyTicks = 0
  setInterval(() => {
    const symbols = tickerHub.symbolsCount()
    console.log(`[health] symbols=${symbols} movers=${state.movers} walls=${state.walls} news=${newsEngine.items.length} clients=${io.engine.clientsCount} errs=${state.errors}`)
    if (symbols === 0 && Date.now() - state.startedAt > 20 * 60_000) {
      emptyTicks += 1
      if (emptyTicks >= 15) {
        console.error('[GUARD] нет символов 15 минут — выходим для перезапуска')
        process.exit(1)
      }
    } else {
      emptyTicks = 0
    }
  }, 60_000)
}

void main()

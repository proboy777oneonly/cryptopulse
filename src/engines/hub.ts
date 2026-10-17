'use client'

import { io, type Socket } from 'socket.io-client'
import { emitNotification } from './notifier'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import {
  arbModeMeta, exName, fmtUsd, normalizeArbMode, uid,
  type ConnectRow, type DensityEvent, type ExchangeId, type ListingEvent, type MarketType, type MovementAlert,
  type NewsItem, type ServiceStats, type SpreadRow, type SymbolRow, type TickerSnapshot,
} from './types'
import { voiceTextArbitrage, voiceTextDensity, voiceTextMovement, voiceTextNews } from './voice'

// ─── Типы строк реального потока ─────────────────────────────────────

export interface MoverRow {
  key: string
  ex: ExchangeId
  m: MarketType
  symbol: string
  price: number
  open24h: number
  open1m: number
  open5m: number
  vol24h: number
  change24hPct: number
  change1mPct: number
  change5mPct: number
}

export interface WallRow {
  id: string
  ex: ExchangeId
  m: MarketType
  symbol: string
  side: 'BID' | 'ASK'
  price: number
  notionalUsd: number
  distPct: number
  vol24h: number
  ts: number
  /** Момент появления стены в стакане */
  firstSeen: number
}

interface HelloPayload {
  service: { version: string; startedAt: number }
  fg: FgPayload | null
  news: NewsItem[]
  listings?: ListingEvent[]
  top: { gainers: MoverRow[]; losers: MoverRow[] }
  symbols: number
}

type FgPayload = { value: number; history: number[]; source: 'live'; yesterday?: number; lastWeek?: number; lastMonth?: number }

/** Время жизни события в окне после последнего подтверждения стены сервером */
const WALL_EVENT_TTL_MS = 45_000

interface ArbKeyState {
  symbol: string
  buyExchange: ExchangeId
  sellExchange: ExchangeId
  spreadPct: number
  vol24h: number
  time: number
}

interface ArbSpreadSets {
  FF: SpreadRow[]
  FS: SpreadRow[]
  SF: SpreadRow[]
  SS: SpreadRow[]
}

interface TranslateReq {
  id: string
  title: string
  summary: string
}
interface TranslateResp {
  id: string
  titleRu: string
  summaryRu: string
}

/**
 * Центральный хаб клиента: подключается к market-сервису (порт 3003 за
 * Caddy-гейтвеем), получает реальные данные 8 бирж и раздаёт их в сторы.
 * Плотности/движения/арбитраж считаются по пользовательским фильтрам.
 * Singleton с защитой от HMR.
 */
export class EngineHub {
  private socket: Socket | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private tickCount = 0
  private movementCooldown = new Map<string, number>()
  private arbActive = new Map<string, ArbKeyState>()
  private arbCooldown = new Map<string, number>()
  private sparkHistory = new Map<string, number[]>()
  private symbolCache = new Map<string, { rows: SymbolRow[]; at: number }>()
  private lastMoversAt = 0
  private warnedOffline = false
  private translateInFlight = new Set<string>()
  private newsNotified = new Set<string>()
  stats = { ticks: 0, densities: 0, movements: 0, arbitrages: 0, news: 0, errors: 0, startedAt: Date.now(), wsClients: 0 }

  // ─── Жизненный цикл ────────────────────────────────────────────────

  start() {
    if (this.socket) return
    this.stats.startedAt = Date.now()
    useLive.setState({ sessionStart: Date.now(), running: true, dataMode: 'connecting' })

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 12_000,
    })
    this.socket = socket

    socket.on('connect', () => {
      const wasOffline = useLive.getState().dataMode !== 'live'
      useLive.setState({ dataMode: 'live' })
      this.warnedOffline = false
      if (wasOffline && this.tickCount > 3) {
        emitNotification({
          type: 'system', severity: 'success',
          title: 'Соединение восстановлено',
          message: 'Поток данных 8 бирж снова активен',
        })
      }
    })

    socket.on('disconnect', () => {
      useLive.setState({ dataMode: 'reconnecting' })
      if (!this.warnedOffline) {
        this.warnedOffline = true
        emitNotification({
          type: 'system', severity: 'warning',
          title: 'Market-сервер недоступен',
          message: 'Переподключение к потоку данных…',
        })
      }
    })

    socket.on('hello', (d: HelloPayload) => {
      if (d.news?.length) useLive.setState({ news: d.news })
      if (d.listings?.length) useLive.setState({ listings: d.listings.slice(0, 120) })
      if (d.fg) useLive.setState({ fearGreed: { value: d.fg.value, history: d.fg.history, source: 'live', yesterday: d.fg.yesterday, lastWeek: d.fg.lastWeek, lastMonth: d.fg.lastMonth } })
      if (d.top) this.applyTop(d.top)
      if (d.news?.length) this.translateNews()
      if (this.tickCount === 0 && d.symbols > 0) {
        emitNotification({
          type: 'system', severity: 'success',
          title: 'Подключено к реальным данным',
          message: `8 бирж · F+S · ${d.symbols.toLocaleString('ru-RU')} тикеров в потоке`,
        })
      }
    })

    socket.on('movers', (rows: MoverRow[]) => this.handleMovers(rows))
    socket.on('top', (d: { gainers: MoverRow[]; losers: MoverRow[] }) => this.applyTop(d))
    socket.on('walls', (rows: WallRow[]) => this.handleWalls(rows))
    socket.on('spreads', (d: ArbSpreadSets) => this.handleSpreads(d))
    socket.on('fg', (d: FgPayload) => {
      useLive.setState({ fearGreed: { value: d.value, history: d.history, source: 'live', yesterday: d.yesterday, lastWeek: d.lastWeek, lastMonth: d.lastMonth } })
    })
    socket.on('news', (fresh: NewsItem[]) => this.handleNews(fresh))
    socket.on('listings:new', (fresh: ListingEvent[]) => this.handleListings(fresh))
    socket.on('connects', (rows: ConnectRow[]) => useLive.setState({ connects: rows }))
    socket.on('stats', (d: ServiceStats) => useLive.setState({ serviceStats: d }))

    // UI-тик раз в секунду: счётчики, чистка истёкших плотностей
    this.timer = setInterval(() => this.uiTick(), 1000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.socket?.disconnect()
    this.socket = null
    this.movementCooldown.clear()
    this.arbActive.clear()
    this.translateInFlight.clear()
    useLive.setState({ running: false })
  }

  // ─── Символы биржи для комбобоксов ─────────────────────────────────

  async fetchSymbols(ex: ExchangeId, m: MarketType): Promise<SymbolRow[]> {
    const key = `${ex}_${m}`
    const cached = this.symbolCache.get(key)
    if (cached && Date.now() - cached.at < 60_000) return cached.rows
    return new Promise<SymbolRow[]>((resolve) => {
      const socket = this.socket
      if (!socket) { resolve([]); return }
      const emitOnce = () => {
        const to = setTimeout(() => resolve([]), 8000)
        socket.emit('getSymbols', { ex, m }, (rows: SymbolRow[]) => {
          clearTimeout(to)
          const list = Array.isArray(rows) ? rows : []
          this.symbolCache.set(key, { rows: list, at: Date.now() })
          resolve(list)
        })
      }
      if (socket.connected) {
        emitOnce()
      } else {
        // ждём подключения сокета до 10 секунд
        const waitTo = setTimeout(() => { socket.off('connect', onConn); resolve([]) }, 10_000)
        const onConn = () => { clearTimeout(waitTo); emitOnce() }
        socket.once('connect', onConn)
      }
    })
  }

  sparkline(sym: string): number[] {
    return this.sparkHistory.get(sym) ?? []
  }

  // ─── Обработчики потока ────────────────────────────────────────────

  private uiTick() {
    this.tickCount += 1
    this.stats.ticks = this.tickCount

    // чистка истёкших плотностей
    const now = Date.now()
    const de = useLive.getState().densityEvents
    let changed = false
    for (const id of Object.keys(de)) {
      const filtered = de[id].filter((e) => e.expiresAt > now)
      if (filtered.length !== de[id].length) { de[id] = filtered; changed = true }
    }
    if (changed) useLive.setState({ densityEvents: { ...de } })

    useLive.setState({ tick: this.tickCount, stats: { ...this.stats } })
  }

  private pushSpark(symbol: string, price: number) {
    let h = this.sparkHistory.get(symbol)
    if (!h) { h = []; this.sparkHistory.set(symbol, h) }
    h.push(price)
    if (h.length > 120) h.shift()
  }

  private handleMovers(rows: MoverRow[]) {
    this.lastMoversAt = Date.now()
    const tickers = { ...useLive.getState().tickers }
    for (const r of rows) {
      const t: TickerSnapshot = {
        key: r.key, exchange: r.ex, market: r.m, symbol: r.symbol,
        price: r.price, open24h: r.open24h, open1m: r.open1m, open5m: r.open5m,
        vol24h: r.vol24h, change24hPct: r.change24hPct, change1mPct: r.change1mPct, change5mPct: r.change5mPct,
        bias: 0,
      }
      tickers[r.key] = t
      this.pushSpark(r.symbol, r.price)
    }
    useLive.setState({ tickers })
    this.movementTick(rows)
  }

  private applyTop(d: { gainers: MoverRow[]; losers: MoverRow[] }) {
    const conv = (r: MoverRow): TickerSnapshot => ({
      key: r.key, exchange: r.ex, market: r.m, symbol: r.symbol,
      price: r.price, open24h: r.open24h, open1m: r.open1m, open5m: r.open5m,
      vol24h: r.vol24h, change24hPct: r.change24hPct, change1mPct: r.change1mPct, change5mPct: r.change5mPct,
      bias: 0,
    })
    useLive.setState({ topMovers: { gainers: d.gainers.map(conv), losers: d.losers.map(conv) } })
  }

  // ── Движения: пороги пользователя на реальном потоке ──────────────

  private movementTick(rows: MoverRow[]) {
    const { movementWindows } = useApp.getState()
    if (movementWindows.length === 0) return
    const now = Date.now()
    const prevAll = useLive.getState().movementAlerts
    let alertsChanged = false
    const alertsByWin: Record<string, MovementAlert[]> = {}

    for (const win of movementWindows) {
      let alerts = prevAll[win.id] ? [...prevAll[win.id]] : []
      if (win.enabled) {
        for (const row of rows) {
          if (!win.markets[`${row.ex}_${row.m}` as keyof typeof win.markets]) continue
          const change = win.period === '1m' ? row.change1mPct : win.period === '5m' ? row.change5mPct : row.change24hPct
          if (!Number.isFinite(change)) continue
          if (win.direction === 'up' && change <= 0) continue
          if (win.direction === 'down' && change >= 0) continue
          const rule = win.coinRules.find((r) => r.symbol === row.symbol)
          const threshold = rule?.pct ?? win.thresholdPct
          if (Math.abs(change) < threshold) continue
          if (row.vol24h < win.minVol24h) continue

          const cdKey = `${win.id}|${row.ex}|${row.m}|${row.symbol}`
          const last = this.movementCooldown.get(cdKey) ?? 0
          if (now - last < win.cooldownSec * 1000) continue
          this.movementCooldown.set(cdKey, now)

          const alert: MovementAlert = {
            id: uid('mv'),
            windowId: win.id,
            exchange: row.ex,
            market: row.m,
            symbol: row.symbol,
            period: win.period,
            changePct: Math.round(change * 100) / 100,
            price: row.price,
            vol24h: row.vol24h,
            time: now,
          }
          alerts.unshift(alert)
          if (alerts.length > 100) alerts.pop()
          alertsChanged = true
          this.stats.movements += 1

          emitNotification({
            type: 'movement',
            severity: Math.abs(change) >= 8 ? 'critical' : 'success',
            title: `${row.symbol} ${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`,
            message: `${exName(row.ex)} ${row.m === 'F' ? 'фьючерсы' : 'спот'} · оборот 24ч ${fmtUsd(row.vol24h)}`,
            ticker: row.symbol,
            changePct: Math.round(change * 100) / 100,
            exchange: row.ex,
            market: row.m,
            vol24h: row.vol24h,
            windowId: win.id,
            voiceText: voiceTextMovement(row.symbol, change, exName(row.ex)),
          })
        }
      }
      alertsByWin[win.id] = alerts
    }
    if (alertsChanged) useLive.setState({ movementAlerts: alertsByWin })
  }

  // ── Плотности: стены с сервера → окна пользователя ────────────────
  // Семантика lifetimeSec: стена попадает в окно, когда её возраст
  // (now - firstSeen) достигает фильтра — «поставили плотность, она стоит
  // 30с и не снимается — появляется в окне при фильтре от 30с».

  private handleWalls(rows: WallRow[]) {
    const { densityWindows } = useApp.getState()
    if (densityWindows.length === 0) return
    const now = Date.now()
    const de = { ...useLive.getState().densityEvents }
    let anyChange = false

    for (const w of rows) {
      for (const win of densityWindows) {
        if (!win.enabled || win.exchange !== w.ex) continue
        if (win.mode !== 'ALL' && win.mode !== w.m) continue

        const settings = w.m === 'F' ? win.f : win.s
        const blacklist = w.m === 'F' ? win.blacklistF : win.blacklistS
        if (blacklist.includes(w.symbol)) continue
        const ovr = win.tickers[w.symbol]
        if (ovr && ovr.enabled === false) continue
        const minVol = ovr?.minVolume24h ?? settings.minVolume24h
        if (w.vol24h < minVol) continue
        const minOrder = Math.max(settings.minOrderUsd, ovr?.minOrderUsd ?? 0)
        if (w.notionalUsd < minOrder) continue
        const depth = w.side === 'BID' ? settings.bidDepthPct : settings.askDepthPct
        if (w.distPct > depth) continue

        // возраст стены ещё не дотянул до фильтра — ждём следующего пульса
        const firstSeen = w.firstSeen || w.ts
        const ageMs = now - firstSeen
        if (ageMs < settings.lifetimeSec * 1000) continue

        const eventId = `${w.id}_${win.id}`
        const list = de[win.id] ?? []
        const existing = list.find((e) => e.id === eventId)

        if (existing) {
          // стена всё ещё стоит — продлеваем жизнь и обновляем объём
          const updated: DensityEvent = {
            ...existing,
            volumeUsd: Math.max(existing.volumeUsd, w.notionalUsd),
            strengthPct: w.distPct,
            levelPrice: w.price,
            createdAt: firstSeen,
            expiresAt: now + WALL_EVENT_TTL_MS,
          }
          const idx = list.indexOf(existing)
          const next = [...list]
          next[idx] = updated
          de[win.id] = next
          anyChange = true
          continue
        }

        const event: DensityEvent = {
          id: eventId,
          windowId: win.id,
          exchange: w.ex,
          market: w.m,
          symbol: w.symbol,
          side: w.side,
          direction: w.side === 'BID' ? 'LONG' : 'SHORT',
          volumeUsd: w.notionalUsd,
          strengthPct: w.distPct,
          levelPrice: w.price,
          createdAt: firstSeen,
          expiresAt: now + WALL_EVENT_TTL_MS,
          lifetimeSec: settings.lifetimeSec,
        }
        de[win.id] = [event, ...list].slice(0, 60)
        anyChange = true
        this.stats.densities += 1

        const severity = w.notionalUsd >= 20e6 ? 'critical' : w.notionalUsd >= 8e6 ? 'warning' : 'info'
        emitNotification({
          type: 'density',
          severity,
          title: `${w.symbol} · ${fmtUsd(w.notionalUsd)} · ${w.distPct.toFixed(2)}%`,
          message: `${exName(w.ex)} ${w.m === 'F' ? 'фьючерсы' : 'спот'} · оборот 24ч ${fmtUsd(w.vol24h)}`,
          ticker: w.symbol,
          volumeUsd: w.notionalUsd,
          distPct: Math.round(w.distPct * 100) / 100,
          direction: event.direction,
          exchange: w.ex,
          market: w.m,
          vol24h: w.vol24h,
          windowId: win.id,
          soundId: settings.soundId,
          volumePct: settings.volumePct,
          voice: settings.voice,
          voiceText: voiceTextDensity(w.symbol, w.notionalUsd, w.side, exName(w.ex)),
        })
      }
    }
    if (anyChange) useLive.setState({ densityEvents: de })
  }

  // ── Арбитраж: спреды с сервера → фильтры пользователя ─────────────

  private handleSpreads(data: ArbSpreadSets) {
    const cfg = useApp.getState().arbitrage
    const mode = normalizeArbMode(cfg.mode)
    const { buy, sell } = arbModeMeta(mode)
    const now = Date.now()
    const seen = new Set<string>()
    const active = new Map<string, ArbKeyState>()
    // индекс «символ_биржа» → цена (вместо O(n²) поиска по массиву на каждую строку)
    const rows = data[mode] ?? []
    const rowBySym = new Map<string, number>()
    for (const r of rows) {
      rowBySym.set(`${r.symbol}_${r.buyEx}`, r.buyPrice)
      rowBySym.set(`${r.symbol}_${r.sellEx}`, r.sellPrice)
    }

    for (const r of rows) {
      if (!cfg.exchanges[r.buyEx] || !cfg.exchanges[r.sellEx]) continue
      if (r.spreadPct < cfg.minSpreadPct || r.vol24h < cfg.minVol24h) continue
      const key = `${mode}_${r.symbol}_${r.buyEx}_${r.sellEx}`
      seen.add(key)
      const existing = this.arbActive.get(key)
      if (existing) {
        existing.spreadPct = r.spreadPct
        existing.vol24h = r.vol24h
        existing.time = now
        active.set(key, existing)
      } else {
        active.set(key, { symbol: r.symbol, buyExchange: r.buyEx, sellExchange: r.sellEx, spreadPct: r.spreadPct, vol24h: r.vol24h, time: now })
        this.stats.arbitrages += 1
      }

      const lastN = this.arbCooldown.get(r.symbol) ?? 0
      if (now - lastN > cfg.cooldownSec * 1000) {
        this.arbCooldown.set(r.symbol, now)
        emitNotification({
          type: 'arbitrage',
          severity: r.spreadPct >= 1.5 ? 'warning' : 'info',
          title: `${r.symbol} · спред ${r.spreadPct.toFixed(2)}%`,
          message: `Покупка ${buy} ${exName(r.buyEx)} → продажа ${sell} ${exName(r.sellEx)} · оборот 24ч ${fmtUsd(r.vol24h)}`,
          ticker: r.symbol,
          spreadPct: r.spreadPct,
          exchange: r.buyEx,
          market: buy,
          vol24h: r.vol24h,
          voiceText: voiceTextArbitrage(r.symbol, r.spreadPct),
        })
      }
    }

    for (const [key, st] of [...this.arbActive.entries()]) {
      if (!seen.has(key)) this.arbActive.delete(key)
      else if (!active.has(key)) active.set(key, st)
    }
    this.arbActive = active

    const opps = [...active.values()]
      .sort((a, b) => b.spreadPct - a.spreadPct)
      .slice(0, 40)
      .map((o) => ({
        id: `${mode}_${o.symbol}_${o.buyExchange}_${o.sellExchange}`,
        symbol: o.symbol,
        buyMarket: buy,
        sellMarket: sell,
        buyExchange: o.buyExchange,
        buyPrice: rowBySym.get(`${o.symbol}_${o.buyExchange}`) ?? 0,
        sellExchange: o.sellExchange,
        sellPrice: rowBySym.get(`${o.symbol}_${o.sellExchange}`) ?? 0,
        spreadPct: o.spreadPct,
        vol24h: o.vol24h,
        time: o.time,
      }))

    useLive.setState({ arbitrageOpps: opps })
  }

  // ── Листинг/делистинг ────────────────────────────────────────────

  private handleListings(fresh: ListingEvent[]) {
    if (!Array.isArray(fresh) || fresh.length === 0) return
    const known = new Set(useLive.getState().listings.map((l) => l.id))
    const add = fresh.filter((l) => l && l.id && !known.has(l.id))
    if (add.length === 0) return
    const merged = [...add, ...useLive.getState().listings]
      .sort((a, b) => b.time - a.time)
      .slice(0, 120)
    useLive.setState({ listings: merged })

    for (const l of add.slice(0, 4)) {
      const isDelist = l.kind === 'delisting'
      const syms = (l.symbols ?? []).filter((s) => s && s !== 'USDT')
      const symStr = syms.length > 0 ? syms.slice(0, 3).join(', ') + (syms.length > 3 ? '…' : '') : ''
      emitNotification({
        type: 'listing',
        severity: isDelist ? 'warning' : 'success',
        title: symStr ? `${isDelist ? 'Делистинг' : 'Листинг'} · ${symStr} · ${exName(l.exchange)} ${l.market === 'F' ? 'фьючерс' : 'спот'}` : `${isDelist ? 'Делистинг' : 'Листинг'} · ${exName(l.exchange)}`,
        message: l.source === 'live' ? 'Символ замечен в торгах на бирже' : l.title,
        voiceText: symStr
          ? `${isDelist ? 'Делистинг' : 'Листинг'} ${syms[0].replace('USDT', '')} на ${l.exchange === 'BINANCE' ? 'Байнанс' : l.exchange === 'BYBIT' ? 'Байбит' : 'ОК Икс'}`
          : undefined,
      })
    }
  }

  // ── Новости ────────────────────────────────────────────────────────

  private handleNews(fresh: NewsItem[]) {
    if (!Array.isArray(fresh) || fresh.length === 0) return
    const news = [...fresh].sort((a, b) => b.time - a.time).concat(useLive.getState().news)
    // дедуп по id
    const seen = new Set<string>()
    const unique = news.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))).slice(0, 60)
    this.stats.news += fresh.length
    useLive.setState({ news: unique })

    // важные новости — уведомляем после перевода на RU (или по таймауту с оригиналом)
    const high = fresh.filter((x) => x.impact === 'high')
    for (const item of high) {
      if (item.titleRu) { this.notifyNews(item); continue }
      const id = item.id
      setTimeout(() => {
        const cur = useLive.getState().news.find((n) => n.id === id)
        this.notifyNews(cur ?? item)
      }, 8000)
    }

    this.translateNews()
  }

  private notifyNews(item: NewsItem) {
    if (this.newsNotified.has(item.id)) return
    this.newsNotified.add(item.id)
    if (this.newsNotified.size > 500) this.newsNotified.clear()
    if (item.impact !== 'high') return
    emitNotification({
      type: 'news',
      severity: 'warning',
      title: item.titleRu ?? item.title,
      message: `${item.category} · ${item.source}${item.affects.length > 0 ? ' · влияет на: ' + item.affects.join(', ') : ''}`,
      voiceText: voiceTextNews(item.titleRu ?? item.title),
    })
  }

  /** Перевод новостей на русский через LLM (батчами, с кэшем на сервере) */
  private translateNews() {
    const pending = useLive.getState().news
      .filter((n) => !n.titleRu && !this.translateInFlight.has(n.id))
      .slice(0, 24)
      .map((n) => ({ id: n.id, title: n.title, summary: n.summary }))
    if (pending.length === 0) return
    for (const p of pending) this.translateInFlight.add(p.id)
    void fetch('/api/translate-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: pending }),
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as { items?: TranslateResp[] }
        const byId = new Map((json.items ?? []).map((r) => [r.id, r]))
        if (byId.size === 0) return
        const cur = useLive.getState().news
        useLive.setState({
          news: cur.map((n) => {
            const t = byId.get(n.id)
            return t ? { ...n, titleRu: t.titleRu, summaryRu: t.summaryRu } : n
          }),
        })
      })
      .catch(() => { /* перевод недоступен — показываем оригинал */ })
      .finally(() => {
        for (const p of pending) this.translateInFlight.delete(p.id)
      })
  }
}

const g = globalThis as unknown as { __cpHub?: EngineHub }
export function getHub(): EngineHub {
  if (!g.__cpHub) g.__cpHub = new EngineHub()
  return g.__cpHub
}

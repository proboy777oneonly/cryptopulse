import { MarketSim } from './market'
import { generateNews, initialNews } from './news'
import { emitNotification } from './notifier'
import { useApp } from '@/stores/app-store'
import { useLive } from '@/stores/live-store'
import {
  exName, fmtUsd, uid,
  type ConnectRow, type DensityEvent, type ExchangeId, type MarketType, type MovementAlert,
} from './types'
import { voiceTextArbitrage, voiceTextDensity, voiceTextMovement, voiceTextNews } from './voice'

interface ArbKeyState {
  symbol: string
  buyExchange: ExchangeId
  sellExchange: ExchangeId
  spreadPct: number
  vol24h: number
  time: number
  lastNotified: number
}

/**
 * Центральный хаб: тикает каждую секунду, гонит рынок, плотности, движения,
 * арбитраж, новости, телеметрию. Singleton с защитой от HMR.
 */
export class EngineHub {
  sim = new MarketSim()
  private timer: ReturnType<typeof setInterval> | null = null
  private tickCount = 0
  private nextNewsAt = Date.now() + 20_000
  private nextFgAt = Date.now() + 20_000
  private fgValue = 40 + Math.random() * 40
  private fgHistory: number[] = []
  private movementCooldown = new Map<string, number>()
  private arbActive = new Map<string, ArbKeyState>()
  private arbCooldown = new Map<string, number>()
  private fgFetched = false
  stats = { ticks: 0, densities: 0, movements: 0, arbitrages: 0, news: 0, errors: 0, startedAt: Date.now(), wsClients: 24 }
  connects: ConnectRow[] = []

  constructor() {
    const news = initialNews(14)
    this.fgHistory = Array.from({ length: 30 }, (_, i) => 40 + Math.random() * 30 + Math.sin(i / 4) * 8)
    this.fgValue = this.fgHistory[this.fgHistory.length - 1]
    useLive.setState({ news, fearGreed: { value: Math.round(this.fgValue), history: this.fgHistory, source: 'demo' } })
    this.initConnects()
  }

  private initConnects() {
    const rows: ConnectRow[] = []
    const exs: ExchangeId[] = ['BINANCE', 'BYBIT', 'OKX', 'GATE', 'BITGET', 'KUKOIN', 'HL', 'ASTER']
    for (const ex of exs) {
      for (const m of ['F', 'S'] as MarketType[]) {
        const total = this.sim.coinsOn(ex, m).length
        rows.push({
          id: `${ex}_${m}`,
          exchange: ex,
          market: m,
          status: Math.random() < 0.08 ? 'degraded' : 'online',
          latencyMs: 9 + Math.random() * 38,
          msgsPerSec: 60 + Math.random() * 160,
          booksLive: total,
          booksTotal: total,
          uptime: 3600 * (2 + Math.random() * 60),
          lastMsg: Date.now(),
        })
      }
    }
    this.connects = rows
  }

  start() {
    if (this.timer) return
    this.stats.startedAt = Date.now()
    useLive.setState({ sessionStart: Date.now(), running: true })
    void this.fetchFearGreed()
    this.timer = setInterval(() => this.step(), 1000)
    this.step()
    emitNotification({
      type: 'system', severity: 'info',
      title: 'Движки запущены',
      message: 'Подключение к 8 биржам установлено · режим DEMO',
    })
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.movementCooldown.clear()
    this.arbActive.clear()
    useLive.setState({ running: false })
  }

  private async fetchFearGreed() {
    if (this.fgFetched) return
    this.fgFetched = true
    try {
      const ctrl = new AbortController()
      const to = setTimeout(() => ctrl.abort(), 3500)
      const res = await fetch('https://api.alternative.me/fng/?limit=30', { signal: ctrl.signal })
      clearTimeout(to)
      if (res.ok) {
        const json = await res.json()
        const data = json?.data
        if (Array.isArray(data) && data.length > 0) {
          const hist = data.map((d: { value: string }) => Number(d.value)).reverse()
          this.fgHistory = hist
          this.fgValue = hist[hist.length - 1]
          useLive.setState({ fearGreed: { value: Math.round(this.fgValue), history: hist, source: 'live' } })
          return
        }
      }
    } catch {
      /* офлайн — остаёмся на демо-значении */
    }
  }

  private step() {
    try {
      this.tickCount += 1
      this.sim.step()

      const densityEvents = this.densityTick()
      const movementAlerts = this.movementTick()

      if (this.tickCount % 2 === 0) this.arbitrageTick()
      this.newsTick()
      if (Date.now() >= this.nextFgAt) this.fgTick()
      if (this.tickCount % 2 === 0) this.connectsTick()

      this.stats.ticks = this.tickCount
      this.stats.wsClients = Math.max(12, Math.min(48, this.stats.wsClients + (Math.random() - 0.5) * 2))

      useLive.setState({
        tick: this.tickCount,
        tickers: Object.fromEntries(this.sim.tickers),
        densityEvents,
        movementAlerts,
        connects: [...this.connects],
        stats: { ...this.stats },
      })
    } catch (e) {
      this.stats.errors += 1
      console.error('hub step error', e)
    }
  }

  // ── Плотности ───────────────────────────────────────────────────────

  private densityTick(): Record<string, import('./types').DensityEvent[]> {
    const { densityWindows } = useApp.getState()
    const now = Date.now()
    const result: Record<string, import('./types').DensityEvent[]> = {}

    for (const win of densityWindows) {
      const prev = useLive.getState().densityEvents[win.id] ?? []
      let events = prev.filter((e) => e.expiresAt > now)
      if (!win.enabled) {
        result[win.id] = events
        continue
      }

      const markets: MarketType[] = win.mode === 'ALL' ? ['F', 'S'] : [win.mode]
      for (const m of markets) {
        if (Math.random() >= 0.025) continue
        const settings = m === 'F' ? win.f : win.s
        const blacklist = m === 'F' ? win.blacklistF : win.blacklistS
        const candidates = this.sim.coinsOn(win.exchange, m).filter((sym) => {
          if (blacklist.includes(sym)) return false
          const t = this.sim.ticker(win.exchange, m, sym)
          if (!t) return false
          const ovr = win.tickers[sym]
          if (ovr && ovr.enabled === false) return false
          const minVol = ovr?.minVolume24h ?? settings.minVolume24h
          return t.vol24h >= minVol
        })
        if (candidates.length === 0) continue
        const sym = candidates[Math.floor(Math.random() * candidates.length)]
        const t = this.sim.ticker(win.exchange, m, sym)!
        const ovr = win.tickers[sym]
        const minOrder = Math.max(settings.minOrderUsd, ovr?.minOrderUsd ?? 0)
        const side = Math.random() < 0.5 ? 'BID' : 'ASK'
        const depth = side === 'BID' ? settings.bidDepthPct : settings.askDepthPct
        const strength = depth * (0.9 + Math.random() * 2.2)
        const volumeUsd = minOrder * (1 + Math.random() * 22)
        const event: DensityEvent = {
          id: uid('den'),
          windowId: win.id,
          exchange: win.exchange,
          market: m,
          symbol: sym,
          side,
          direction: side === 'BID' ? 'LONG' : 'SHORT',
          volumeUsd,
          strengthPct: Math.round(strength * 100) / 100,
          levelPrice: t.price * (1 + (side === 'BID' ? -strength : strength) / 100),
          createdAt: now,
          expiresAt: now + settings.lifetimeSec * 1000,
          lifetimeSec: settings.lifetimeSec,
        }
        events = [event, ...events].slice(0, 50)
        this.stats.densities += 1

        const severity = volumeUsd >= 20e6 ? 'critical' : volumeUsd >= 8e6 ? 'warning' : 'info'
        emitNotification({
          type: 'density',
          severity,
          title: `${sym} · ${fmtUsd(volumeUsd)} · ${event.direction}`,
          message: `Плотность ${side === 'BID' ? 'покупателей' : 'продавцов'} ${strength.toFixed(2)}% от цены · ${exName(win.exchange)} ${m === 'F' ? 'фьючерс' : 'спот'} · истекает через ${settings.lifetimeSec}с`,
          windowId: win.id,
          soundId: settings.soundId,
          volumePct: settings.volumePct,
          voice: settings.voice,
          voiceText: voiceTextDensity(sym, volumeUsd, side, exName(win.exchange)),
        })
      }
      result[win.id] = events
    }
    return result
  }

  // ── Движения ────────────────────────────────────────────────────────

  private movementTick(): Record<string, MovementAlert[]> {
    const { movementWindows } = useApp.getState()
    const now = Date.now()
    const result: Record<string, MovementAlert[]> = {}
    const prevAll = useLive.getState().movementAlerts

    for (const win of movementWindows) {
      const alerts = prevAll[win.id] ? [...prevAll[win.id]] : []
      if (win.enabled) {
        const marketKeys = Object.entries(win.markets).filter(([, on]) => on).map(([k]) => k)
        for (const mk of marketKeys) {
          const [ex, m] = mk.split('_') as [ExchangeId, MarketType]
          for (const sym of this.sim.coinsOn(ex, m)) {
            const t = this.sim.ticker(ex, m, sym)
            if (!t) continue
            const open = win.period === '1m' ? t.open1m : win.period === '5m' ? t.open5m : t.open24h
            if (!open) continue
            const change = ((t.price - open) / open) * 100
            if (win.direction === 'up' && change <= 0) continue
            if (win.direction === 'down' && change >= 0) continue
            const rule = win.coinRules.find((r) => r.symbol === sym)
            const threshold = rule?.pct ?? win.thresholdPct
            if (Math.abs(change) < threshold) continue
            if (t.vol24h < win.minVol24h) continue

            const cdKey = `${win.id}|${ex}|${m}|${sym}`
            const last = this.movementCooldown.get(cdKey) ?? 0
            if (now - last < win.cooldownSec * 1000) continue
            this.movementCooldown.set(cdKey, now)

            const alert: MovementAlert = {
              id: uid('mv'),
              windowId: win.id,
              exchange: ex,
              market: m,
              symbol: sym,
              period: win.period,
              changePct: Math.round(change * 100) / 100,
              price: t.price,
              vol24h: t.vol24h,
              time: now,
            }
            alerts.unshift(alert)
            if (alerts.length > 100) alerts.pop()
            this.stats.movements += 1

            emitNotification({
              type: 'movement',
              severity: Math.abs(change) >= 8 ? 'critical' : 'success',
              title: `${sym} ${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}% · ${exName(ex)}`,
              message: `Движение ${win.period} от открытия свечи · цена ${t.price < 0.01 ? t.price.toExponential(2) : t.price.toFixed(4)} · объём 24ч ${fmtUsd(t.vol24h)}`,
              windowId: win.id,
              voiceText: voiceTextMovement(sym, change, exName(ex)),
            })
          }
        }
      }
      result[win.id] = alerts
    }
    return result
  }

  // ── Арбитраж ────────────────────────────────────────────────────────

  private arbitrageTick() {
    const cfg = useApp.getState().arbitrage
    const now = Date.now()
    const seen = new Set<string>()

    for (const coin of this.sim.coins) {
      let minP = Infinity
      let maxP = -Infinity
      let minEx: ExchangeId | null = null
      let maxEx: ExchangeId | null = null
      for (const l of this.sim.listings) {
        if (l.m !== cfg.mode || l.sym !== coin.symbol) continue
        if (!cfg.exchanges[l.ex]) continue
        const t = this.sim.tickers.get(`${l.ex}:${l.m}:${l.sym}`)
        if (!t) continue
        if (t.price < minP) { minP = t.price; minEx = l.ex }
        if (t.price > maxP) { maxP = t.price; maxEx = l.ex }
      }
      if (!minEx || !maxEx || minEx === maxEx) continue
      const vol = this.sim.vol24h.get(coin.symbol) ?? 0
      if (vol < cfg.minVol24h) continue
      const spread = ((maxP - minP) / minP) * 100
      if (spread < cfg.minSpreadPct) continue

      const key = `${coin.symbol}_${minEx}_${maxEx}`
      seen.add(key)
      const existing = this.arbActive.get(key)
      if (existing) {
        existing.spreadPct = spread
        existing.vol24h = vol
        existing.time = now
      } else {
        this.arbActive.set(key, { symbol: coin.symbol, buyExchange: minEx, sellExchange: maxEx, spreadPct: spread, vol24h: vol, time: now, lastNotified: 0 })
        this.stats.arbitrages += 1
      }

      const st = this.arbActive.get(key)!
      const lastN = this.arbCooldown.get(coin.symbol) ?? 0
      const notifyThreshold = Math.max(cfg.minSpreadPct * 1.8, 1.0)
      if (spread >= notifyThreshold && now - lastN > 120_000) {
        this.arbCooldown.set(coin.symbol, now)
        emitNotification({
          type: 'arbitrage',
          severity: spread >= 1.5 ? 'warning' : 'info',
          title: `${coin.symbol} · спред ${spread.toFixed(2)}%`,
          message: `Покупка ${exName(minEx)} → продажа ${exName(maxEx)} · объём 24ч ${fmtUsd(vol)}`,
          voiceText: voiceTextArbitrage(coin.symbol, spread),
        })
      }
    }

    for (const key of [...this.arbActive.keys()]) {
      if (!seen.has(key)) this.arbActive.delete(key)
    }

    const opps = [...this.arbActive.values()]
      .sort((a, b) => b.spreadPct - a.spreadPct)
      .slice(0, 40)
      .map((o) => ({
        id: `${o.symbol}_${o.buyExchange}_${o.sellExchange}`,
        symbol: o.symbol, market: useApp.getState().arbitrage.mode,
        buyExchange: o.buyExchange, buyPrice: this.sim.ticker(o.buyExchange, useApp.getState().arbitrage.mode, o.symbol)?.price ?? 0,
        sellExchange: o.sellExchange, sellPrice: this.sim.ticker(o.sellExchange, useApp.getState().arbitrage.mode, o.symbol)?.price ?? 0,
        spreadPct: o.spreadPct, vol24h: o.vol24h, time: o.time,
      }))

    useLive.setState({ arbitrageOpps: opps })
  }

  // ── Новости ─────────────────────────────────────────────────────────

  private newsTick() {
    const now = Date.now()
    if (now < this.nextNewsAt) return
    this.nextNewsAt = now + 25_000 + Math.random() * 45_000
    const item = generateNews()
    const news = [item, ...useLive.getState().news].slice(0, 60)
    this.stats.news += 1
    useLive.setState({ news })

    if (item.impact === 'high') {
      emitNotification({
        type: 'news',
        severity: 'warning',
        title: item.title,
        message: `${item.category} · ${item.source} · влияет на: ${item.affects.join(', ')}`,
        voiceText: voiceTextNews(item.title),
      })
    }
  }

  // ── Fear & Greed ────────────────────────────────────────────────────

  private fgTick() {
    this.nextFgAt = Date.now() + 20_000
    const live = useLive.getState().fearGreed
    if (live.source === 'live') {
      // Живое значение — плавно движемся к нему (обновится при следующем fetch)
      this.fgValue = this.fgValue * 0.7 + live.value * 0.3
    } else {
      this.fgValue = Math.max(8, Math.min(92, this.fgValue + (Math.random() - 0.5) * 6))
    }
    this.fgHistory = [...this.fgHistory, this.fgValue].slice(-30)
    useLive.setState({ fearGreed: { value: Math.round(this.fgValue), history: this.fgHistory, source: live.source } })
  }

  // ── Коннекты ────────────────────────────────────────────────────────

  private connectsTick() {
    const now = Date.now()
    for (const c of this.connects) {
      c.latencyMs = Math.max(6, c.latencyMs * 0.7 + (9 + Math.random() * 45) * 0.3)
      c.msgsPerSec = Math.max(20, c.msgsPerSec * 0.7 + (60 + Math.random() * 170) * 0.3)
      const roll = Math.random()
      if (c.status === 'online' && roll < 0.01) c.status = 'degraded'
      else if (c.status === 'degraded' && roll < 0.15) c.status = 'online'
      c.booksLive = c.status === 'online' ? c.booksTotal : Math.floor(c.booksTotal * (0.3 + Math.random() * 0.4))
      c.lastMsg = now
    }
  }
}

const g = globalThis as unknown as { __cpHub?: EngineHub }
export function getHub(): EngineHub {
  if (!g.__cpHub) g.__cpHub = new EngineHub()
  return g.__cpHub
}

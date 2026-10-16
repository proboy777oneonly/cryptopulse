// ════════════════════════════════════════════════════════════════════
// Листинг/Делистинг — анонсы BINANCE · BYBIT · OKX (F+S) + живой дифф
// ════════════════════════════════════════════════════════════════════

import type { TickerHub } from './exchanges'
import { jget } from './types'

export interface ListingEvent {
  id: string
  kind: 'listing' | 'delisting'
  ex: 'BINANCE' | 'BYBIT' | 'OKX'
  m: 'F' | 'S'
  symbols: string[]
  title: string
  url: string
  time: number
  source: 'announce' | 'live'
}

type Ex3 = ListingEvent['ex']

const MAX_ITEMS = 120

// ─── Парсинг заголовков ─────────────────────────────────────────────

const QUOTES = '(?:USDT|USDC|FDUSD|BUSD|TUSD|USDⓈ|USD)'

/** Торговые пары вида XUSDT / X-USDT / X/USDT / X_USDT / X/USDⓈ */
function extractPairs(text: string): string[] {
  const out = new Set<string>()
  // X/USDⓈ, X-USDT, X_USDT, XUSDT
  const re = new RegExp(`\\b([A-Z0-9]{2,10})(?:-|_|/)?${QUOTES}\\b`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.add(m[1] + 'USDT')
  return [...out]
}

/** Голые тикеры после "of " или в перечислении "L3,VIC" */
function extractBareTokens(text: string): string[] {
  const out = new Set<string>()
  // "Delisting of L3,VIC" / "Delisting of GODS,SCRT"
  const ofMatch = /\bof\s+([A-Z0-9]{2,10}(?:\s*,\s*[A-Z0-9]{2,10})+)\b/.exec(text)
  if (ofMatch) for (const t of ofMatch[1].split(',')) if (/[A-Z]/.test(t)) out.add(t.trim() + 'USDT')
  // "list XXX" / "launch XXX" — только тикеры с буквами, не числа/слова
  const listMatch = /\b(?:list|launch|delist)\s+([A-Z0-9]{2,10})\b(?!\s+(?:token|trading|pair|several|spot|perpetual))/i.exec(text)
  if (listMatch && /[A-Z]/.test(listMatch[1])) out.add(listMatch[1].toUpperCase() + 'USDT')
  return [...out].filter((s) => {
    const base = s.replace('USDT', '')
    return /[A-Z]/.test(base) && !/^(TOKEN|PAIR|PAIRS|SEVERAL|SPOT|NEW|USDT|USDC|USD)$/.test(base)
  })
}

function detectMarket(text: string): 'F' | 'S' {
  const t = text.toLowerCase()
  if (/(perpetual|perp|futures?|swap|derivatives?|leverage|margin)/.test(t)) return 'F'
  return 'S'
}

/** Отсеиваем шум: коллатерал, bStocks, займы, стейкинг и прочее */
function isNoise(title: string): boolean {
  return /(collateral|bstocks?|tokenized|borrow|loan|staking|earn|double|vip|airdrop|quiz|burn|refund|insurance)/i.test(title)
}

function symList(title: string, description?: string): string[] {
  const fromTitle = extractPairs(title)
  if (fromTitle.length > 0) return fromTitle
  if (description) {
    const fromDesc = extractPairs(description)
    if (fromDesc.length > 0) return fromDesc.slice(0, 8)
  }
  return extractBareTokens(title).slice(0, 8)
}

// ─── Источники анонсов ──────────────────────────────────────────────

interface RawAnn {
  id: string
  title: string
  url: string
  time: number
  description?: string
}

async function fetchBinanceCms(catalogId: number, pageSize: number): Promise<RawAnn[]> {
  const url = `https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=${pageSize}&catalogId=${catalogId}`
  const d = await jget(url, 12_000)
  const cat = d?.data?.catalogs?.[0]
  const arts = (cat?.articles ?? []) as Array<{ id: number; code: string; title: string; releaseDate: number }>
  return arts.map((a) => ({
    id: `bnc_${a.code ?? a.id}`,
    title: String(a.title ?? ''),
    url: `https://www.binance.com/en/support/announcement/${a.code ?? ''}`,
    time: Number(a.releaseDate) || Date.now(),
  }))
}

async function fetchBybit(type: string): Promise<RawAnn[]> {
  const url = `https://api.bybit.com/v5/announcements/index?locale=en-US&category=new-crypto&type=${type}&page=1&size=20`
  const d = await jget(url, 12_000)
  const list = (d?.result?.list ?? []) as Array<{ title: string; description: string; url: string; dateTimestamp: number }>
  return list.map((a, i) => ({
    id: `byb_${type}_${a.url.slice(-24)}_${i}`,
    title: String(a.title ?? ''),
    description: String(a.description ?? ''),
    url: String(a.url ?? ''),
    time: Number(a.dateTimestamp) || Date.now(),
  }))
}

async function fetchOkx(annType: string): Promise<RawAnn[]> {
  const url = `https://www.okx.com/api/v5/support/announcements?annType=${annType}&page=1&size=20`
  const d = await jget(url, 12_000)
  const rows = (d?.data ?? []) as Array<{ details: Array<{ title: string; url: string; pTime: string }> }>
  const out: RawAnn[] = []
  for (const r of rows) {
    for (const it of r.details ?? []) {
      out.push({
        id: `okx_${annType}_${it.url.slice(-40)}`,
        title: String(it.title ?? ''),
        url: String(it.url ?? ''),
        time: Number(it.pTime) || Date.now(),
      })
    }
  }
  return out
}

// ─── Движок ─────────────────────────────────────────────────────────

export class ListingsEngine {
  items: ListingEvent[] = []
  onListings: ((fresh: ListingEvent[]) => void) | null = null
  errors = 0

  private seen = new Set<string>()
  private seeded = new Set<string>()
  private baseline = new Map<string, Set<string>>()
  private timer: ReturnType<typeof setInterval> | null = null
  private tickerHub: TickerHub | null = null

  /** Зеркало символов биржи для живого диффа */
  setTickerHub(hub: TickerHub) {
    this.tickerHub = hub
  }

  start() {
    // первый проход сразу, дальше цикл
    void this.pollAll()
    this.timer = setInterval(() => void this.pollAll(), 150_000)
    // живой дифф символов — каждую минуту
    setInterval(() => void this.liveDiff(), 60_000)
  }

  private push(e: ListingEvent, emit: boolean) {
    if (this.seen.has(e.id)) return
    this.seen.add(e.id)
    this.items.push(e)
    this.items = this.items.sort((a, b) => b.time - a.time).slice(0, MAX_ITEMS)
    if (emit && this.onListings) this.onListings([e])
  }

  private parseBatch(ex: Ex3, kind: 'listing' | 'delisting', anns: RawAnn[], sourceKey: string) {
    const first = !this.seeded.has(sourceKey)
    const fresh: ListingEvent[] = []
    for (const a of anns) {
      if (isNoise(a.title)) continue
      const hasKeyword = kind === 'listing' ? /\b(list|launch|add)\b/i.test(a.title) : /\b(delist|remove|discontinu)/i.test(a.title)
      if (!hasKeyword) continue
      if (kind === 'listing' && /delist/i.test(a.title)) continue
      if (kind === 'delisting' && !/delist|discontinu/i.test(a.title)) continue
      const symbols = symList(a.title, a.description)
      if (kind === 'listing' && symbols.length === 0) continue
      const e: ListingEvent = {
        id: `${ex.toLowerCase()}_${kind}_${a.id}`,
        kind, ex, m: detectMarket(`${a.title} ${a.description ?? ''}`),
        symbols, title: a.title.replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, '').trim(),
        url: a.url, time: a.time, source: 'announce',
      }
      this.push(e, !first)
      if (!first) fresh.push(e)
    }
    if (first) this.seeded.add(sourceKey)
    if (fresh.length > 0 && this.onListings) this.onListings(fresh)
  }

  private async pollAll() {
    const jobs: Array<Promise<void>> = [
      // Binance: листинги (кат.48) + делисты в общих новостях (кат.49)
      fetchBinanceCms(48, 20)
        .then((a) => this.parseBatch('BINANCE', 'listing', a, 'bnc_list'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] binance cat48:', (e as Error).message) }),
      fetchBinanceCms(49, 20)
        .then((a) => this.parseBatch('BINANCE', 'delisting', a, 'bnc_del'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] binance cat49:', (e as Error).message) }),
      // Bybit: new_crypto + delistings
      fetchBybit('new_crypto')
        .then((a) => this.parseBatch('BYBIT', 'listing', a, 'byb_list'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] bybit list:', (e as Error).message) }),
      fetchBybit('delistings')
        .then((a) => this.parseBatch('BYBIT', 'delisting', a, 'byb_del'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] bybit del:', (e as Error).message) }),
      // OKX: new-listings + delistings
      fetchOkx('announcements-new-listings')
        .then((a) => this.parseBatch('OKX', 'listing', a, 'okx_list'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] okx list:', (e as Error).message) }),
      fetchOkx('announcements-delistings')
        .then((a) => this.parseBatch('OKX', 'delisting', a, 'okx_del'))
        .catch((e) => { this.errors++; console.error('[LISTINGS] okx del:', (e as Error).message) }),
    ]
    await Promise.allSettled(jobs)
  }

  /** Живой дифф: новый символ в торгах = фактический листинг */
  private async liveDiff() {
    const hub = this.tickerHub
    if (!hub) return
    const combos: Array<{ ex: Ex3; m: 'F' | 'S' }> = [
      { ex: 'BINANCE', m: 'S' }, { ex: 'BYBIT', m: 'F' }, { ex: 'BYBIT', m: 'S' },
      { ex: 'OKX', m: 'F' }, { ex: 'OKX', m: 'S' },
    ]
    for (const { ex, m } of combos) {
      const key = `${ex}_${m}`
      const syms = hub.snapshotSymbols(ex, m)
      if (syms.length === 0) continue
      const base = this.baseline.get(key)
      if (!base) {
        this.baseline.set(key, new Set(syms))
        continue
      }
      const fresh = syms.filter((s) => !base.has(s))
      if (fresh.length > 5) {
        // массовое обновление списка (рестарт биржи и т.п.) — просто новая база
        this.baseline.set(key, new Set(syms))
        continue
      }
      for (const s of fresh.slice(0, 5)) {
        const vol = hub.symbolVol(ex, m, s)
        if (vol < 1_000) continue // ещё не торгуется по-настоящему
        this.push({
          id: `live_${key}_${s}`,
          kind: 'listing', ex, m, symbols: [s],
          title: `${s} замечен в торгах на ${ex} ${m === 'F' ? 'фьючерс' : 'спот'}`,
          url: ex === 'BINANCE' ? `https://www.binance.com/en/trade/${s.replace('USDT', '_USDT')}`
            : ex === 'BYBIT' ? `https://www.bybit.com/trade/${m === 'F' ? 'usdt' : 'spot'}/${s.replace('USDT', 'USDT')}`
              : `https://www.okx.com/trade-${m === 'F' ? 'swap' : 'spot'}/${s.replace('USDT', '-usdt').toLowerCase()}`,
          time: Date.now(),
          source: 'live',
        }, true)
      }
      this.baseline.set(key, new Set(syms))
    }
  }
}

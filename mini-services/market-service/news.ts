// ════════════════════════════════════════════════════════════════════
// Новости: реальные RSS-фиды крипт-СМИ
// ════════════════════════════════════════════════════════════════════

import { jget, type NewsItem } from './types'

const FEEDS: { url: string; source: string }[] = [
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://decrypt.co/feed', source: 'Decrypt' },
  { url: 'https://www.theblock.co/rss.xml', source: 'The Block' },
  { url: 'https://bitcoinmagazine.com/feed', source: 'Bitcoin Magazine' },
  { url: 'https://crypto.news/feed/', source: 'crypto.news' },
]

const TICKERS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX', 'LINK', 'TON', 'TRX', 'SUI', 'DOT', 'LTC', 'BCH', 'UNI', 'SHIB', 'PEPE', 'ARB', 'OP', 'APT', 'NEAR', 'ATOM', 'FIL', 'ETC', 'XLM', 'HBAR', 'WLD', 'SEI', 'TIA']

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function categorize(title: string): { category: string; impact: NewsItem['impact'] } {
  const t = title.toLowerCase()
  if (/(hack|exploit|drain|phish|stolen|breach|attack|rug)/.test(t)) return { category: 'Безопасность', impact: 'high' }
  if (/(lawsuit|sues|sec |cftc|regulat|ban |bans |court|sanction|mica|legislation|bill )/.test(t)) return { category: 'Регулирование', impact: 'high' }
  if (/(\betf\b|trust application|19b-4|approval)/.test(t)) return { category: 'ETF', impact: 'medium' }
  if (/(fed|inflation|cpi|rate cut|interest rate|treasury|dollar index|macro)/.test(t)) return { category: 'Макро', impact: 'medium' }
  if (/(airdrop)/.test(t)) return { category: 'Аирдропы', impact: 'low' }
  if (/(defi|liquidity|yield|dex|lending|tvl|stablecoin|amm|vault)/.test(t)) return { category: 'Дефай', impact: 'medium' }
  if (/(binance|coinbase|exchange|listing|delist|bybit|okx|kraken|bitget)/.test(t)) return { category: 'Биржи', impact: 'medium' }
  if (/(upgrade|layer.?2|\bl2\b|mainnet|fork|rollup|staking|protocol|launch|testnet)/.test(t)) return { category: 'Технологии', impact: 'low' }
  return { category: 'Макро', impact: 'low' }
}

function affectsOf(title: string): string[] {
  const out: string[] = []
  for (const t of TICKERS) {
    if (new RegExp(`\\b${t}\\b`, 'i').test(title)) out.push(`${t}USDT`)
  }
  return out.slice(0, 4)
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const blocks = xml.split(/<item[\s>]/).slice(1)
  for (const b of blocks) {
    const title = stripHtml(pick(b, 'title') ?? '')
    const link = pick(b, 'link') ?? ''
    const pub = pick(b, 'pubDate') ?? pick(b, 'published') ?? ''
    const desc = stripHtml((pick(b, 'description') ?? pick(b, 'summary') ?? '').slice(0, 400))
    if (!title || !link) continue
    const time = pub ? Date.parse(pub) : Date.now()
    const { category, impact } = categorize(title)
    items.push({
      id: link,
      title: title.slice(0, 200),
      summary: (desc || title).slice(0, 220),
      category,
      impact,
      source,
      link,
      time: Number.isFinite(time) ? time : Date.now(),
      affects: affectsOf(title),
    })
  }
  return items
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) CryptoPulse/3.0', Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

export class NewsEngine {
  items: NewsItem[] = []
  private seen = new Set<string>()
  onNews: ((fresh: NewsItem[]) => void) | null = null
  errors = 0
  loadedCount = 0

  async start() {
    await this.cycle(true)
    setInterval(() => void this.cycle(false), 180_000)
  }

  private async cycle(initial: boolean) {
    const fresh: NewsItem[] = []
    const results = await Promise.allSettled(FEEDS.map(async (f) => parseRss(await fetchText(f.url), f.source)))
    let loaded = 0
    for (const r of results) {
      if (r.status === 'rejected') { this.errors += 1; continue }
      loaded += r.value.length
      for (const item of r.value) {
        if (this.seen.has(item.id)) continue
        this.seen.add(item.id)
        fresh.push(item)
      }
    }
    this.loadedCount = loaded
    if (fresh.length === 0) return
    fresh.sort((a, b) => b.time - a.time)
    if (initial) {
      this.items = fresh.slice(0, 60)
      this.onNews?.(this.items)
    } else {
      const nowFresh = fresh.filter((x) => Date.now() - x.time < 3 * 3600_000).slice(0, 15)
      if (nowFresh.length > 0) {
        this.items = [...nowFresh, ...this.items].slice(0, 60)
        this.onNews?.(nowFresh)
      }
    }
    // ограничиваем seen
    if (this.seen.size > 5000) {
      const keep = new Set(this.items.map((x) => x.id))
      this.seen = keep
    }
    console.log(`[NEWS] feeds loaded ${loaded} items, fresh ${fresh.length}, total ${this.items.length}`)
  }
}

// ─── Fear & Greed ────────────────────────────────────────────────────

export interface FgData {
  value: number
  history: number[]
  source: 'live'
  yesterday?: number
  lastWeek?: number
  lastMonth?: number
}

export async function fetchFearGreed(): Promise<FgData | null> {
  try {
    // limit=40: хватает на 30 точек истории + вчерашний/недельный/месячный срезы
    const d = await jget('https://api.alternative.me/fng/?limit=40', 10_000)
    const data = d?.data
    if (!Array.isArray(data) || data.length === 0) return null
    const hist = data.map((x: { value: string }) => Number(x.value)).reverse()
    const val = (i: number) => (Number.isFinite(hist[hist.length - 1 - i]) ? hist[hist.length - 1 - i] : undefined)
    return {
      value: Math.round(hist[hist.length - 1]),
      history: hist.slice(-30),
      source: 'live',
      yesterday: val(1),
      lastWeek: val(7),
      lastMonth: val(30),
    }
  } catch {
    return null
  }
}

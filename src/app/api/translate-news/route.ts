import { NextResponse } from 'next/server'

interface InItem {
  id: string
  title: string
  summary: string
}

interface OutItem {
  id: string
  titleRu: string
  summaryRu: string
}

// Кэш переводов в памяти процесса: id новости → перевод
const cache = new Map<string, OutItem>()
const CACHE_MAX = 2000

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function parseItems(raw: string, count: number): OutItem[] | null {
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    const out: OutItem[] = []
    for (const x of arr as Record<string, unknown>[]) {
      if (!x || typeof x.i !== 'string' || typeof x.t !== 'string') return null
      out.push({
        id: x.i,
        titleRu: clean(String(x.t)).slice(0, 300),
        summaryRu: typeof x.s === 'string' ? clean(x.s).slice(0, 400) : '',
      })
    }
    if (out.length !== count) return null
    return out
  } catch {
    return null
  }
}

/**
 * Пакетный перевод крипто-новостей на русский через LLM.
 * Кэшируется по id — повторные запросы бесплатны.
 */
export async function POST(req: Request) {
  let body: { items?: InItem[] }
  try {
    body = (await req.json()) as { items?: InItem[] }
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const items = (body.items ?? [])
    .filter((x) => x && typeof x.id === 'string' && typeof x.title === 'string' && x.title.trim().length > 0)
    .slice(0, 24)

  if (items.length === 0) return NextResponse.json({ items: [] })

  const result: OutItem[] = []
  const todo: InItem[] = []
  for (const it of items) {
    const hit = cache.get(it.id)
    if (hit) result.push(hit)
    else todo.push(it)
  }

  if (todo.length > 0) {
    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()
      const payload = todo.map((x) => ({
        i: x.id,
        t: clean(x.title).slice(0, 250),
        s: clean(x.summary ?? '').slice(0, 300),
      }))
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'assistant',
            content:
              'Ты — переводчик криптовалютных новостей. Переводишь заголовки и краткие описания с английского на русский язык для трейдеров. ' +
              'Правила: Bitcoin пиши «Биткоин», Ethereum — «Эфириум»; тикеры (BTC, ETH, SOL) и названия компаний оставляй без перевода; суммы в долларах адаптируй ($1.5B → $1,5 млрд); ' +
              'стиль — живой новостной, без буквализмов; не добавляй пояснений. ' +
              'Ответ СТРОГО в формате JSON-массива: [{"i":"<id>","t":"<перевод заголовка>","s":"<перевод описания>"}] — по одному объекту на каждый входной объект, в том же порядке, без markdown.',
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        thinking: { type: 'disabled' },
      })
      const raw = completion.choices[0]?.message?.content ?? ''
      // срезаем возможные ```json ... ``` обёртки
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const parsed = parseItems(jsonStr, todo.length)
      if (parsed) {
        for (const p of parsed) {
          if (p.titleRu) {
            cache.set(p.id, p)
            result.push(p)
          }
        }
        if (cache.size > CACHE_MAX) {
          const drop = cache.size - CACHE_MAX
          let i = 0
          for (const k of cache.keys()) {
            if (i++ >= drop) break
            cache.delete(k)
          }
        }
      }
    } catch {
      // LLM недоступна — вернём то, что есть из кэша
    }
  }

  return NextResponse.json({ items: result })
}

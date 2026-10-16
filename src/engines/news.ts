import type { NewsCategory, NewsImpact, NewsItem } from './types'
import { uid } from './types'

interface Template {
  title: string
  summary: string
  category: NewsCategory
  impact: NewsImpact
  affects: string[]
}

const SOURCES = ['The Block', 'CoinDesk', 'Reuters', 'Bloomberg', 'Forklog', 'Decrypt', 'Cointelegraph', 'РБК Крипто', 'Forbes']

const MAJORS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']
const ALTS = ['ARB', 'OP', 'SUI', 'TIA', 'INJ', 'SEI', 'ENA', 'WLD', 'PENDLE', 'TON']
const MEMES = ['PEPE', 'WIF', 'BONK', 'SHIB', 'MOG', 'POPCAT']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function templates(): Template[] {
  const major = pick(MAJORS)
  const alt = pick(ALTS)
  const meme = pick(MEMES)
  const amount = pick([80, 120, 240, 350, 500, 750])
  const pct = pick([1.2, 2.4, 3.1, 4.8, 6.2])
  return [
    {
      title: `SEC одобрила новый спотовый ETF на ${major}`,
      summary: `Регулятор дал зелёный свет фонду, отслеживающему цену ${major}. Запуск торгов ожидается в течение двух недель, аналитики прогнозируют приток до $${amount}M в первый месяц.`,
      category: 'ETF', impact: 'high', affects: [major, 'рынки'],
    },
    {
      title: `Федрезерв сохранил ставку — риск-активы отреагировали ростом`,
      summary: `Комитет по открытым рынкам оставил ключевую ставку без изменений. Комментарии председателя оказались мягче ожиданий: биткоин прибавил ${pct}% в течение часа после выступления.`,
      category: 'Макро', impact: 'high', affects: ['BTC', 'ETH', 'рынки'],
    },
    {
      title: `Whale переместил ${(amount * 8).toFixed(0)} BTC на биржу`,
      summary: `Крупный холдер перевёл монеты на горячий кошелёк биржи после ${pick([14, 26, 90])} месяцев неактивности. Исторически такие переводы предшествовали продажам и локальным разворотам.`,
      category: 'Биржи', impact: 'medium', affects: ['BTC'],
    },
    {
      title: `Взлом DeFi-протокола: ущерб $${amount}M`,
      summary: `Неизвестный атаковал уязвимость в смарт-контракте моста. Команда приостановила выводы, токен проекта упал на ${pct * 2}%. Средства частично заморожены на адресе атакующего.`,
      category: 'Безопасность', impact: 'high', affects: ['Дефай', alt],
    },
    {
      title: `BlackRock увеличила позиции в крипто-ETF`,
      summary: `Крупнейший управляющий активами докупил бумаги на $${(amount * 1.5).toFixed(0)}M. Совокупный приток в спотовые фонды за неделю достиг максимума за квартал.`,
      category: 'ETF', impact: 'medium', affects: ['BTC', 'ETH'],
    },
    {
      title: `${pick(['Binance', 'Bybit', 'OKX', 'Coinbase'])} листингует ${alt}`,
      summary: `Биржа объявила о добавлении ${alt} в спотовую зону с открытием торгов через 6 часов. Исторически листинги крупных площадок давали импульс +${pct}% в первые сутки.`,
      category: 'Биржи', impact: 'medium', affects: [alt],
    },
    {
      title: `Евросоюз ускорил регулирование стейблкоинов`,
      summary: `Регуляторы представили обновлённые требования к резервам эмитентов. Отрасль опасается оттока ликвидности с мелких площадок в пользу крупнейших монет.`,
      category: 'Регулирование', impact: 'medium', affects: ['рынки', 'Дефай'],
    },
    {
      title: `${meme} вырос на ${pct * 3}% за час после вирусного поста`,
      summary: `Токен мем-сегмента показал лучшую динамику рынка после публикации известного предпринимателя. Объём торгов вырос в ${pick([4, 7, 12])} раз, открытый интерес — на ${pct * 5}%.`,
      category: 'Дефай', impact: 'low', affects: [meme, 'мемы'],
    },
    {
      title: `Запуск обновления сети ${pick(['Solana', 'Ethereum', 'Avalanche'])} намечен на квартал`,
      summary: `Разработчики опубликовали roadmap с деталями масштабирования: прототип снижает стоимость транзакций на порядок и повышает пропускную способность сети.`,
      category: 'Технологии', impact: 'low', affects: ['SOL', 'ETH'],
    },
    {
      title: `Отток из биткоин-ETF составил $${amount}M за сутки`,
      summary: `Первый значимый нетто-отток за ${pick([9, 12, 21])} дней. Аналитики связывают фиксацию прибыли с макростатистикой по рынку труда США.`,
      category: 'ETF', impact: 'medium', affects: ['BTC'],
    },
    {
      title: `Аирдроп нового L2-проекта подтвердился`,
      summary: `Команда слоя 2 раскрыла критерии распределения токенов ранним пользователям. Снимаю слоты — активность сети выросла на ${pct * 10}% за сутки.`,
      category: 'Аирдропы', impact: 'low', affects: [alt, 'Дефай'],
    },
    {
      title: `Инфляция в США оказалась ниже прогноза`,
      summary: `Индекс потребительских цен вырос медленнее ожиданий. Вероятность снижения ставки на ближайшем заседании подскочила до ${pick([62, 71, 84])}%, риск-активы ускорили рост.`,
      category: 'Макро', impact: 'high', affects: ['BTC', 'ETH', 'рынки'],
    },
    {
      title: `Крупная биржа приостановила выводы ${alt}`,
      summary: `Площадка сообщила о технических работах с кошельками ${alt}. Токен просел на ${pct}% на фоне неопределённости, торги продолжаются в обычном режиме.`,
      category: 'Биржи', impact: 'medium', affects: [alt],
    },
    {
      title: `Открытый интерес по ${major} обновил максимум за ${pick([3, 6, 12])} месяцев`,
      summary: `Объём нереализованных фьючерсных позиций превысил $${(amount * 0.4).toFixed(0)}M. Рост OI вместе с ценой указывает на приток новых длинных позиций.`,
      category: 'Дефай', impact: 'low', affects: [major],
    },
    {
      title: `Казначейство США обсудило стратегический резерв биткоина`,
      summary: `Источники сообщают о внутренних обсуждениях создания резерва из цифровых активов. Рынок отреагировал импульсом +${pct}% с последующей частичной фиксацией.`,
      category: 'Регулирование', impact: 'high', affects: ['BTC', 'рынки'],
    },
    {
      title: `FTX-кредиторы начнут получать выплаты в ${pick(['декабре', 'январе', 'первом квартале'])}`,
      summary: `План реструктуризации вступил в силу. Выплаты на $${(amount * 10).toFixed(0)}M могут создать временное давление на рынок, отмечают аналитики.`,
      category: 'Биржи', impact: 'medium', affects: ['рынки'],
    },
    {
      title: `Solana пережила ${pick([4, 5])}-часовой сбой валидаторов`,
      summary: `Сеть остановила обработку транзакций из-за бага в планировщике. Разработчики выпустили патч, работа восстановлена, SOL восстановил ${pct}% от падения.`,
      category: 'Технологии', impact: 'high', affects: ['SOL', 'мемы'],
    },
    {
      title: `Tether увеличила резервы в казначейских векселях`,
      summary: `Эмитент USDT отчитался о прямых вложениях в гособлигации США на $${(amount * 3).toFixed(0)}M. Аудит подтвердил полное покрытие циркулирующего предложения.`,
      category: 'Регулирование', impact: 'low', affects: ['Дефай', 'рынки'],
    },
  ]
}

export function generateNews(): NewsItem {
  const t = pick(templates())
  return {
    id: uid('news'),
    title: t.title,
    summary: t.summary,
    category: t.category,
    impact: t.impact,
    source: pick(SOURCES),
    time: Date.now(),
    affects: t.affects,
  }
}

export function initialNews(count: number): NewsItem[] {
  const items: NewsItem[] = []
  let t = Date.now() - 1000 * 60 * 8
  for (let i = 0; i < count; i++) {
    const n = generateNews()
    n.time = t
    t += 1000 * 60 * (3 + Math.random() * 14)
    items.unshift(n)
  }
  return items.sort((a, b) => b.time - a.time)
}

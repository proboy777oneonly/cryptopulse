import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/screens/v35-login.png',
    q: 'Страница входа крипто-скринера после редизайна. Проверь: 1) сплит-скрин: слева брендовая панель (логотип CryptoPulse, заголовок, мини-график со свечами, 3 строки преимуществ), справа форма; 2) в форме переключатель Вход/Регистрация, поля Email/Пароль с иконками, кнопка-глаз показа пароля, кнопка «Войти» с градиентом; 3) блок «Демо-доступ» с пунктирной рамкой; 4) нет наложений/обрезаний/багов вёрстки. Кратко по-русски.',
  },
  {
    path: '/home/z/my-project/download/screens/v35-market.png',
    q: 'Вкладка «Обзор рынка» крипто-скринера. Проверь: 1) ВЕРХНЯЯ ПАНЕЛЬ С ТИКЕРОМ И ЦЕНОЙ ОТСУТСТВУЕТ (не должно быть отдельной строки с ETHUSDT, ценой, чипами 24ч/объём/LIVE над графиком) — график начинается сразу от верха; 2) в левом верхнем углу канваса легенда: BINANCE · F · тикер · ТФ + крупная цена + % за 24ч; 3) по центру графика полупрозрачный водяной знак тикера; 4) таймфреймы по центру сверху, рисовалки слева, справа колонка с биржами и списком монет; 5) метки hi/lo диапазона, градиентные объёмы внизу; 6) дефекты. Кратко по-русски.',
  },
]

const zai = await ZAI.create()
for (const s of shots) {
  try {
    const b64 = fs.readFileSync(s.path).toString('base64')
    const res = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
            { type: 'text', text: s.q },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
    console.log(`\n===== ${s.path.split('/').pop()} =====`)
    console.log(res.choices[0]?.message?.content ?? '(нет ответа)')
  } catch (e) {
    console.log(`\n===== ${s.path.split('/').pop()} ===== ERROR: ${String(e && e.message ? e.message : e)}`)
  }
  await new Promise((r) => setTimeout(r, 3000))
}

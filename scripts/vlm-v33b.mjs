import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/v33-densities-live.png',
    q: 'Вкладка «Плотности» с реальными данными. Проверь: 1) 4 окна в ряд; 2) заголовки окон показывают ПОЛНЫЕ названия бирж (BINANCE, BYBIT, OKX, GATE, BITGET, KUCOIN, HYPERLIQ, ASTER) без обрезки; 3) строки плотностей: тикер, бейдж F/S, объём в цвете, процент, направление, возраст — всё читаемо, не наезжает; 4) дефекты вёрстки. Кратко по-русски.',
  },
  {
    path: '/home/z/my-project/download/v33-bell.png',
    q: 'Выпадающая панель уведомлений у колокола. Проверь: 1) карточки плотностей в формате «тикер + сумма + дистанция%» и внизу «биржа · объём 24ч»; 2) бейдж SHORT/LONG с иконкой; 3) читаемость и аккуратность; 4) дефекты. Кратко по-русски.',
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

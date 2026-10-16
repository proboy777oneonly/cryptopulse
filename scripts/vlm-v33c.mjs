import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/v33-final-densities2.png',
    q: 'Вкладка «Плотности» с данными. Финальная проверка: 1) заголовки всех 8 окон полные (BINANCE, BYBIT, OKX, GATE, BITGET, KUCOIN, HYPERLIQ, ASTER) без «...»; 2) 4 окна в ряд; 3) строки плотностей читаемы без наложений; 4) в шапке приложения — «N активных», «Добавить окно», «Все тикеры → все окна». Кратко по-русски.',
  },
]

const zai = await ZAI.create()
for (const s of shots) {
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
}

import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/v33-final-movements.png',
    q: 'Вкладка «Движения». Кратко: 1) кнопка «Новое окно» и «N/6 окон» в шапке приложения; 2) окно называется «ДВИЖЕНИЕ 1»; 3) дефекты есть/нет?',
  },
  {
    path: '/home/z/my-project/download/v33-final-notifications.png',
    q: 'Вкладка «Уведомления». Кратко: 1) карточки плотностей в новом формате (тикер+сумма+дистанция, внизу бирза+объём 24ч, бейдж SHORT/LONG)? 2) дефекты?',
  },
  {
    path: '/home/z/my-project/download/v33-final-arbitrage.png',
    q: 'Вкладка «Арбитраж» с данными. Кратко: 1) стат-карточки сверху; 2) таблица со строками спредов: монета, покупка (биржа+цена), продажа, спред% с баром; 3) топ-строки выделены; 4) дефекты?',
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
  await new Promise((r) => setTimeout(r, 2500))
}

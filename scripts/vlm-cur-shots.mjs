import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/cur-movements.png',
    q: 'Это вкладка «Движения» крипто-скринера. Опиши точно: 1) где находится тулбар с кнопкой «Новое окно» и счётчиком «N/6 окон» — в самом верху страницы под шапкой приложения, или ниже? 2) что находится над этим тулбаром; 3) как выглядят окна движений (заголовок, кнопки, строки алертов); 4) высота/размер окон. Ответь по-русски кратко и точно.',
  },
  {
    path: '/home/z/my-project/download/cur-densities.png',
    q: 'Это вкладка «Плотности» крипто-скринера. Опиши точно: 1) что в тулбаре сверху и в каком порядке (кнопки слева/справа); 2) сколько окон плотностей видно в ряд, занимают ли они всю ширину; 3) заголовок каждого окна и кнопки; 4) строки плотностей внутри окна. Ответь по-русски кратко и точно.',
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

// Анализ скриншотов пользователя через VLM
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/upload/pasted_image_1792184065288.png',
    q: 'Это скриншот №1 от пользователя крипто-скринера. Опиши МАКСИМАЛЬНО точно что видно: какие элементы, где расположены (вверху/внизу/слева/справа), какие кнопки и текст. Это тулбар вкладки? Что вокруг него — окна выше или ниже? Ответь подробно по-русски.',
  },
  {
    path: '/home/z/my-project/upload/pasted_image_1792184087168.png',
    q: 'Это скриншот №2 от пользователя — вкладка Уведомлений крипто-скринера. Опиши подробно структуру каждой карточки-уведомления: какие поля есть (тикер, сумма, проценты, текст, биржа, объём), как расположены, что выглядит перегруженным/лишним. Ответь подробно по-русски.',
  },
  {
    path: '/home/z/my-project/upload/pasted_image_1792184101445.png',
    q: 'Это скриншот №3 от пользователя — элементы управления окном крипто-скринера. Опиши точно: какие иконки видны, их цвета, порядок, какой тултип/подсказка показывается. Ответь подробно по-русски.',
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

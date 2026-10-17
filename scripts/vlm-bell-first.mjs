import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const zai = await ZAI.create()
const b64 = fs.readFileSync('/home/z/my-project/download/v33-bell.png').toString('base64')
const res = await zai.chat.completions.createVision({
  messages: [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
        { type: 'text', text: 'Покажи ТОЧНЫЙ текст ПЕРВОЙ карточки уведомления в этой панели — посимвольно, включая все числа и слова. Где именно видно «undefined»? Также покажи точный текст третьей строки первой карточки.' },
      ],
    },
  ],
  thinking: { type: 'disabled' },
})
console.log(res.choices[0]?.message?.content ?? '(нет ответа)')

import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const zai = await ZAI.create()
const b64 = fs.readFileSync('/home/z/my-project/download/screens/v36-bento.png').toString('base64')
const res = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    { type: 'text', text: 'Bento-сетка возможностей лендинга крипто-скринера. Карточки: «Плотности» (строки-бары с тикерами), «Движения» (мини-график), «Арбитраж», «Новости и листинги», «Голосовые алерты» (эквалайзер), «Обзор рынка» (свечи), стек «Уведомления/Монитор/Аккаунты». Есть ли РЕАЛЬНЫЕ дефекты: наложения текста, обрезанные элементы, пустые провалы сетки, разъехавшиеся колонки? Только конкретные видимые дефекты, без домыслов. Кратко по-русски.' },
  ]}],
  thinking: { type: 'disabled' },
})
console.log(res.choices[0]?.message?.content ?? '(нет ответа)')

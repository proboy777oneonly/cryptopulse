import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/screens/v36-landing.png',
    q: 'Новая главная страница (лендинг) крипто-скринера CryptoPulse. Проверь: 1) шапка с логотипом и кнопками Войти/Регистрация; 2) hero: слева крупный заголовок «Рынок движется. Вы узнаете первым.», кнопки «Начать бесплатно» и «У меня есть аккаунт», 4 стат-карточки; справа — окно терминала с живым потоком сигналов (строки с бейджами ПЛОТНОСТЬ/ДВИЖЕНИЕ/АРБИТРАЖ, тикеры, биржи, значения); 3) ВАЖНО: кнопок «Демо-вход» и «Демо-вход (админ)» НЕТ нигде; 4) ниже бегущая строка курсов; 5) нет наложений, обрезаний, пустых зон. Перечисли дефекты вёрстки, если есть. Кратко по-русски.',
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

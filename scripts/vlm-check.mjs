// Визуальная проверка скриншотов через VLM (createVision)
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  { path: '/home/z/my-project/download/v32-densities.png', q: 'Это вкладка Плотностей крипто-скринера. Проверь: 1) нет ли большого заголовка "Плотности" сверху; 2) порядок кнопок фильтра рынка ALL/F/S; 3) видны ли строки плотностей с временем-возрастом; 4) есть ли визуальные дефекты (наложения, обрезанный текст). Ответь кратко списком.' },
  { path: '/home/z/my-project/download/v32-movements-live.png', q: 'Это вкладка Движений с плавающими окнами. Проверь: 1) кнопка "Новое окно" сверху; 2) окна достаточно крупные и читаемые; 3) строки алертов с временем, тикером и процентами; 4) визуальные дефекты. Ответь кратко.' },
  { path: '/home/z/my-project/download/v32-news.png', q: 'Это вкладка Новостей на русском. Проверь: 1) сверху тулбар "Лента новостей" с поиском; 2) заголовки новостей на русском языке; 3) читаемость карточек; 4) визуальные дефекты. Ответь кратко.' },
  { path: '/home/z/my-project/download/v32-listings.png', q: 'Это вкладка Листинг/Делистинг. Проверь: 1) нет заголовка "Листинг / Делистинг" большими буквами сверху; 2) стат-карточки и фильтры; 3) карточки событий с чипами символов; 4) визуальные дефекты. Ответь кратко.' },
  { path: '/home/z/my-project/download/v32-avatar-picker.png', q: 'Это настройки профиля с выбором аватара. Проверь: 1) сетка сгенерированных аватаров (боты, зверята, планеты, геометрия, пиксели) выглядит полноценно и интересно; 2) аватары не сломаны (не пустые квадраты); 3) визуальные дефекты. Ответь кратко.' },
  { path: '/home/z/my-project/download/v32-bell.png', q: 'Это выпадающая панель уведомлений у колокола. Проверь: 1) аккуратные карточки уведомлений с иконками и цветными акцентами; 2) читаемость; 3) визуальные дефекты. Ответь кратко.' },
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
    console.log(`\n=== ${s.path.split('/').pop()} ===`)
    console.log(res.choices[0]?.message?.content ?? '(нет ответа)')
  } catch (e) {
    console.log(`\n=== ${s.path.split('/').pop()} === ERROR: ${String(e && e.message ? e.message : e)}`)
  }
  await new Promise((r) => setTimeout(r, 4000))
}

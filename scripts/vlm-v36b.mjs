import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const shots = [
  {
    path: '/home/z/my-project/download/screens/v36-bento.png',
    q: 'Секция возможностей (bento-сетка) лендинга крипто-скринера. Проверь: крупные карточки «Плотности» (со строками-барами BTC/SOL/ETH/WIF) и «Движения» (с мини-графиком TURBO), ниже карточки «Арбитраж», «Новости и листинги», «Голосовые алерты» (с эквалайзером), широкая «Обзор рынка» (свечной график) и стек из «Умные уведомления/Монитор сервера/Аккаунты и роли». Есть ли наложения, обрезания, пустые зоны, кривые выравнивания? Кратко по-русски.',
  },
  {
    path: '/home/z/my-project/download/screens/v36-themes.png',
    q: 'Секция тем оформления лендинга: 4 карточки тем (Полночь/Терминал/Закат/Кристалл) с превью-заливками, бейдж «активна» на текущей. Ниже или рядом секция бирж (8 карточек: BINANCE, BYBIT, OKX, GATE, BITGET, KUCOIN, HYPERLIQUID, ASTER). Дефекты вёрстки? Кратко по-русски.',
  },
  {
    path: '/home/z/my-project/login.png',
    q: 'IGNORE',
  },
  {
    path: '/home/z/my-project/download/screens/v36-login.png',
    q: 'Страница входа CryptoPulse. Проверь: 1) сплит-скрин — слева брендовая панель с графиком свечей, справа форма; 2) в форме переключатель Вход/Регистрация, поля Email/Пароль; 3) ВАЖНО: блока «Демо-доступ» с admin@screen.io НЕТ; 4) есть ссылка «Зарегистрироваться» внизу; 5) дефекты вёрстки. Кратко по-русски.',
  },
]

const zai = await ZAI.create()
for (const s of shots) {
  if (s.q === 'IGNORE') continue
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

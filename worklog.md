# Worklog — CryptoPulse Screener

---
Task ID: 1
Agent: main
Task: Init fullstack env, Prisma schema, seed

Work Log:
- Loaded fullstack-dev skill, ran init script, dev server on :3000
- Constraint: only `/` page route visible → SPA with hash-based client routing + API routes
- Plan: Prisma(User+Settings), custom scrypt auth, client-side market engines, 4 themes, sound+voice

Stage Summary:
- In progress

---
Task ID: 2-10
Agent: main
Task: Build full app (auth, API, engines, themes, landing, dashboard, 9 views)

Work Log:
- Prisma User+Settings pushed, admin seeded (admin@screen.io/admin123)
- API: auth (register/login/logout/me), settings GET/PUT, users admin CRUD, profile PATCH, server-stats (real os/process telemetry)
- Engines: MarketSim (~70 coins, 8 exchanges, F+S, surges, cross-exchange bias), density/movement/arbitrage/news generators, notification bus with per-type toast/sound/voice, WebAudio SoundEngine (8 sounds), VoiceEngine (ru-RU TTS)
- 4 themes in globals.css (midnight/terminal/sunset/crystal) + particle canvas, scanlines, aurora, blobs
- Landing, login/register, dashboard shell (sidebar, header, bell, profile card), views: home, densities (windows/exchanges, F/S/ALL, tickers, blacklists, send tickers), arbitrage, movements (independent windows), news, notifications journal, monitor (admin), users (admin), settings
- Single '/' route SPA with hash routing, zustand persist + server sync (debounce 2s)

Stage Summary:
- Code complete, pending lint + browser verification

---
Task ID: 11
Agent: main
Task: Verification and fixes

Work Log:
- Fixed: win[m] → win.f/win.s bug in density engine (crashed tick loop)
- Fixed: COIN_MAP import from coins.ts (500 on /)
- Fixed: toast spam — density rate 0.24→0.025, per-type toast throttle 3s, arbitrage notify threshold ≥1% + 120s cooldown
- Fixed: toaster offset 76px top so toasts don't cover header
- Browser E2E: landing renders, demo login, registration (trader@test.io, role-restricted tabs), all 9 views verified, F/S/ВСЕ dialog columns, movement alerts live, 4 themes switch + persist, bell dropdown, profile card, settings sync to server (verified via API), diagnostics tests pass
- VLM visual QA: landing/home/terminal/crystal/densities — professional grade, no real defects (noted items were dev-overlay and mid-animation toasts)
- Final: eslint clean, 0 console errors, dev.log clean

Stage Summary:
- App fully verified and working. DEMO data mode. Admin: admin@screen.io / admin123

---
Task ID: 12
Agent: main
Task: Перевод на реальные данные 8 бирж + UI-правки (тосты, плотности, движения, арбитраж cooldown)

Work Log:
- Создан mini-services/market-service (порт 3003, socket.io, path '/'):
  - Тикеры: REST-поллинг BYBIT/OKX/GATE/BITGET/KUKOIN/HL/ASTER; Binance — WebSocket
    (спот !miniTicker@arr; фьючерсы bookTicker + depth-диффы, объёмы — прокси с соседних бирж,
    т.к. fapi REST забанен по IP песочницы, тикер-стримы fapi закрыты)
  - KuCoin spot стаканы — WS /market/level2 инкременты (REST стал приватным)
  - HL — WS allMids + l2Book (обход 429)
  - Детектор стен ≥$250K в 8% глубине, top-40 символов на комбинацию, re-emit при росте ×1.6
  - Реальные RSS-новости (CoinTelegraph, CoinDesk, Decrypt, The Block, BitcoinMagazine, crypto.news)
  - Fear&Greed с alternative.me; телеметрия CPU/RSS/heap/eventloop/ws-clients
- Клиент: hub.ts переписан на socket.io ('/?XTransformPort=3003'), movers/walls/spreads/top/
  connects/stats события; density/movement/arbitrage движки считают по фильтрам пользователя
- Исправлены баги: KUCOIN→KUKOIN (id биржи), двойная нормализация символов HL/KuCoin F,
  гонка setLoading в useSymbols, нестабильные селекторы zustand (?? [] → EMPTY_EVENTS),
  ширина диалогов (sm:max-w-lg перекрывал), комбинированные стримы Binance молчали → raw /ws
- UI: тумблер F/S/ALL у окна плотностей, «N окон · 1 окно = 1 биржа» + «N активных» в тулбаре,
  комбобокс с поиском тикеров (Command), настройки окна шире и читабельнее ($M-суффиксы видны),
  настройки движений в шестерёнке у окна, кулдаун арбитража (15–600с слайдер),
  редизайн тостов (иконки lucide, severity-цвета, прогресс-бар, кнопка закрытия)
- LIVE-режим: бейдж LIVE в хедере, топы/home из topMovers, монитор на телеметрии сервиса,
  новости со ссылками на источники
- E2E через Caddy (:81): все 9 вкладок, реальная телеметрия 14/14 коннектов, 8.7k символов,
  реальные плотности/движения (39 алертов при тестовом пороге 0.3%)/арбитраж (SIRENUSDT 1.22%),
  4 темы, тосты, VLM-проверка скриншотов; eslint 0 ошибок

Stage Summary:
- Приложение полностью на реальных данных 8 бирж (F+S). Market-service: /home/z/my-project/mini-services/market-service (bun run dev, лог service.log)
- Админ: admin@screen.io / admin123. Версия 3.0.0

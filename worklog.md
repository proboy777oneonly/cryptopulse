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

---
Task ID: 13
Agent: main
Task: Багфиксы, визуал, тосты-кликом, компактные перетаскиваемые окна движений, вкладка Листинг/Делистинг (BINANCE·BYBIT·OKX F+S), редизайн уведомлений

Work Log:
- Сервер (market-service v3.1.0):
  - Новый модуль listings.ts: анонсы Binance (CMS cat.48 листинги + cat.49 делисты), Bybit (v5/announcements new_crypto + delistings), OKX (support/announcements new-listings + delistings); парсинг символов/рынка из заголовков, фильтр шума (collateral/bStocks и пр.)
  - Живой дифф символов (liveDiff каждую минуту): BINANCE_S, BYBIT_F/S, OKX_F/S — «замечен в торгах» при vol>$1k, порог >5 новых = сброс базы
  - TickerHub.snapshotSymbols/symbolVol; события 'listings:new' + listings в hello; сортировка по времени, дедуп
- Клиент:
  - NotifType += 'listing' (тосты/звук/голос/журнал/настройки), persist-merge дефолтов для старых профилей, дефолт звук bell
  - hub.ts: hello.listings + listings:new → стор + уведомления (листинг=success, делист=warning)
  - Новая вкладка «Листинг» (listings.tsx): стат-карточки, фильтры (тип/биржа/F-S/источник), карточки с символами-чипами, ссылками, live-бейджем
  - Движения: окна компактнее (430px, max-h 240px), перетаскивание за шапку (pointer capture), z-index поверх, двойной клик — сброс позиции, позиция x/y в конфиге (синхронизация на сервер), «+Новое окно» наверх, старая подпись удалена, на <1024px — стопка без absolute
  - Тосты: клик по телу тоста закрывает его (role=button, hover-эффект)
  - Колокол: иконки типов, relative time, счётчик критичных, переход на профильную вкладку по клику
  - Журнал уведомлений: группировка Сегодня/Вчера/дата, фильтр «Непрочитанные», severity-бейджи ВАЖНО/КРИТИЧНО
  - Визуал: контраст muted-foreground во всех 4 темах (midnight #9aa6c3, terminal #74c495, sunset #bba3b7), antialiasing, ::selection, caret, focus-visible, Firefox scrollbar, text-wrap: pretty
- Багфиксы: monitor EX_MAP fallback, dashboard ReactNode, monitor useEffect import, landing SVG x4→x2, app-store toasts as const, exchanges.ts p.def null-guard, listings base undefined, set-state-in-effect (derived dragPos)
- E2E: свежая сессия 0 ошибок; драг окна (126,240→413,528), dblclick reset, клик тоста закрывает, листинги 50 событий (13 BNB/18 BYB/19 OKX, 6 live), все 10 вкладок рендерятся; VLM 7–9/10
- Сервисы перезапущены через setsid (survive): :3000, :3003, Caddy :81

Stage Summary:
- v3.1.0: вкладка Листинг/Делистинг на реальных анонсах 3 бирж + живом диффе, перетаскиваемые компактные окна движений, клик-закрытие тостов, редизайн уведомлений, глобальное улучшение читаемости. Админ: admin@screen.io / admin123

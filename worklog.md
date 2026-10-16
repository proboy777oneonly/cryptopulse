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

---
Task ID: 14
Agent: main
Task: v3.2.0 — семантика «возраста» плотностей, цвета объёма, крупные окна движений с X/корзиной, перевод новостей на RU (LLM), редизайн листингов, генерируемые аватары, замирание тостов, улучшение тем

Work Log:
- Сервер (books.ts): стабильный id стены, firstSeen в WallRow, heartbeat живых стен каждые 10с (молодые) / 30с (старые) — клиент видит возраст и «простоёт»
- Плотности — новая семантика lifetimeSec: стена попадает в окно, когда её возраст (now - firstSeen) ≥ фильтра; событие дедуплицируется по стабильному id, живёт TTL 45с с продлением; в тосте «Стоит 1:09»; в строке — чип возраста (fmtAge) вместо обратного отсчёта
- Плотности — тумблер рынков ALL → F → S; настройка «Цвет объёма заявки»: до 4 порогов (от $XM → цвет из палитры 8), дефолт до $5M белый / от $5M фиолетовый / от $10M зелёный; volTiers в конфиге окна + merge дефолтов для старых профилей
- Движения: окна 540px, тело до 340px, строки крупнее (время HH:MM:SS в чипе, бейдж F/S, % 15px); X = удалить окно, корзина = очистить ленту (clearMovementAlerts в live-store, disabled при пустой); +Новое окно — крупная кнопка сверху
- Новости: перевод заголовков/описаний на RU через z-ai (POST /api/translate-news, батчи ≤24, кэш 2000 в памяти); хаб патчит стор, важные новости уведомляются после перевода (таймаут 8с → оригинал); тумблер RU/EN, индикатор «перевод…», заголовки 15px
- Заголовки вкладок убраны (VIEW_META '' у densities/movements/news/listings, header скрывает пустые)
- Листинги: редизайн — тулбар (поиск + «за 7 дней» + чипы бирж), стат-карточки 2xl-числа, карточки с hover-подъёмом
- Тосты: animation-play-state: paused при hover (таймер sonner и так стоит) — замирание прогресс-бара проверено (running/paused)
- Аватары: src/components/avatar.tsx — генератор SVG (боты/зверята/планеты/геометрия/пиксели, мулберри-PRNG от spec+цвета, палитры 8 цветов); спецификация «bot:3» хранится в avatarEmoji (без миграции БД); пикер 5×4 + эмодзи в настройках; UserAvatar рендерит оба типа
- Темы: контраст и глубина всех 4 (midnight глубже, terminal ярче зелень, sunset насыщеннее, crystal чище стекло)
- Инфра: next dev с NODE_OPTIONS max-old-space-size=1200 (были OOM на 4GB-машине); сервисы запускаются double-fork orphan-паттерном (bash -c '( setsid … & )')
- E2E: eslint 0, tsc src 0 ошибок, консоль чистая; ALL/F/S порядок, возраст в строках, $6M → фиолетовый, clear окна + тост, RU-перевод («Биткоин столкнётся с удалением из индекса…»), RU/EN тумблер, колокол с severity-полосами, аватар bot:1 сохранён, 4 темы переключаются, стены 2500/20с все с firstSeen; VLM-проверка 6 скриншотов — без дефектов

Stage Summary:
- v3.2.0 готова. Админ: admin@screen.io / admin123. Сервисы: :3000 (next), :3003 (market-service), Caddy :81

---
Task ID: 15
Agent: main
Task: v3.3.0 — действия вкладок в шапке, 4 окна в Плотностях, ДВИЖЕНИЕ N, редизайн уведомлений, копирование тикера, оптимизация нагрузки (event loop 2с+ → 0мс), Арбитраж и F&G

Work Log:
- Шапка приложения (header-actions.tsx + ui-store.ts): действия активной вкладки теперь живут в верхней sticky-шапке:
  Движения [+Новое окно · N/6], Плотности [N активных · +Добавить окно · Все тикеры→все окна + диалог выбора биржи],
  Новости [N важных · RU/EN · только важные · поиск], Листинги [N за 7 дней · поиск],
  Уведомления [N всего·M новых · поиск · непрочитанные · прочитать все · очистить], Арбитраж [N спредов · лучший% · F/S · поиск]
- Тулбары внутри вкладок удалены (движения/плотности/новости/листинги/уведомления) — контент начинается сразу, вертикальное место сэкономлено
- Плотности: сетка md:2/xl:3/2xl:4 — на 1920px теперь 4 окна в ряд (было 3); компактные строки (тикер w-62, объём w-52, дистанция w-38, возраст w-46, цена только 2xl, send-кнопка абсолютом по hover); заголовки окон полные (HYPERLIQ для HL), кнопки h-6
- Движения: «ОКНО N» → «ДВИЖЕНИЕ N» (дефолт + миграция withMovementNames в hydrate/merge), «Движение активно» в настройках, из шапки окна убрана лишняя иконка
- Уведомления (скрин 2): structured-поля в AppNotification (ticker/distPct/volumeUsd/direction/changePct/exchange/market/vol24h/spreadPct);
  DensityBody/MovementBody: строка «тикер · $размер · дистанция%» + бейдж SHORT/LONG с иконкой, низ «биржа · F/S · объём 24ч»;
  применяется в тостах, колоколе и журнале; verbose-текст («Стоит 6:13 · плотность продавцов на…») убран;
  unread пересчитывается от длины журнала (было 13944+ без上限, теперь ≤300)
- Клик по тикеру копирует его (TickerCopy в ui-bits): плотности, движения, арбитраж, топы Главной, уведомления — с вспышкой «✓» 900мс, clipboard API + execCommand fallback
- Тултипы: все title="-подсказки удалены по всему проекту (29 шт. в 10 файлах), остались только aria-label
- Оптимизация market-service (главное — event loop был 2с+):
  * Binance depth-стримы: F @100ms→@500ms, S @100ms→@1000ms (в ~6 раз меньше сообщений и JSON.parse)
  * movers: дедуп по ключу в 3с-батче (последнее состояние символа)
  * все тяжёлые расчёты и эмиты (movers/walls/top/spreads/connects/stats) пропускаются при 0 подключённых клиентов
  * heartbeatWalls постоянно подчищает мёртвые стены (порог детект-чистки 30k→12k)
  * РЕЗУЛЬТАТ: eventLoopLagMs 3.56→0.64 (у пользователя было 2000+), CPU системы 85%→13-20%
- Оптимизация клиента: DensityRow подписывается на tick сам (окно не перерендеривается каждую секунду);
  hub.handleSpreads — Map-индекс вместо O(n²) find; частицы звёзд: 60→30 fps + 170→120 звёзд (нагрузка GPU/CPU вдвое)
- Багфикс листингов: сервер слал ex/m, клиент ждал exchange/market → бейджи бирж были пустыми,
  фильтры по бирже не работали, в уведомлениях «undefined». Добавлен toClientListing-маппинг на сервере
- Арбитраж: редизайн — стат-карточки (активных/лучший/средний/бирж), таблица с ценами покупки/продажи,
  топ-3 с короной и подсветкой, крупный спред% с глоу, поиск по монете из шапки, F/S в шапке
- Индекс страха и жадности: alternative.me limit=40 → вчера/неделю/месяц назад (FgData + FearGreed типы),
  датчик с активным сектором и делениями, дельта «▲N за сутки», 3 мини-карточки среза истории
- E2E: tsc 0, eslint 0, все 10 вкладок ок, консоль чистая; VLM-проверки: плотности 4-в-ряд с полными именами,
  ДВИЖЕНИЕ 1, новый формат уведомлений в журнале и колоколе, арбитраж с живыми спредами (SIRENU 1.11%),
  F&G с дельтой и срезами; копирование тикера проверено (✓ + восстановление)
- Сервисы перезапущены: :3000 (next), :3003 (market-service v3.3.0, setsid), Caddy :81

Stage Summary:
- v3.3.0 готова. Нагрузка радикально снижена, все вкладки управляются из шапки, уведомления компактные,
  тикеры копируются кликом. Админ: admin@screen.io / admin123

---
Task ID: 16
Agent: main
Task: v3.4.0 — фикс стрелки F&G, видимость тикеров топов, режимы арбитража F-F/F-S/S-F/S-S, новая вкладка «Обзор рынка» (график + рисовалки + линейка на колёсико), визуал уведомлений, убрать Send из строк плотностей

Work Log:
- Индекс страха и жадности (скрин 1): баг стрелки — формула угла была смещена на 90° по часовой (при 63 указывала вправо-вниз); исправлено на -180+v*1.8 (0=влево, 50=вверх, 100=вправо). Полиш: сужающееся остриё с противовесом, белый хаб, мелкие деления 12.5/37.5/62.5/87.5, подписи 0/100
- Топы роста/падения (скрин 2): TickerCopy получил prop display; строки переработаны — база тикера жирная 14px + приглушённый квонт (USDT), тикеру отдаётся flex-1 (раньше w-14 обрезал), ранг/бейдж биржи/объём/% фикс. ширины
- Плотности (скрин 3): убрана кнопка Send (бумажный самолётик) сбоку строк — кнопка абсолютом по hover удалена вместе с диалогом быстрой отправки; Диалог тикеров и «Все тикеры → все окна» в шапке остались
- Арбитраж — 4 режима (F-F, F-S, S-F, S-S):
  * Сервер exchanges.ts: spreads() переписан — по каждому рынку строится BestRow (min/max цена по биржам), FF/SS требуют ≥2 бирж, FS/SF кросс-рынок (в т.ч. базис на одной бирже); SpreadSets {FF,FS,SF,SS} в types
  * Клиент: ArbMode/ARB_MODES/arbModeMeta/normalizeArbMode; ArbitrageConfig.mode: ArbMode; ArbOpportunity.buyMarket/sellMarket; миграция 'F'→'FF', 'S'→'SS' в hydrate/merge
  * hub.handleSpreads: ключ включает режим, в уведомлении «Покупка F … → продажа S …»
  * Шапка: 4 кнопки F-F/F-S/S-F/S-S (оранж/циан по рынку); в таблице MktChip F/S на каждой ноге; описание режима
- Уведомления (скрин 4): карточки крупнее (py-3.5, rounded-2xl), severity-градиент непрочитанных (красный/жёлтый/акцент 7%), левая полоса с глоу, иконка 40px с подсветкой, время в чипе, hover-подъём; заголовки дней с чипом количества
- Новая вкладка «Обзор рынка» (в стиле скрина 5):
  * /api/klines — прокси свечей BINANCE/BYBIT/OKX · F+S · нормализация Candle[]; кэш (1м=25с, 5/15м=90с, дальше=180с), фолбэк-источники (fapi→spot и т.п.), circuit breaker по хосту (3 фейла → бан 10 мин), отдача stale-кэша при недоступности апстрима; проверено: при 418 от fapi график живёт на споте
  * chart-canvas.tsx — canvas-график: свечи+объёмы, шкалы цены/времени, кроссхэйр с чипами, OHLC-легенда, линия последней цены; зум колесом (non-passive listener, якорь под курсором), панорама драгом, dblclick-сброс; рисовалки: тренд/горизонталь/вертикаль/прямоугольник/фибо (7 уровней с подписями), предпросмотр, перетаскивание за хит-тест, ПКМ — удалить, Esc — отмена; ЛИНЕЙКА на колёсико мыши (средняя кнопка, drag) и в тулбаре (клик-клик): Δцены, Δ%, бары, длительность; рисунки в localStorage по ключу ex|market|symbol|interval; redrawRef-паттерн (без сброса вида при тике цены)
  * market.tsx — вкладка: 3 биржи + F/S + поиск тикера (компобокс с топ-150 по объёму), живая цена + чипы 1м/5м/24ч + объём; автоварьировка тикера с наибольшим объёмом 24ч на бирже (module-level marketSel); список «Монеты» (ранг/тикер/24ч/5м live/объём, клик — выбор, тикер копируется); мини-график 1м; автообновление (символы 60с, свечи 30-120с, мини 20с); fetchRetry от транзитных 5xx
  * Регистрация: ViewId 'market', NAV после Главной, иконка CandlestickChart, VIEW_META пустой (без заголовка, максимум места)
- Инфра: сброс пароля админа (admin123) — БД не совпадала с ворклогом; версия v3.4.0 в сайдбаре и hello market-сервиса
- E2E через Caddy :81: tsc 0, eslint 0 (все 5 первоначальных ошибок исправлены — refs-in-render, set-state-in-effect); Обзор рынка: ETHUSDT автоварьировка (BINANCE F), 422/716 монет, свечи/объёмы/шкалы ок, тренд-линия рисуется и персистится (localStorage), линейка колёсиком (+53.4 / +2.22% / 43 бара), зум колесом, BYBIT→BTC 81759, OKX→ETH 2423; F&G стрелка вверх-вправо при 63 ✓, срезы 53/59/51 (не «—»); топы: ICNT USDT +24.82% полностью видно; арбитраж F-S: SIREN GATE F→KUCOIN S 40.15%, базис BINANCE F→S 0.73%; плотности: Send-кнопок 0, 73 age-чипа; уведомления: карточки «KORUUSDT $1.2M 0.34% LONG · Gate фьючерсы · объём 24ч $24.1M»; VLM-проверки без дефектов
- Сервисы: market-service перезапущен (v3.4.0, 4 режима спредов), Next :3000 hot-reload, Caddy :81

Stage Summary:
- v3.4.0 готова: 11 вкладок, Обзор рынка с профессиональным canvas-графиком (рисовалки + линейка на колёсико + зум/панорама), арбитраж в 4 режимах, стрелка F&G исправлена, тикеры топов полностью видны. Админ: admin@screen.io / admin123. Сервисы: :3000, :3003 (v3.4.0), Caddy :81

---
Task ID: 17
Agent: main
Task: v3.4.1 — Обзор рынка: без мини-графика, биржи+рынок в правой колонке, таймфреймы сверху по центру, рисовалки слева, панорама во всех направлениях, линейка выкл. при отпускании колёсика, магнит на Ctrl

Work Log:
- market.tsx — мини-график 1м удалён полностью (state, effect, перерендер каждые 20с, CandleChart-инстанс); правая колонка = одна панель
- Биржи BINANCE/BYBIT/OKX + рынок ФЬЮЧЕРСЫ/СПОТ перенесены из верхней панели в правую колонку — вместо заголовка «Монеты» (grid-cols-3 биржи с цветными активными подсветками + grid-cols-2 F/S с градиентами); верхняя панель = тикер + цена + чипы + LIVE
- Таймфреймы (1м…1Н + обновление) — плавающая полоса в центре верхней линии графика (absolute left-1/2 top-2, z-20, card-solid + shadow)
- Рисовалки (курсор/тренд/гориз/верт/прямоугольник/фибо/линейка + корзина) — вертикальная панель слева по центру графика; под неё у канваса новый отступ padLeft=46
- Подсказка «колесо — зум · клик по колёсику — линейка · правый клик — удалить рисунок · двойной клик — сброс вида» удалена
- chart-canvas.tsx — рефакторинг шкалы в computeScale() (единая точка правды: offset, pRange, livePrice, координатные преобразования xOfT/yOfP/pOfY/tOfX) — redraw/hitTest/onMouseDown/onMouseMove/onWheelNative используют только её (убраны дубли расчётов с hardcoded padT=10)
- Панорама во всех направлениях: ViewBox.pRange {min,max} — вертикальный драг (порог 3px) фиксирует диапазон цен, диапазон следует за курсором (контент под рукой); авто-диапазон возвращается по dblclick/смене chartKey; линия+чип последней цены при выходе из вида прилипают к краю с clamp
- Линейка на колёсико стала транзитной: живёт пока средняя кнопка зажата, window.mouseup (в любой точке окна) выключает её; onLeave больше не фиксирует линейку; линейка из тулбара — прежний click-click
- Магнит на Ctrl: magnetRef через keydown/keyup/blur; snapPoint() прилипает к OHLC (ближайшая свеча, ближайшая из o/h/l/c, t = времени свечи); применяется к якорям рисовалок, предпросмотрам и обеим точкам линейки; на канвасе рисуется кольцо привязки + чип «МАГНИТ» (акцентный цвет, верх-право)
- Легенда канваса: подпись «БИРЖА · F · BASE/QUOTE · ТФ» (жирная, авто-усечение при узком графике, скрывается при plotW<420) + строка OHLC ниже; deps redraw дополнены livePrice (поймано eslint-ом preserve-manual-memoization — был бы stale closure)
- Версия: v3.4.1 в сайдбаре
- E2E (Caddy :81, 1920×1080 и 1366×768): tsc src 0, eslint 0; вертикальный драг — шкала цен сместилась 2500-2360 → 2440-2330, свечи на местах; линейка колёсиком при удержании (-52.26 / -2.17% / 39 баров) и исчезла после отпускания; чип «МАГНИТ» виден; тренд с Ctrl — обе точки snap точно к l свечей (2443.7 = l, 2463.23 = l, t = t свечи — проверено по API); dblclick — вид сброшен, рисунок остался; 1ч ТФ, BYBIT→BTC автоварьировка, СПОТ S, зум колесом; Главная/Плотности/Обзор — без ошибок консоли; 1366px — без наложений (подпись графика авто-усекается)

Stage Summary:
- v3.4.1: Обзор рынка переработан под терминальный стиль — чистая верхняя панель, биржи+рынок у списка монет, TF по центру сверху, рисовалки слева; график панорамируется во всех направлениях, линейка колёсика транзитна, магнит Ctrl прилипает к OHLC. Админ: admin@screen.io / admin123. Сервисы: :3000, :3003, Caddy :81
---
Task ID: 18
Agent: main
Task: v3.5.0 — чистый Обзор рынка (без верхней панели), линейка с большим %, улучшения графика, редизайн входа, автономность (watchdog), production-сборка и деплой-готовность

Work Log:
- Обзор рынка: верхняя панель удалена полностью (SymbolPicker с тикером, цена, чипы 1м/5м/24ч, объём, бейдж «по свечам»/LIVE) — график-карточка начинается сразу под шапкой (проверено DOM-ом: 0 элементов над графиком, chart.top=88); выбор тикера — через правую колонку (поиск/список), компоненты SymbolPicker/ChangeChip удалены; контейнер стал flex-row на всю высоту
- Легенда перенесена на канвас: «BINANCE · F · ETH/USDT · 15м» + живая цена (13px, цвет по 24ч) + «% 24ч»; OHLC-строка при ховере осталась; при узком графике авто-усечение
- Линейка: большой % шрифтом 21px (главная цифра), ниже Δцены (11px) и «N бар. · длительность»; диагональная пунктирная линия между точками + якорные точки; VLM-проверка: «-0.73% крупным шрифтом, -17.852, 22 Бар · 6ч» ✓
- Улучшения графика (chart-canvas.tsx): водяной знак тикера по центру (alpha 0.055); метки hi/lo видимого диапазона (чипы с ценой над максимумом/под минимумом); градиентные объёмы (59→12 alpha); свечи четче (тело в пиксельной сетке, кап 21px); смена дня на шкале времени — яркая метка с датой (на 1d/1w — смена месяца); точка живой цены на последней свече с окантовкой; кроссхэйр-чипы в акцентном цвете; магнит рисует пунктирные направляющие к свече; чип hline не наезжает на чип последней цены (nudge ±16px); защита шкалы от переполнения; правое поле по умолчанию (offset -6)
- Страница входа полностью переработана (auth-view.tsx): сплит-скрин — слева брендовая панель (аврора, сетка, анимированный SVG-график BTC с 26 свечами, 3 USP-строки, лента бирж), справа форма (переключатель Вход/Регистрация, поля h-12 с иконками, глаз показа пароля, ошибка с shake-анимацией, демо-блок с автозаполнением admin@screen.io/admin123); логика API не тронута
- market-service: process.on uncaughtException/unhandledRejection (логируем, не падаем); зомби-детект (0 символов 15 мин после прогрева → exit 1 → watchdog поднимет); версии 3.5.0 (index.ts banner, hello, telemetry APP_VERSION); перезапуск без --hot (bun index.ts)
- Автономность: scripts/start-all.sh (идемпотентный старт market-service + next [prod standalone | dev] + caddy + watchdog, режим в scripts/logs/next-mode) и scripts/watchdog.sh (каждые 20с: health-check :3000/:3003, memory-guard next 2.6ГБ / market 1.5ГБ, ротация логов >40МБ→5МБ хвост, ежедневный свежий рестарт market-service 04:30, воскресенье 04:50 — next); pid-файл watchdog.pid
- Багфиксы: собственный баг скриптов — curl при refused печатает 000 + «|| echo 000» давало «000000» и проверки проваливались (исправлено в обоих скриптах); лендинг v2.4.1→v3.5.0, «70+ монет»→«400+»; сайдбар v3.5.0
- Деплой-готовность: next build (34с, 0 ошибок) → standalone; build-скрипт копирует .env в .next/standalone (DATABASE_URL абсолютный — работает); переход с next dev на NODE_ENV=production bun .next/standalone/server.js (:3000, Ready 149ms); DEPLOY.md (VPS-инструкция, systemd-вариант, чек-лист), .env.example
- E2E продакшен (Caddy :81): логин/сессия/Prisma в standalone ✓; все 10 вкладок — 0 ошибок страницы; Обзор рынка: 90 монет по WS, канвас, линейка колёсиком (большой %), зум, легенда; КРАШ-ТЕСТЫ автономности: kill market-service → watchdog поднял за 13с; kill next → watchdog поднял, next:200 восстановлен; VLM-проверки (логин, рынок, линейка, зум) — без дефектов
- Сервисы: :3000 standalone production, :3003 market-service v3.5.0 (bun, hardened), Caddy :81, watchdog pid 1634

Stage Summary:
- v3.5.0 готова и работает в production-режиме: чистый терминальный Обзор рынка, линейка с крупным %, улучшенный канвас, новый дизайн входа, самовосстанавливающаяся инфраструктура (watchdog + guards), сборка и DEPLOY.md для переноса. Админ: admin@screen.io / admin123. Сервисы: :3000 (prod), :3003 (v3.5.0), Caddy :81, watchdog активен

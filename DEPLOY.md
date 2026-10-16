# CryptoPulse — деплой и автономная работа

## Состав системы

| Компонент | Порт | Что делает |
|---|---|---|
| Next.js (web) | 3000 | UI, API, авторизация, БД (Prisma/SQLite) |
| market-service | 3003 | socket.io, стримы 8 бирж, стены/движения/спреды/новости |
| Caddy | 81 | reverse-proxy (внешний вход) |
| watchdog | — | следит, чтобы всё работало неделями |

## Быстрый деплой (VPS / VM)

```bash
# 1. Зависимости: Node 20+/Bun, Caddy
curl -fsSL https://bun.sh/install | bash

# 2. Проект
git clone <repo> cryptopulse && cd cryptopulse
bun install
cd mini-services/market-service && bun install && cd ../../

# 3. Конфиг
cp .env.example .env    # и прописать SESSION_SECRET=$(openssl rand -hex 32)

# 4. База (SQLite) + админ
bun run db:push
bun run scripts/seed.ts   # admin@screen.io / admin123 (смените пароль!)

# 5. Production-сборка Next
bun run build             # .next/standalone + static + public

# 6. Запуск всего (market-service + next standalone + caddy + watchdog)
scripts/start-all.sh --prod
```

Сайт доступен на `:81` (Caddy → :3000), socket.io проходит через тот же вход
(`/?XTransformPort=3003`).

## Автономность (недели без присмотра)

`scripts/watchdog.sh` (поднимается автоматически) каждые 20 секунд:

- **health-check** `:3000` и `:3003` — упало → перезапускает (режим Next
  читает из `scripts/logs/next-mode`: `prod` / `dev`);
- **memory-guard** — next RSS > 2.6 ГБ или market-service RSS > 1.5 ГБ →
  мягкий перезапуск;
- **ротация логов** — `dev.log`, `server.log`, `service.log`, `watchdog.log`
  больше 40 МБ → остаётся хвост 5 МБ;
- **ночные свежие рестарты** — market-service каждый день в 04:30,
  next по воскресеньям в 04:50 (сброс дрейфа состояния);
- **зомби-детект в market-service** — нет символов 15 минут → процесс сам
  выходит (код 1), watchdog поднимает его заново;
- `uncaughtException` / `unhandledRejection` в market-service логируются,
  но не роняют процесс.

Клиент: socket.io `reconnection: Infinity` + кэш свечей и фолбэки в
`/api/klines` — переживает рестарты сервисов без белых экранов.

## Обновление версии

```bash
git pull
bun install
bun run build
pkill -f 'standalone/server\.js'; pkill -f next-server
scripts/start-all.sh --prod
```

## Systemd-вариант (по желанию, вместо watchdog)

```ini
# /etc/systemd/system/cryptopulse-watchdog.service
[Unit]
Description=CryptoPulse watchdog
After=network.target

[Service]
WorkingDirectory=/opt/cryptopulse
ExecStart=/bin/bash scripts/watchdog.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Чек-лист перед продакшеном

- [ ] `.env`: `SESSION_SECRET` сгенерирован
- [ ] Пароль админа сменён (демо: `admin@screen.io / admin123`)
- [ ] `bun run build` прошёл без ошибок
- [ ] `scripts/start-all.sh --prod` — все «OK» в выводе
- [ ] `scripts/logs/watchdog.log` пишет health-строки
- [ ] Открыт только :81 (3000/3003 — только localhost)

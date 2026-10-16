# CryptoPulse — деплой на VPS

## Состав системы

| Компонент | Порт | Что делает |
|---|---|---|
| Next.js (web) | 3000 | UI, API, авторизация, БД (Prisma/SQLite) |
| market-service | 3003 | socket.io, стримы 8 бирж, стены/движения/спреды/новости |
| Caddy | 80/443 | reverse-proxy, авто-HTTPS (Let's Encrypt) |
| systemd + watchdog | — | автозапуск при загрузке, health-check каждые 20с |

## Требования к VPS

- Ubuntu 22.04+ / Debian 12+ (работает и на других systemd-дистрибутивах)
- **1 vCPU / 2 ГБ RAM** минимум (рекомендуется 2 vCPU / 4 ГБ — при сборке Next
  занимает ~1.5 ГБ; на 1 ГБ RAM заранее добавьте swap:
  `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`)
- Открытые порты 80 и 443

## Установка — один скрипт

```bash
# 1. Забрать проект на VPS (любым способом)
git clone <ваш-репозиторий> cryptopulse && cd cryptopulse
#   …или: rsync -av --exclude node_modules --exclude .next ./ user@vps:/opt/cryptopulse

# 2. Запустить подготовку
sudo bash deploy/setup-vps.sh                 # вход по IP:  http://<IP>/
sudo bash deploy/setup-vps.sh example.com     # домен + автоматический HTTPS
```

Скрипт идемпотентен — повторный запуск ничего не сломает. Он ставит Bun и
Caddy системно, готовит `.env` (генерирует `SESSION_SECRET`), поднимает базу,
создаёт администратора, собирает production-сборку и регистрирует systemd-сервис.

**Учётные данные админа** печатаются в выводе `seed` (пароль генерируется
случайный, если не задан). Задать свои можно в `.env`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=свой-надёжный-пароль
```

## Что делает systemd + watchdog (автономность неделями)

`cryptopulse.service` запускается при загрузке VPS и следит за watchdog
(`Restart=always`). Watchdog каждые 20 секунд:

- **health-check** `:3000` и `:3003` — упало → перезапускает;
- **memory-guard** — Next RSS > 2.6 ГБ или market-service RSS > 1.5 ГБ → мягкий перезапуск;
- **ротация логов** — больше 40 МБ → остаётся хвост 5 МБ;
- **ночные свежие рестарты** — market-service ежедневно в 04:30, Next по воскресеньям в 04:50;
- **зомби-детект** в market-service — нет символов 15 минут → процесс сам
  выходит (код 1), watchdog поднимает заново;
- `uncaughtException` / `unhandledRejection` логируются, процесс не роняют.

Клиент переживает рестарты без белых экранов: socket.io `reconnection: Infinity`,
кэш свечей и фолбэки в `/api/klines`.

## Обновление версии на VPS

```bash
cd /opt/cryptopulse
git pull
bun install
( cd mini-services/market-service && bun install )
bun run build
sudo systemctl restart cryptopulse
```

## Управление

```bash
systemctl status cryptopulse      # статус
journalctl -u cryptopulse -f      # живой лог watchdog'а
sudo systemctl restart cryptopulse
sudo systemctl stop cryptopulse

# технические логи сервисов:
tail -f server.log                                  # Next
tail -f mini-services/market-service/service.log    # market-service
```

## База данных

SQLite живёт в `db/custom.db` (путь — в `.env`, `DATABASE_URL`).
Резервная копия: `sqlite3 db/custom.db ".backup backup-$(date +%F).db"`.
Перенос на новый сервер: скопировать файл + `.env`.

## Чек-лист перед продакшеном

- [ ] `.env`: `SESSION_SECRET` сгенерирован (setup-vps.sh делает это сам)
- [ ] Пароль админа сменён/задан свой (`ADMIN_PASSWORD` в `.env`)
- [ ] Домен указывает на IP VPS, HTTPS выпустится (замок в браузере)
- [ ] `systemctl is-enabled cryptopulse` → `enabled`
- [ ] Открывается `http://<домен>/`, логин работает, вкладки живые
- [ ] Порты 3000/3003 закрыты снаружи (доступ только через Caddy)

## Безопасность репозитория

`.env` и `db/custom.db` в `.gitignore` и не отслеживаются. Если репозиторий
раньше коммитился с этими файлами и будет публиковаться — либо начните
чистую историю (`rm -rf .git && git init && git add -A && git commit -m init`),
либо переносите проект на VPS через `rsync` (история не участвует):

```bash
rsync -av --exclude node_modules --exclude .next --exclude .git \
      --exclude 'scripts/logs' --exclude 'download' \
      ./ user@vps:/opt/cryptopulse
```

## Ручной вариант (без setup-скрипта)

```bash
# зависимости
curl -fsSL https://bun.sh/install | bash
# caddy — по инструкции: https://caddyserver.com/docs/install
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# проект
cp .env.example .env          # заполнить SESSION_SECRET и DATABASE_URL
bun install && ( cd mini-services/market-service && bun install )
bun run db:push               # схема БД
bun scripts/seed.ts           # админ (кредиты из .env / случайный пароль)
bun run build                 # standalone-сборка
sudo cp deploy/Caddyfile.production /etc/caddy/Caddyfile   # заменить домен!
sudo systemctl reload caddy

# запуск: либо systemd (рекомендуется)
sudo cp deploy/cryptopulse.service /etc/systemd/system/    # поправить WorkingDirectory!
sudo systemctl daemon-reload && sudo systemctl enable --now cryptopulse

# …либо без systemd (тогда watchdog запустится сам):
scripts/start-all.sh --prod
```

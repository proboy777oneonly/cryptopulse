#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# CryptoPulse — подготовка VPS одним скриптом (Ubuntu 22.04+ / Debian 12+)
#
# Что делает:
#   1. Системные пакеты: curl, git, sqlite3, openssl
#   2. Bun runtime (ставится системно в /usr/local/bin)
#   3. Caddy из официального репозитория (авто-HTTPS, обновляется с системой)
#   4. Зависимости проекта: bun install (корень + market-service)
#   5. .env: настоящий SESSION_SECRET + абсолютный DATABASE_URL
#   6. База: prisma db push + админ (scripts/seed.ts)
#   7. Production-сборка Next.js (standalone)
#   8. systemd-юнит cryptopulse: автостарт при загрузке, рестарт watchdog
#   9. Caddy: домен с HTTPS (если передан аргументом) или :80
#
# Использование (из корня проекта на VPS):
#   sudo bash deploy/setup-vps.sh                  # вход по IP, Caddy на :80
#   sudo bash deploy/setup-vps.sh example.com      # домен + Let's Encrypt
#
# Повторный запуск безопасен (идемпотентен).
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

BASE="$(cd "$(dirname "${0}")/.." && pwd)"
DOMAIN="${1:-}"
[ "$(id -u)" = "0" ] || { echo "✗ запустите от root: sudo bash deploy/setup-vps.sh [домен]"; exit 1; }

info()  { echo -e "\033[1;36m[1/9]\033[0m $*"; }
step()  { echo -e "\n\033[1;36m▸ $*\033[0m"; }
ok()    { echo -e "  \033[1;32m✓\033[0m $*"; }
fail()  { echo -e "  \033[1;31m✗ $*\033[0m"; exit 1; }

echo "══════════════════════════════════════════════════════════"
echo "  CryptoPulse — подготовка VPS"
echo "  проект: $BASE"
echo "  домен:  ${DOMAIN:-не задан (вход по IP, :80)}"
echo "══════════════════════════════════════════════════════════"

# ── 1. Системные пакеты ──────────────────────────────────────────────
step "Системные пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git sqlite3 openssl ca-certificates >/dev/null
ok "curl, git, sqlite3, openssl"

# ── 2. Bun (системно) ────────────────────────────────────────────────
step "Bun runtime"
if command -v bun >/dev/null 2>&1; then
  ok "уже установлен: $(bun --version)"
else
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1
  # делаем доступным всем пользователям и systemd
  BUN_BIN="$HOME/.bun/bin/bun"
  [ -f "$BUN_BIN" ] || BUN_BIN="/root/.bun/bin/bun"
  [ -f "$BUN_BIN" ] || BUN_BIN="$(find /home -maxdepth 4 -path '*/.bun/bin/bun' 2>/dev/null | head -1)"
  [ -n "${BUN_BIN:-}" ] && [ -f "$BUN_BIN" ] || fail "bun установился, но бинарник не найден"
  ln -sf "$(readlink -f "$BUN_BIN")" /usr/local/bin/bun
  ok "установлен: $(bun --version) → /usr/local/bin/bun"
fi

# ── 3. Caddy ─────────────────────────────────────────────────────────
step "Caddy (reverse-proxy)"
if command -v caddy >/dev/null 2>&1; then
  ok "уже установлен: $(caddy version 2>/dev/null | cut -d' ' -f1)"
else
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null 2>&1 || true
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key'   | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
  ok "установлен: $(caddy version 2>/dev/null | cut -d' ' -f1)"
fi

# ── 4. Зависимости проекта ───────────────────────────────────────────
step "Зависимости (bun install)"
cd "$BASE"
bun install --silent >/dev/null 2>&1 || bun install
ok "корень проекта"
( cd mini-services/market-service && bun install --silent >/dev/null 2>&1 || bun install )
ok "market-service"

# ── 5. Конфигурация .env ─────────────────────────────────────────────
step "Конфигурация (.env)"
if [ ! -f "$BASE/.env" ]; then
  SECRET="$(openssl rand -hex 32)"
  {
    echo "DATABASE_URL=file:$BASE/db/custom.db"
    echo "SESSION_SECRET=$SECRET"
    echo ""
    echo "# Админ для scripts/seed.ts (пароль можно задать свой):"
    echo "#ADMIN_EMAIL=admin@example.com"
    echo "#ADMIN_PASSWORD="
  } > "$BASE/.env"
  chmod 600 "$BASE/.env"
  ok ".env создан (SESSION_SECRET сгенерирован, права 600)"
else
  ok ".env уже существует — не трогаем"
fi

# ── 6. База + админ ──────────────────────────────────────────────────
step "База данных (SQLite + Prisma)"
mkdir -p "$BASE/db"
set -a; . "$BASE/.env"; set +a
bunx --bun prisma db push --accept-data-loss --schema="$BASE/prisma/schema.prisma" >/dev/null
ok "схема применена (db/custom.db)"
bun "$BASE/scripts/seed.ts"
ok "админ-аккаунт готов"

# ── 7. Production-сборка ─────────────────────────────────────────────
step "Production-сборка Next.js"
bunx --bun prisma generate --schema="$BASE/prisma/schema.prisma" >/dev/null
bun run build
ok "standalone-сборка готова (.next/standalone)"

# ── 8. systemd: автозапуск и надёжность ──────────────────────────────
step "systemd-сервис cryptopulse"
# останавливаем старый watchdog, если запускался вручную
if [ -f "$BASE/scripts/logs/watchdog.pid" ]; then
  OLD_WD="$(cat "$BASE/scripts/logs/watchdog.pid" 2>/dev/null || true)"
  [ -n "$OLD_WD" ] && kill "$OLD_WD" 2>/dev/null || true
fi
sed "s|WorkingDirectory=/opt/cryptopulse|WorkingDirectory=$BASE|" \
  "$BASE/deploy/cryptopulse.service" > /etc/systemd/system/cryptopulse.service
systemctl daemon-reload
systemctl enable cryptopulse >/dev/null 2>&1
systemctl restart cryptopulse
sleep 6
systemctl is-active --quiet cryptopulse && ok "cryptopulse запущен и добавлен в автозагрузку" \
  || fail "systemd-юнит не поднялся — см. journalctl -u cryptopulse -n 50"

# ── 9. Caddy-сайт ────────────────────────────────────────────────────
step "Caddy: сайт и HTTPS"
if [ -n "$DOMAIN" ]; then
  sed "s|crypto.example.com|$DOMAIN|g" "$BASE/deploy/Caddyfile.production" > /etc/caddy/Caddyfile
  ok "домен $DOMAIN (HTTPS выпустится автоматически при первом обращении)"
else
  sed 's|^crypto\.example\.com |:80 |' "$BASE/deploy/Caddyfile.production" > /etc/caddy/Caddyfile
  ok "вход по IP на :80"
fi
systemctl reload caddy 2>/dev/null || systemctl restart caddy
ok "caddy перезагружен"

# firewall (если ufw активен — открываем веб-порты)
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "ufw: открыты 80/443"
fi

# ─── Итог ────────────────────────────────────────────────────────────
IP="$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Готово! Сервисы:"
echo "     • веб:        http://${DOMAIN:-$IP}/"
echo "     • systemd:    systemctl status cryptopulse"
echo "     • логи:       journalctl -u cryptopulse -f"
echo "     • обновление: git pull && bun install && bun run build &&"
echo "                   sudo systemctl restart cryptopulse"
echo ""
echo "  ℹ️  Вход администратора — см. вывод seed выше (email/пароль)."
echo "     Пароль админа можно задать в .env (ADMIN_EMAIL/ADMIN_PASSWORD)"
echo "     и перезапустить: bun scripts/seed.ts (создаёт только нового)."
echo "══════════════════════════════════════════════════════════"

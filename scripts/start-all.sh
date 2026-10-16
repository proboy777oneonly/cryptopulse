#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# CryptoPulse — идемпотентный запуск всех сервисов.
# Повторный запуск безопасен: работающее не трогает.
#
# Использование:
#   scripts/start-all.sh          # dev-режим Next (next dev)
#   scripts/start-all.sh --prod                # production-режим Next (standalone server)
#   scripts/start-all.sh --prod --no-watchdog  # без watchdog (им управляет systemd)
# ════════════════════════════════════════════════════════════════════

set -u
BASE="$(cd "$(dirname "${0}")/.." && pwd)"
LOGS="$BASE/scripts/logs"
mkdir -p "$LOGS"

PROD=0
NO_WATCHDOG=0
for arg in "${@:-}"; do
  [ "$arg" = "--prod" ] && PROD=1
  [ "$arg" = "--no-watchdog" ] && NO_WATCHDOG=1
done
echo "$([ "$PROD" = 1 ] && echo prod || echo dev)" > "$LOGS/next-mode"

log() { echo "[start-all $(date '+%F %T')] $*"; }

http_code() {
  # при отказе соединения curl сам печатает 000 и завершается с ошибкой —
  # дополнительно echo не нужно (иначе «000000» не совпадает с проверкой)
  curl -s -o /dev/null -w '%{http_code}' --max-time 6 "http://127.0.0.1:$1$2" 2>/dev/null
  return 0
}

market_alive() {
  curl -s --max-time 6 'http://127.0.0.1:3003/?EIO=4&transport=polling' 2>/dev/null | head -c 64 | grep -q '0{'
}

start_market() {
  bash -c "( cd '$BASE/mini-services/market-service' && setsid bun index.ts >> service.log 2>&1 < /dev/null & )"
}

# ── market-service (:3003) ──────────────────────────────────────────
if market_alive; then
  log "market-service: уже работает (:3003)"
else
  log "market-service: запуск…"
  start_market
  for _ in $(seq 1 30); do sleep 1; market_alive && break; done
  market_alive && log "market-service: OK (:3003)" || log "market-service: НЕ ОТВЕЧАЕТ (см. mini-services/market-service/service.log)"
fi

# ── Next.js (:3000) ─────────────────────────────────────────────────
NEXT_CODE=$(http_code 3000 /api/auth/me)
if [ "$NEXT_CODE" != "000" ]; then
  log "next: уже работает (:3000, код $NEXT_CODE)"
elif [ "$PROD" = "1" ]; then
  if [ ! -f "$BASE/.next/standalone/server.js" ]; then
    log "next: НЕТ production-сборки (.next/standalone/server.js) — сначала: bun run build"
  else
    log "next: запуск standalone (production)…"
    bash -c "( cd '$BASE' && NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NODE_OPTIONS=--max-old-space-size=1400 setsid bun .next/standalone/server.js >> server.log 2>&1 < /dev/null & )"
    for _ in $(seq 1 40); do
      sleep 1
      NEXT_CODE=$(http_code 3000 /api/auth/me)
      [ "$NEXT_CODE" != "000" ] && break
    done
    log "next: код $NEXT_CODE"
  fi
else
  log "next: запуск dev…"
  bash -c "( cd '$BASE' && NODE_OPTIONS=--max-old-space-size=1200 setsid ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & )"
  for _ in $(seq 1 90); do
    sleep 1
    NEXT_CODE=$(http_code 3000 /api/auth/me)
    [ "$NEXT_CODE" != "000" ] && break
  done
  log "next: код $NEXT_CODE"
fi

# ── Caddy (:81) ─────────────────────────────────────────────────────
CADDY_CODE=$(http_code 81 /)
if [ "$CADDY_CODE" = "000" ]; then
  log "caddy: не отвечает (:81) — пробуем запустить"
  caddy start --config "$BASE/Caddyfile" --adapter caddyfile >> "$LOGS/caddy.log" 2>&1 \
    || log "caddy: запуск не удался (нужны root-права? см. $LOGS/caddy.log)"
else
  log "caddy: работает (:81, код $CADDY_CODE)"
fi

# ── watchdog ────────────────────────────────────────────────────────
if [ "$NO_WATCHDOG" = "1" ]; then
  log "watchdog: пропущен (--no-watchdog — им управляет systemd)"
  log "──────── готово ────────"
  exit 0
fi
WD_PID=""
[ -f "$LOGS/watchdog.pid" ] && WD_PID=$(cat "$LOGS/watchdog.pid" 2>/dev/null || echo "")
if [ -n "$WD_PID" ] && kill -0 "$WD_PID" 2>/dev/null; then
  log "watchdog: уже работает (pid $WD_PID)"
else
  log "watchdog: запуск…"
  bash -c "( setsid bash '$BASE/scripts/watchdog.sh' >> '$LOGS/watchdog.log' 2>&1 < /dev/null & )"
  sleep 1
  WD_PID=$(cat "$LOGS/watchdog.pid" 2>/dev/null || echo "")
  [ -n "$WD_PID" ] && kill -0 "$WD_PID" 2>/dev/null \
    && log "watchdog: OK (pid $WD_PID)" \
    || log "watchdog: НЕ ЗАПУСТИЛСЯ (см. $LOGS/watchdog.log)"
fi

log "──────── готово ────────"

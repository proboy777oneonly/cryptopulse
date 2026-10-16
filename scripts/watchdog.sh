#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# CryptoPulse watchdog — автономная работа неделями без присмотра.
#
#   • health-check Next (:3000) и market-service (:3003) каждые 20с
#     → рестарт при падении (режим next берёт из scripts/logs/next-mode)
#   • memory-guard: next RSS > 2.6ГБ / market-service RSS > 1.5ГБ → рестарт
#   • ротация логов: > 40МБ → оставляем хвост 5МБ
#   • ежедневный свежий рестарт market-service в 04:30 (очистка дрейфа)
#   • воскресенье 04:50 — свежий рестарт Next
#
# Запускается через scripts/start-all.sh. Лог: scripts/logs/watchdog.log
# ════════════════════════════════════════════════════════════════════

BASE="$(cd "$(dirname "${0}")/.." && pwd)"
LOGS="$BASE/scripts/logs"
STATE="$LOGS/watchdog.state"
mkdir -p "$LOGS"
echo $$ > "$LOGS/watchdog.pid"

log() { echo "[$(date '+%F %T')] $*"; }
log "watchdog запущен (pid $$)"

market_alive() {
  curl -s --max-time 8 'http://127.0.0.1:3003/?EIO=4&transport=polling' 2>/dev/null | head -c 64 | grep -q '0{'
}

start_market() {
  bash -c "( cd '$BASE/mini-services/market-service' && setsid bun index.ts >> service.log 2>&1 < /dev/null & )"
}

restart_market() {
  log "перезапуск market-service…"
  pkill -f 'bun.*index\.ts' 2>/dev/null
  sleep 2
  start_market
}

start_next() {
  local MODE
  MODE=$(cat "$LOGS/next-mode" 2>/dev/null || echo prod)
  if [ "$MODE" = "prod" ] && [ -f "$BASE/.next/standalone/server.js" ]; then
    bash -c "( cd '$BASE' && NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NODE_OPTIONS=--max-old-space-size=1400 setsid bun .next/standalone/server.js >> server.log 2>&1 < /dev/null & )"
  else
    bash -c "( cd '$BASE' && NODE_OPTIONS=--max-old-space-size=1200 setsid ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & )"
  fi
}

restart_next() {
  log "перезапуск next…"
  pkill -f 'next dev' 2>/dev/null
  pkill -f 'next-server' 2>/dev/null
  pkill -f 'standalone/server\.js' 2>/dev/null
  sleep 3
  start_next
}

rss_kb() {
  # RSS процесса в килобайтах (первый подходящий pid)
  local PID
  PID=$(pgrep -f "$1" | head -1)
  [ -n "$PID" ] || { echo 0; return; }
  ps -o rss= -p "$PID" 2>/dev/null | tr -d ' ' || echo 0
}

while true; do
  # ── 1. health-check market-service ────────────────────────────────
  if ! market_alive; then
    log "market-service НЕ отвечает — рестарт"
    restart_market
  fi

  # ── 2. health-check Next ──────────────────────────────────────────
  # (curl при отказе сам печатает 000 — без «|| echo», иначе «000000»)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 'http://127.0.0.1:3000/api/auth/me' 2>/dev/null)
  if [ "$CODE" = "000" ] || [ "$CODE" = "" ]; then
    log "next НЕ отвечает (код $CODE) — рестарт"
    restart_next
  fi

  # ── 3. memory-guard ───────────────────────────────────────────────
  NRSS=$(rss_kb 'next-server|standalone/server\.js')
  if [ "$NRSS" -gt 2600000 ] 2>/dev/null; then
    log "next RSS ${NRSS}kB > 2.6ГБ — рестарт по памяти"
    restart_next
  fi
  MRSS=$(rss_kb 'bun.*index\.ts')
  if [ "$MRSS" -gt 1500000 ] 2>/dev/null; then
    log "market-service RSS ${MRSS}kB > 1.5ГБ — рестарт по памяти"
    restart_market
  fi

  # ── 4. ротация логов ──────────────────────────────────────────────
  for f in "$BASE/dev.log" "$BASE/server.log" "$BASE/mini-services/market-service/service.log" "$LOGS/watchdog.log"; do
    if [ -f "$f" ]; then
      SZ=$(stat -c%s "$f" 2>/dev/null || echo 0)
      if [ "$SZ" -gt 41943040 ]; then
        log "ротация $f (${SZ} байт → хвост 5МБ)"
        tail -c 5242880 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
      fi
    fi
  done

  # ── 5. плановые свежие рестарты (ночь, минимум нагрузки) ──────────
  HM=$(date +%H%M)
  TODAY=$(date +%F)
  if [ "$HM" -ge "0430" ] && [ "$HM" -lt "0450" ]; then
    LAST=$(grep 'market-fresh' "$STATE" 2>/dev/null | tail -1 | cut -d' ' -f2)
    if [ "$LAST" != "$TODAY" ]; then
      log "ежедневный свежий рестарт market-service ($TODAY)"
      restart_market
      echo "market-fresh $TODAY" >> "$STATE"
    fi
  fi
  if [ "$(date +%u)" = "7" ] && [ "$HM" -ge "0450" ] && [ "$HM" -lt "0510" ]; then
    LAST=$(grep 'next-fresh' "$STATE" 2>/dev/null | tail -1 | cut -d' ' -f2)
    if [ "$LAST" != "$TODAY" ]; then
      log "еженедельный свежий рестарт next ($TODAY)"
      restart_next
      echo "next-fresh $TODAY" >> "$STATE"
    fi
  fi

  sleep 20
done

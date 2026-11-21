#!/usr/bin/env bash
# DODA API bloki Caddyfile'da borligini ta'minlaydi. Boshqa loyiha Caddyfile'ni qayta yozib blokni o'chirsa, o'zi qaytaradi.
# Jim ishlaydi: blok bor bo'lsa hech narsa qilmaydi. Cron bilan har 5 daqiqada: ./ensure-caddy.sh >> /var/log/doda-caddy.log 2>&1
set -euo pipefail

CADDYFILE="${CADDYFILE:-/opt/tajriba24/deploy/vps/Caddyfile}"
CADDY_CONTAINER="${CADDY_CONTAINER:-vps-web-1}"
CONF_IN="${CONF_IN:-/etc/caddy/Caddyfile}"
API_DOMAIN="${API_DOMAIN:-doda-api.tajriba24.uz}"
SVC="${SVC:-doda-server}"
ts() { date '+%F %T'; }

[[ -f "$CADDYFILE" ]] || { echo "$(ts) XATO: $CADDYFILE yo'q"; exit 1; }
# Blok bor (izohda emas, haqiqiy qatorda): hech narsa qilmaymiz
if grep -Eq "^[[:space:]]*${API_DOMAIN//./\\.}[[:space:]]*\{" "$CADDYFILE"; then exit 0; fi

echo "$(ts) DODA bloki Caddyfile'da topilmadi: qaytarilmoqda"
BAK="$CADDYFILE.bak-doda-$(date +%Y%m%d%H%M%S)"
cp -p "$CADDYFILE" "$BAK"
printf '\n# DODA API (ensure-caddy.sh)\n%s {\n    reverse_proxy %s:8787\n}\n' "$API_DOMAIN" "$SVC" >> "$CADDYFILE"   # '>>' fayl identifikatorini saqlaydi (bind-mount)
restore() { cat "$BAK" > "$CADDYFILE"; echo "$(ts) Caddyfile eski holatga qaytarildi"; }
if ! docker exec "$CADDY_CONTAINER" caddy validate --config "$CONF_IN" --adapter caddyfile >/dev/null 2>&1; then restore; echo "$(ts) XATO: yaroqsiz konfiguratsiya, hech narsa o'zgarmadi"; exit 1; fi
if ! docker exec "$CADDY_CONTAINER" caddy reload --config "$CONF_IN" --adapter caddyfile >/dev/null 2>&1; then
  restore; docker exec "$CADDY_CONTAINER" caddy reload --config "$CONF_IN" --adapter caddyfile >/dev/null 2>&1 || true
  echo "$(ts) XATO: Caddy qayta yuklanmadi, eski holat tiklandi"; exit 1
fi
echo "$(ts) [ok] DODA bloki qaytarildi, Caddy yangilandi"
# Eski zaxira nusxalarni (7 tadan ortig'ini) tozalaymiz
ls -1t "$CADDYFILE".bak-doda-* 2>/dev/null | tail -n +8 | xargs -r rm -f

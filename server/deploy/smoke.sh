#!/usr/bin/env bash
# DODA: deploydan keyingi tez tekshiruv. Ishlatish: bash smoke.sh [API_URL] [ORIGIN]
API="${1:-https://doda-api.tajriba24.uz}"
ORIGIN="${2:-https://doda.tajriba24.uz}"
HERE="$(cd "$(dirname "$0")" && pwd)"
bad=0
ok() { echo "  OK   $1"; }
no() { echo "  XATO $1"; bad=1; }

echo "DODA smoke: $API"
h=$(curl -fsS --max-time 10 "$API/api/health" 2>/dev/null) && ok "health: $h" || no "health javob bermadi"
case "$h" in *'"schema":'*) ok "sxema versiyasi ko'rinadi";; *) no "sxema versiyasi yo'q (eski server?)";; esac

pf=$(curl -sS --max-time 10 -i -X OPTIONS "$API/api/todos/1" -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: PATCH" 2>/dev/null)
echo "$pf" | grep -qi "access-control-allow-origin: $ORIGIN" && ok "CORS origin" || no "CORS origin"
echo "$pf" | grep -i "access-control-allow-methods" | grep -q "PATCH" && ok "CORS PATCH" || no "CORS PATCH"

hd=$(curl -sS --max-time 10 -I "$API/api/health" 2>/dev/null)
for x in x-content-type-options strict-transport-security; do
  echo "$hd" | grep -qi "^$x" && ok "sarlavha $x" || no "sarlavha $x yo'q"
done

c=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$API/api/account/export" 2>/dev/null)
[ "$c" = "401" ] && ok "eksport kirishsiz yopiq (401)" || no "eksport kutilmagan javob: $c"

ENVF="$HERE/../.env"
if [ -f "$ENVF" ]; then
  n=$(grep -E '^KEYS_SECRET=' "$ENVF" | cut -d= -f2- | tr -d '"' | wc -c)
  [ "$n" -gt 32 ] && ok "KEYS_SECRET bor (zaxiraga nusxa oling)" || no "KEYS_SECRET yo'q yoki qisqa"
else
  echo "  --   .env topilmadi ($ENVF): KEYS_SECRET tekshirilmadi"
fi

cn=$(docker ps -qf name=doda 2>/dev/null | head -1)
if [ -n "$cn" ]; then
  docker exec "$cn" sh -c 'ls /app/data/backups 2>/dev/null | grep -c "^doda-"' 2>/dev/null | grep -qv '^0$' && ok "zaxira nusxa bor" || no "zaxira nusxa yo'q"
else
  echo "  --   konteyner topilmadi: zaxira tekshirilmadi"
fi

[ $bad = 0 ] && echo "HAMMASI JOYIDA" || echo "MUAMMO BOR (yuqoriga qarang)"
exit $bad

#!/usr/bin/env bash
# AI provayder kalitini xavfsiz qo'shish/almashtirish/o'chirish. Kalit ekranga chiqmaydi va tarixga tushmaydi.
#   bash set-key.sh anthropic     Claude kalitini kiritish (yoqiladi)
#   bash set-key.sh openai        OpenAI kalitini kiritish (yoqiladi)
#   bash set-key.sh gemini        Gemini kalitini kiritish (yoqiladi)
#   bash set-key.sh off openai    OpenAI ni o'chirish (kalit o'chiriladi; qayta kiritsangiz yoqiladi)
# Kalit bo'lmagan provayder o'zi o'chiq turadi; DODA ishlayotganini avtomatik tanlaydi.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../.env}"
RESTART="${DODA_RESTART:-1}"

die() { echo "XATO: $*" >&2; exit 1; }

action="set"
prov="${1:-}"
if [[ "$prov" == "off" ]]; then action="off"; prov="${2:-}"; fi
case "$prov" in
  anthropic) VAR=ANTHROPIC_API_KEY; HINT="sk-ant-..."; URL="https://console.anthropic.com/settings/keys" ;;
  openai)    VAR=OPENAI_API_KEY;    HINT="sk-...";     URL="https://platform.openai.com/api-keys" ;;
  gemini)    VAR=GEMINI_API_KEY;    HINT="AIza...";    URL="https://aistudio.google.com/apikey" ;;
  *) die "Ishlatilishi: bash set-key.sh anthropic|openai|gemini   yoki   bash set-key.sh off anthropic|openai|gemini" ;;
esac
[[ -f "$ENV_FILE" ]] || die ".env topilmadi: $ENV_FILE (avval install.sh ni ishga tushiring)"

# .env dagi eski qatorni olib tashlaymiz (boshqa qatorlarga tegmaymiz)
strip() { local tmp; tmp="$(mktemp)"; grep -v "^${VAR}=" "$ENV_FILE" > "$tmp" || true; cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"; }

if [[ "$action" == "off" ]]; then
  strip
  echo "[ok] $VAR o'chirildi: $prov endi o'chiq."
else
  echo "Kalitni $URL dan oling (${HINT})."
  read -r -s -p "Kalitni qo'ying va Enter bosing (ekranda ko'rinmaydi): " KEY; echo
  KEY="$(printf '%s' "$KEY" | tr -d ' \t\r\n' | tr -d '"' | tr -d "'")"
  [[ -n "$KEY" ]] || die "Kalit bo'sh."
  case "$prov" in
    anthropic) [[ "$KEY" == sk-ant-* ]] || die "Claude kaliti 'sk-ant-' bilan boshlanadi." ;;
    openai)    [[ "$KEY" == sk-* ]]     || die "OpenAI kaliti 'sk-' bilan boshlanadi." ;;
    gemini)    [[ "$KEY" == AIza* ]]    || die "Gemini kaliti 'AIza' bilan boshlanadi." ;;
  esac
  (( ${#KEY} >= 30 )) || die "Kalit juda qisqa (${#KEY} belgi). To'liq nusxa oling."
  strip
  printf '%s=%s\n' "$VAR" "$KEY" >> "$ENV_FILE"
  echo "[ok] $VAR saqlandi (${#KEY} belgi): $prov yoqildi."
fi
chmod 600 "$ENV_FILE" 2>/dev/null || true

if [[ "$RESTART" == "1" ]]; then
  cd "$HERE"
  echo "Server qayta ishga tushirilmoqda (ma'lumotlar saqlanadi)..."
  # Tarmoq nomi: doda-server hozir ulangan Caddy tarmog'i (bridge emas)
  NET="${CADDY_NETWORK:-$(docker inspect doda-server --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null | grep -v -e '^bridge$' -e '^$' | head -n1)}"
  [[ -n "$NET" ]] || die "Caddy tarmog'i topilmadi. install.sh ni qayta ishga tushiring."
  CADDY_NETWORK="$NET" \
    docker compose up -d --force-recreate
  for _ in $(seq 1 40); do
    st="$(docker inspect -f '{{.State.Health.Status}}' doda-server 2>/dev/null || true)"
    [[ "$st" == "healthy" ]] && break
    sleep 2
  done
  echo "Holat: ${st:-nomalum}"
  docker exec doda-server node dist/diagnose.js 2>&1 | sed 's/^/  /' || true
fi

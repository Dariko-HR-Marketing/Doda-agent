#!/usr/bin/env bash
# DODA serverini VPS'ga joylash: bitta buyruq, bitta xavfsiz skript.
#   bash install.sh --dry-run   # hech narsani o'zgartirmaydi, faqat nima qilinishini ko'rsatadi
#   bash install.sh             # joylaydi
# Boshqa konteynerlarga TEGMAYDI. Caddyfile'ga faqat bitta blok qo'shadi (nusxa olib, tasdiq so'rab,
# xato bo'lsa avtomat qaytaradi).
set -euo pipefail

CADDY_CONTAINER="${CADDY_CONTAINER:-vps-web-1}"
API_DOMAIN="${API_DOMAIN:-doda-api.tajriba24.uz}"
APP_ORIGIN="${APP_ORIGIN:-https://doda.tajriba24.uz}"
SVC=doda-server
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$HERE")"
ENV_FILE="$SERVER_DIR/.env"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '  [ok] %s\n' "$*"; }
note() { printf '  [..] %s\n' "$*"; }
warn() { printf '  [!]  %s\n' "$*" >&2; }
die()  { printf '\n  [XATO] %s\n' "$*" >&2; exit 1; }
yn()   { local r; read -r -p "  $1 [y/N] " r || true; [[ "${r:-}" =~ ^[Yy]$ ]]; }
run()  { if ((DRY)); then note "(dry-run) $*"; else "$@"; fi; }

((DRY)) && warn "DRY-RUN: hech narsa o'zgartirilmaydi"

# ---------------------------------------------------------------- 1. Tekshiruv
say "1/7 Tekshiruv"
command -v docker >/dev/null || die "docker topilmadi"
docker compose version >/dev/null 2>&1 || die "'docker compose' topilmadi"
docker inspect "$CADDY_CONTAINER" >/dev/null 2>&1 || die "'$CADDY_CONTAINER' konteyneri topilmadi (CADDY_CONTAINER=nom bilan ko'rsating)"
ok "Docker va '$CADDY_CONTAINER' bor"
if command -v free >/dev/null; then free -m | sed -n '1,2p' | sed 's/^/       /'; fi
if docker ps -a --format '{{.Names}}' | grep -qx "$SVC"; then note "'$SVC' allaqachon bor: yangilanadi (ma'lumotlar saqlanadi)"; fi

# ---------------------------------------------------------------- 2. Tarmoq
say "2/7 Caddy tarmog'i"
NET="${CADDY_NETWORK:-}"
if [[ -z "$NET" ]]; then
  mapfile -t NETS < <(docker inspect "$CADDY_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | sed '/^$/d' | grep -Ev '^(bridge|host|none)$' || true)
  if ((${#NETS[@]} == 1)); then
    NET="${NETS[0]}"
  elif ((${#NETS[@]} > 1)); then
    printf '  Bir nechta tarmoq topildi:\n'; i=1; for n in "${NETS[@]}"; do printf '    %d) %s\n' "$i" "$n"; i=$((i+1)); done
    read -r -p "  Qaysi raqam? " pick
    [[ "$pick" =~ ^[0-9]+$ ]] && ((pick>=1 && pick<=${#NETS[@]})) || die "Noto'g'ri tanlov"
    NET="${NETS[$((pick-1))]}"
  else
    die "Caddy uchun maxsus tarmoq topilmadi. CADDY_NETWORK=<nom> bilan ko'rsating"
  fi
fi
ok "Tarmoq: $NET"

# ---------------------------------------------------------------- 3. Caddyfile
say "3/7 Caddyfile"
CADDYFILE=""; CONF_IN="/etc/caddy/Caddyfile"
while IFS='|' read -r dest src _typ; do
  [[ -z "${dest:-}" ]] && continue
  if [[ "$dest" == "/etc/caddy/Caddyfile" ]]; then CADDYFILE="$src"; CONF_IN="$dest"; break; fi
  if [[ "$dest" == "/etc/caddy" && -f "$src/Caddyfile" ]]; then CADDYFILE="$src/Caddyfile"; CONF_IN="/etc/caddy/Caddyfile"; break; fi
done < <(docker inspect "$CADDY_CONTAINER" --format '{{range .Mounts}}{{.Destination}}|{{.Source}}|{{.Type}}{{"\n"}}{{end}}')
if [[ -z "$CADDYFILE" ]]; then
  read -r -p "  Caddyfile avtomat topilmadi. VPS'dagi to'liq yo'lini kiriting: " CADDYFILE
fi
[[ -f "$CADDYFILE" && -w "$CADDYFILE" ]] || die "Caddyfile o'qib/yozib bo'lmadi: $CADDYFILE"
ok "Caddyfile: $CADDYFILE (konteynerda: $CONF_IN)"
if grep -qE "^[[:space:]]*${API_DOMAIN//./\\.}[[:space:],{]" "$CADDYFILE"; then
  note "$API_DOMAIN uchun blok allaqachon bor: Caddyfile o'zgartirilmaydi"; HAVE_BLOCK=1
else HAVE_BLOCK=0; fi

# ---------------------------------------------------------------- 4. Sozlamalar
say "4/7 Sozlamalar (.env)"
write_env=1
if [[ -f "$ENV_FILE" ]]; then
  ok ".env mavjud"
  if ((DRY)) || ! yn ".env ni qayta yozamizmi? (Yo'q = mavjudi qoladi)"; then write_env=0; fi
fi
if ((write_env)) && ((DRY)); then note "(dry-run) .env so'raladi va yoziladi"; write_env=0; fi
if ((write_env)); then
  cat <<'TXT'
  Hozir 5 ta savol bo'ladi. Har birini o'qing, kerakli qiymatni qo'ying va Enter bosing.
  MAXFIY qiymatlar yozilganda/qo'yilganda ekranda HECH NARSA ko'rinmaydi: bu normal.
  Qo'yish: sichqonchaning o'ng tugmasi yoki Ctrl+Shift+V.
TXT

  echo
  echo "  [1/5] GOOGLE CLIENT ID (Google Cloud > Credentials). '.apps.googleusercontent.com' bilan tugaydi."
  while true; do
    read -r -p "        Client ID: " G_ID
    G_ID="${G_ID//[[:space:]]/}"
    [[ "$G_ID" == *.apps.googleusercontent.com ]] && break
    if [[ -z "$G_ID" ]] && yn "Bo'sh qoldirildi: Google bilan kirish O'CHIQ bo'ladi. Shundayligicha davom etamizmi?"; then break; fi
    warn "Bunday ko'rinmaydi. Qayta kiriting."
  done

  G_SECRET=""
  if [[ -n "$G_ID" ]]; then
    echo
    echo "  [2/5] GOOGLE CLIENT SECRET: YANGI (almashtirilgan). 'GOCSPX-' bilan boshlanadi. Ko'rinmaydi."
    while true; do
      read -r -s -p "        Client secret: " G_SECRET; echo
      G_SECRET="${G_SECRET//[[:space:]]/}"
      if [[ "$G_SECRET" != GOCSPX-* ]]; then warn "'GOCSPX-' bilan boshlanishi kerak. Qayta kiriting."; continue; fi
      if ((${#G_SECRET} > 45)); then warn "Juda uzun (${#G_SECRET} belgi, odatda 35). Ikki marta qo'yilgan bo'lishi mumkin. Qayta kiriting."; continue; fi
      break
    done
  fi

  echo
  echo "  [3/5] GMAIL MANZIL: App Password olingan Gmail (masalan: ism@gmail.com)."
  while true; do
    read -r -p "        Gmail: " S_USER
    S_USER="${S_USER//[[:space:]]/}"
    [[ "$S_USER" =~ ^[^@]+@[^@]+\.[^@]+$ ]] && break
    warn "Pochta manzili bo'lishi kerak (@ bilan). Qayta kiriting."
  done

  echo
  echo "  [4/5] GMAIL APP PASSWORD: 16 ta harf (probel bo'lsa ham mayli). Oddiy Gmail paroli EMAS. Ko'rinmaydi."
  while true; do
    read -r -s -p "        App Password: " S_PASS; echo
    S_PASS="${S_PASS//[[:space:]]/}"
    [[ "$S_PASS" =~ ^[A-Za-z0-9]{16}$ ]] && break
    warn "16 ta harf bo'lishi kerak (siz ${#S_PASS} ta kiritdingiz). Qayta kiriting."
  done

  echo
  echo "  [5/5] GEMINI API KALITI: hozir kerak emas. Shunchaki Enter bosing."
  read -r -s -p "        Gemini (Enter): " GEM; echo
  M_FROM="DODA <$S_USER>"

  echo
  echo "  Kiritilganlar:"
  echo "    Google Client ID : ${G_ID:-(ochiq)}"
  echo "    Client secret    : ${G_SECRET:+kiritildi (${#G_SECRET} belgi)}"
  echo "    Gmail            : $S_USER"
  echo "    App Password     : kiritildi (16 belgi)"
  if [[ -n "$GEM" ]]; then echo "    Gemini           : kiritildi"; else echo "    Gemini           : yoq (keyin qo'shiladi)"; fi
  yn "Hammasi to'g'rimi? (Yo'q = to'xtaydi, qaytadan ishga tushirasiz)" || die "To'xtatildi. Hech narsa yozilmadi."
  umask 077
  {
    echo "APP_ORIGIN=$APP_ORIGIN"
    echo "PUBLIC_API_URL=https://$API_DOMAIN"
    echo "TRUST_PROXY=true"
    echo "SMTP_HOST=smtp.gmail.com"
    echo "SMTP_PORT=587"
    echo "SMTP_USER=$S_USER"
    echo "SMTP_PASS=$S_PASS"
    echo "MAIL_FROM=\"$M_FROM\""
    [[ -n "$G_ID" ]] && echo "GOOGLE_CLIENT_ID=$G_ID" && echo "GOOGLE_CLIENT_SECRET=$G_SECRET"
    [[ -n "$GEM" ]] && echo "GEMINI_API_KEY=$GEM"
    echo "LEGAL_VERSION=2026-11-draft"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok ".env yozildi (ruxsat 600)"
fi
[[ -f "$ENV_FILE" ]] || ((DRY)) || die ".env yo'q"

# ---------------------------------------------------------------- 5. Ishga tushirish
say "5/7 Konteynerni qurish va ishga tushirish"
cd "$HERE"
if ((DRY)); then note "(dry-run) CADDY_NETWORK=$NET docker compose up -d --build"
else
  built=0
  for attempt in 1 2 3; do
    if CADDY_NETWORK="$NET" docker compose up -d --build; then built=1; break; fi
    warn "Qurish $attempt-urinishda yiqildi (ko'pincha vaqtinchalik tarmoq xatosi)."
    [[ $attempt -lt 3 ]] && { note "10 soniyadan keyin qayta urinamiz..."; sleep ${RETRY_SLEEP:-10}; }
  done
  ((built)) || die "Server qurilmadi (3 urinish). Yuqoridagi xato matnini yuboring. Caddy'ga TEGILMADI."
fi

say "6/7 Sog'liq tekshiruvi"
if ((DRY)); then note "(dry-run) konteyner 'healthy' bo'lishi kutiladi"
else
  st=""
  for _ in $(seq 1 60); do
    st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$SVC" 2>/dev/null || true)"
    [[ "$st" == "healthy" ]] && break
    [[ "$st" == "exited" || "$st" == "dead" ]] && break
    sleep 2
  done
  if [[ "$st" != "healthy" ]]; then
    docker logs "$SVC" --tail 40 || true
    die "Konteyner ishga tushmadi (holat: ${st:-nomalum}). Caddy'ga TEGILMADI. Yuqoridagi logni yuboring."
  fi
  ok "'$SVC' healthy"
  if docker exec "$CADDY_CONTAINER" wget -qO- -T 5 "http://$SVC:8787/api/health" 2>/dev/null | grep -q '"ok":true'; then
    ok "Caddy konteyneri '$SVC' ga yeta oladi"
  else
    warn "Caddy konteyneri '$SVC' ga yeta olmadi (wget yo'q bo'lishi mumkin). Davom etamiz, oxirida HTTPS tekshiriladi."
  fi
fi

# ---------------------------------------------------------------- 7. Caddy
say "7/7 Caddy"
BLOCK=$(printf '\n# DODA API (install.sh)\n%s {\n    reverse_proxy %s:8787\n}\n' "$API_DOMAIN" "$SVC")
if ((HAVE_BLOCK)); then
  ok "Blok bor, o'tkazib yuborildi"
else
  echo "  Quyidagi blok Caddyfile OXIRIGA qo'shiladi (boshqa qismlar o'zgarmaydi):"
  printf '%s\n' "$BLOCK" | sed 's/^/      /'
  if ((DRY)); then note "(dry-run) qo'shilmaydi"
  elif yn "Qo'shamizmi?"; then
    BAK="$CADDYFILE.bak-doda-$(date +%Y%m%d%H%M%S)"
    cp -p "$CADDYFILE" "$BAK"; ok "Zaxira nusxa: $BAK"
    printf '%s\n' "$BLOCK" >> "$CADDYFILE"   # '>>' fayl identifikatorini saqlaydi (bind-mount uchun muhim)
    restore() { cat "$BAK" > "$CADDYFILE"; warn "Caddyfile eski holatga qaytarildi"; }
    if ! docker exec "$CADDY_CONTAINER" caddy validate --config "$CONF_IN" --adapter caddyfile; then
      restore; die "Caddy konfiguratsiyasi yaroqsiz. Eski holat tiklandi, hech narsa buzilmadi."
    fi
    ok "Konfiguratsiya yaroqli"
    if ! docker exec "$CADDY_CONTAINER" caddy reload --config "$CONF_IN" --adapter caddyfile; then
      restore; docker exec "$CADDY_CONTAINER" caddy reload --config "$CONF_IN" --adapter caddyfile || true
      die "Caddy qayta yuklanmadi. Eski holat tiklandi."
    fi
    ok "Caddy uzilishsiz qayta yuklandi"
  else
    warn "Caddy o'zgartirilmadi. Keyin qo'lda qo'shishingiz mumkin (server/deploy/Caddyfile.snippet)."
  fi
fi

say "Yakuniy tekshiruv"
if ((DRY)); then note "(dry-run) https://$API_DOMAIN/api/health tekshirilmaydi"
else
  good=0
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 8 "https://$API_DOMAIN/api/health" 2>/dev/null | grep -q '"ok":true'; then good=1; break; fi
    sleep 3
  done
  if ((good)); then ok "https://$API_DOMAIN/api/health ishlayapti"
  else
    warn "HTTPS javob bermadi. Sertifikat chiqarilishi 1-2 daqiqa olishi mumkin. Caddy logi:"
    docker logs "$CADDY_CONTAINER" --tail 25 2>&1 | sed 's/^/       /' || true
  fi
fi

cat <<EOF

Tayyor. Orqaga qaytarish kerak bo'lsa (boshqa xizmatlarga ta'sir qilmaydi):
  cd $HERE && docker compose down
  Caddyfile: zaxira nusxa ".bak-doda-*" ni qaytaring va: docker exec $CADDY_CONTAINER caddy reload --config $CONF_IN --adapter caddyfile
EOF

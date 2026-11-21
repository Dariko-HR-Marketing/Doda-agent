# DODA serverini VPS'ga joylash (1c)

Boshqa xizmatlarga tegmaslik uchun: alohida konteyner (256 MB limit), tashqariga port ochilmaydi, Caddy'ga faqat bitta blok qo'shiladi.

## Oldindan kerak
- DNS: `doda-api.tajriba24.uz` A -> `95.130.227.92` (qo'shilgan).
- Google Cloud: OAuth client'da **Authorized redirect URI**: `https://doda-api.tajriba24.uz/api/auth/google/callback`
  va **JavaScript origin**: `https://doda.tajriba24.uz`.
- Yangi (almashtirilgan) Google Client secret va Gmail App Password.

## Qadamlar (VPS'da, bittadan bajaring va natijani tekshiring)

1. Caddy ishlayotgan tarmoq nomini toping (faqat o'qish):
   ```bash
   docker inspect vps-web-1 --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'
   ```
2. Repo'ni oling:
   ```bash
   git clone https://github.com/Dariko-HR-Marketing/Doda-agent.git && cd Doda-agent/server
   git checkout claude/gallant-fermat-0b60zh
   ```
3. Sozlamalar fayli (maxfiy qiymatlarni faqat shu yerda yozing, hech qayerga yubormang):
   ```bash
   cp .env.example .env && chmod 600 .env && nano .env
   ```
4. Ishga tushirish (1-qadamdagi tarmoq nomi bilan):
   ```bash
   cd deploy && CADDY_NETWORK=<tarmoq_nomi> docker compose up -d --build
   docker logs doda-server --tail 20
   ```
   Kutilgan: `DODA server http://0.0.0.0:8787 (production)`.
5. Caddy: `Caddyfile.snippet` ichidagi blokni mavjud Caddyfile oxiriga qo'shing, so'ng tekshirib, uzilishsiz qayta yuklang:
   ```bash
   docker exec vps-web-1 caddy validate --config /etc/caddy/Caddyfile
   docker exec vps-web-1 caddy reload --config /etc/caddy/Caddyfile
   ```
   (Caddyfile joylashuvi sizda boshqacha bo'lishi mumkin.)
6. Tekshirish:
   ```bash
   curl -s https://doda-api.tajriba24.uz/api/health
   ```
   Kutilgan: `{"ok":true,"version":"0.1.0"}`.

## Orqaga qaytarish
`cd Doda-agent/server/deploy && docker compose down` va Caddyfile'dan blokni olib tashlang. Boshqa xizmatlarga ta'sir qilmaydi.

## Zaxira
Baza `doda-data` volume'da. Zaxira: `docker run --rm -v deploy_doda-data:/d -v $PWD:/b busybox tar czf /b/doda-backup.tgz -C /d .` (volume nomini `docker volume ls` dan tekshiring).

# DODA serverini VPS'ga joylash

Bitta skript hamma narsani qiladi va **boshqa xizmatlarga tegmaydi**: Caddy tarmog'ini va Caddyfile'ni o'zi topadi, o'zgartirishdan oldin nusxa oladi va tasdiq so'raydi, xato bo'lsa avtomat qaytaradi.

## Oldindan (bir marta)
- DNS: `doda-api.tajriba24.uz` A -> `95.130.227.92` (qo'yilgan).
- Google Cloud OAuth client: **Authorized redirect URI** `https://doda-api.tajriba24.uz/api/auth/google/callback`, **JavaScript origin** `https://doda.tajriba24.uz`.
- Tayyor bo'lsin: Google Client ID va **yangi** Client secret, Gmail manzili va App Password.

## Joylash (VPS'da)
```bash
git clone https://github.com/Dariko-HR-Marketing/Doda-agent.git
cd Doda-agent/server/deploy
bash install.sh --dry-run
```
`--dry-run` hech narsani o'zgartirmaydi: topilgan tarmoq va Caddyfile'ni, qo'shiladigan blokni ko'rsatadi. Hammasi to'g'ri ko'rinsa:
```bash
bash install.sh
```
Skript maxfiy qiymatlarni so'raydi (ekranda ko'rinmaydi), faqat serverdagi `server/.env` fayliga (ruxsat 600) yozadi.

## Yangilash (keyingi versiyalar)
```bash
cd Doda-agent && git pull && cd server/deploy && bash install.sh
```
Mavjud `.env` saqlanadi ("n" deb javob bering), ma'lumotlar bazasi volume'da qoladi.

## Orqaga qaytarish
```bash
cd Doda-agent/server/deploy && docker compose down
```
Caddyfile uchun skript yonida `Caddyfile.bak-doda-<vaqt>` nusxasi qoladi: uni joyiga qaytaring va `docker exec vps-web-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

## Zaxira nusxa (baza)
```bash
docker run --rm -v doda_doda-data:/d -v "$PWD":/b busybox tar czf /b/doda-backup.tgz -C /d .
```
(volume nomini `docker volume ls` bilan tekshiring.)

# DODA serverini VPS'ga joylash (bir martalik yig'ma yangilash)

Skript **boshqa xizmatlarga tegmaydi**: Caddy tarmog'ini va Caddyfile'ni o'zi topadi, o'zgartirishdan oldin nusxa oladi, tasdiq so'raydi.

## Oldindan (bir marta)
- DNS: `doda-api.tajriba24.uz` A → VPS IP (qo'yilgan).
- Google OAuth: redirect URI `https://doda-api.tajriba24.uz/api/auth/google/callback`, JS origin `https://doda.tajriba24.uz`.
- Gmail manzili va App Password (tasdiq xatlari uchun).

## Birinchi o'rnatish
```bash
git clone https://github.com/Dariko-HR-Marketing/Doda-agent.git
cd Doda-agent/server/deploy
bash install.sh --dry-run   # hech narsani o'zgartirmaydi
bash install.sh
```

## Yangilash — hammasini bitta martada
SSH uzilib qolmasligi uchun `screen` ichida:
```bash
screen -S doda
cd ~/Doda-agent && git pull && cd server/deploy && bash install.sh
```
- "`.env` ni qayta yozamizmi?" → **n** (mavjud sozlama va `KEYS_SECRET` saqlanadi).
- Caddy blokini so'rasa → **y**.
- Oxirida: `bash smoke.sh` (quyida) — hammasi `OK` bo'lishi kerak.
- Brauzerda saytni `Ctrl+Shift+R` bilan yangilang.

## Tekshiruv
```bash
bash server/deploy/smoke.sh
```
Salomatlik, sxema versiyasi, CORS (PATCH ham), xavfsizlik sarlavhalari, `KEYS_SECRET`, zaxira papkasini tekshiradi.

## Sozlamalar (`server/.env`)
| O'zgaruvchi | Ma'nosi |
|---|---|
| `KEYS_SECRET` | Foydalanuvchi kalitlarini shifrlash siri (≥32 belgi; install.sh bir marta yaratadi). **Zaxirada saqlang** |
| `ALLOW_SERVER_KEYS` | `true` bo'lsa foydalanuvchining kaliti yo'q paytda server kaliti ishlatiladi (standart: o'chiq) |
| `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Faqat `ALLOW_SERVER_KEYS=true` bo'lsa ishlatiladi (`set-key.sh`) |
| `LLM_PRIORITY` | Server kalitlari tartibi, masalan `gemini,anthropic,openai` |
| `*_MODEL_LIGHT/MAIN/STT` | Model nomlarini almashtirish |
| `MONTHLY_BUDGET_USD` | Faqat umumiy kalitlar uchun oylik chegara |

## Zaxira nusxa
Server har sutkada (va ishga tushganda) bazaning izchil nusxasini `/app/data/backups/doda-YYYYMMDD-HHMMSS.db` ga yozadi, oxirgi 7 tasi saqlanadi. Bu hajm ichida, shuning uchun VPS'dan tashqariga ham nusxa oling:
```bash
docker compose -f ~/Doda-agent/server/deploy/docker-compose.yml exec doda-api ls /app/data/backups
docker cp $(docker ps -qf name=doda):/app/data/backups ./doda-backups
```
**Tiklash:** konteynerni to'xtating, kerakli `.db` ni `/app/data/doda.db` o'rniga qo'ying (eski `doda.db-wal`/`-shm` fayllarni o'chiring), ishga tushiring. `.env` dagi `KEYS_SECRET` o'sha bo'lishi shart.

## Orqaga qaytarish
```bash
cd ~/Doda-agent/server/deploy && docker compose down
```
Caddyfile uchun `Caddyfile.bak-doda-<vaqt>` nusxasi qoladi; `ensure-caddy.sh` (cron, har 5 daqiqa) blok yo'qolsa tiklaydi.

## Foydalanuvchi ma'lumoti
Akkaunt oynasida "Ma'lumotlarimni yuklab olish" (`GET /api/account/export`) va "Akkauntni o'chirish" mavjud.

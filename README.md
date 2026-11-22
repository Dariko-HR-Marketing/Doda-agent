# DODA — agentlar uyushmasi

DODA — bosh agent va rol agentlaridan iborat shaxsiy yordamchilar tizimi: suhbat, xotira, vazifalar (to-do), mutaxassis agentlar. Uzbek (lotin) va rus tillarida. Hozir veb/PWA; keyin desktop va mobil.

**Biznes qoidasi:** DODA platformasi bepul. AI xarajati har bir foydalanuvchining o'z hisobidan: u o'z Anthropic / Google Gemini / OpenAI API kalitini ulaydi (kalit AES-256-GCM bilan shifrlanadi).

## Tuzilma

| Qism | Joyi | Izoh |
|---|---|---|
| Frontend | repo ildizi (`index.html`, `*.js`, `*.css`) | Statik sayt, GitHub Pages: https://doda.tajriba24.uz |
| PWA | `manifest.webmanifest`, `sw.js`, `pwa.js`, ikonlar | Ilova sifatida o'rnatiladi |
| Backend | `server/` | Node 22, TypeScript, Hono, SQLite (WAL), Docker, Caddy ortida |
| Deploy skriptlari | `server/deploy/` | `install.sh`, `set-key.sh`, `ensure-caddy.sh`, `smoke.sh` |
| Hujjatlar | `docs/` | `texnik-qarorlar.md` (qarorlar jurnali), `deploy-server.md` |

Frontend fayllari: `auth.js` (kirish, akkaunt, ma'lumot eksporti), `app-min.js` (asosiy interfeys, suhbat, ovoz), `workspace.js` (fayllar/xotira), `tasks.js` (topshiriq pasportlari), `agents.js` (agentlar, to-do, xotira, katalog), `today.js` ("Bugun"), `keys.js` (AI kalitlari).

## Ishlab chiqish

```bash
cd server && npm ci
npx tsc --noEmit && npx vitest run     # tiplar va testlar
KEYS_SECRET=$(head -c 30 /dev/urandom | base64) npm run dev
```

Frontend'ni `python3 -m http.server 8080` bilan oching; `localhost` da API `http://localhost:8787` ga ulanadi.

## Deploy

`main` ga tushgan o'zgarish avtomatik: frontend → GitHub Pages, server → CI (test). Serverni VPS'ga o'zingiz joylaysiz — qadamlar `docs/deploy-server.md` da. Ma'lumot eksporti, kunlik zaxira nusxa va `smoke.sh` tekshiruvi tayyor.

## Muhim qoidalar

- Foydalanuvchi ma'lumoti va AI kalitlari repoga kirmaydi; `server/.env` va `KEYS_SECRET` zaxirada saqlansin (yo'qolsa saqlangan kalitlar ochilmaydi).
- Agentlar bir-birining xotirasi, vazifasi va fayllarini ko'rmaydi.
- Barcha qarorlar `docs/texnik-qarorlar.md` da.

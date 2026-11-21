# DODA server

TypeScript (Node 22) + Hono + SQLite (better-sqlite3). Hozirgi qamrov: **1a-1b bosqichlar** (poydevor, ro'yxatdan o'tish, kirish, rozilik jurnali).

## Ishga tushirish

```bash
cd server
npm ci
npm run dev        # http://127.0.0.1:8787
npm test           # testlar
npm run build && npm start
```

Sozlamalar muhit o'zgaruvchilari orqali (`src/config.ts`): `PORT`, `HOST`, `DB_PATH`, `APP_ORIGIN`, `TRUST_PROXY`, `SESSION_TTL_DAYS`, `LEGAL_VERSION`.

## API (hozir)

| Metod | Yo'l | Vazifa |
|---|---|---|
| GET | `/api/health` | Sog'liq tekshiruvi |
| POST | `/api/auth/register` | Email + parol + rozilik. Javob doim bir xil (email oshkor qilinmaydi) |
| POST | `/api/auth/verify-email` | Pochta havolasidagi token |
| POST | `/api/auth/login` | Kirish (cookie). Tasdiqlanmagan pochta bilan kirib bo'lmaydi |
| POST | `/api/auth/logout` | Chiqish |
| GET | `/api/auth/me` | Joriy foydalanuvchi va rozilik holati |
| POST | `/api/account/consents` | Ovoz roziligini o'zgartirish |
| DELETE | `/api/account` | Akkaunt va barcha ma'lumotni o'chirish |

Xatolar: `{ "error": { "code", "message" } }`. `message` `Accept-Language` bo'yicha uz yoki ru.

## Xavfsizlik

- Parol: scrypt (N=2^14, r=8, p=5), bir vaqtda 2 ta xesh (2 GB VPS uchun).
- Sessiya: tasodifiy token cookie'da (`HttpOnly`, `SameSite=Lax`, productionda `__Host-` + `Secure`); bazada faqat SHA-256 xeshi.
- CSRF: Origin tekshiruvi + faqat JSON.
- Cheklov: ro'yxatdan o'tish, kirish (IP va email bo'yicha), tasdiqlash.
- Rozilik jurnali faqat qo'shiladi (versiya, vaqt, IP). Audit jurnalida shaxsiy ma'lumot yo'q (ID xeshi).

## Eslatma

Desktop va mobil ilovalar uchun keyinroq token (Bearer) asosidagi kirish qo'shiladi; hozirgi cookie kirishi brauzer uchun.

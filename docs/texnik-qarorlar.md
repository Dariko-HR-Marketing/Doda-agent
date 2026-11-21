# Texnik qarorlar (ADR qisqacha)

| # | Qaror | Sabab | Qachon qayta ko'ramiz |
|---|---|---|---|
| 1 | Backend: TypeScript, Node 22, Hono | Web, desktop, mobil, server uchun bitta til; yengil | Hech qachon yoki jiddiy sabab bo'lsa |
| 2 | Baza: SQLite (WAL), `better-sqlite3` | 2 GB VPS'da deyarli xotira yemaydi; MVP uchun yetarli | Ko'p foydalanuvchi / ko'p server bo'lganda PostgreSQL |
| 3 | Kirish: email+parol, tasdiqlash havolasi; Google keyin | Siz tanlagan usul; telefon SMS pullik, keyin | 1c bosqich (Google), keyin SMS |
| 4 | Parol: scrypt (node:crypto), native bog'liqliksiz | OWASP parametrlari, ortiqcha paket yo'q | |
| 5 | Sessiya: server tomonda, cookie | Bekor qilish oson; tokenlar xeshlanadi | Desktop/mobil uchun Bearer token qo'shiladi |
| 6 | Rozilik: alohida jurnal, versiyalangan | Qonun isbot talab qiladi (rozilik fakti) | Oferta matni o'zgarganda `LEGAL_VERSION` oshadi |
| 7 | Xatolar: kod + uz/ru xabar | Mijoz tarjimani o'zi boshqaradi, kodlar barqaror | |
| 8 | Agent yadrosi: o'z yupqa orkestrator + Vercel AI SDK (2-bosqichda) | Brief, ma'lumot ajratilishi, token yo'naltirish maxsus | |
| 9 | Hosting: Eskiz VPS (Docker, Caddy orqali), alohida subdomen | Siz tanlagansiz; boshqa tizimlarga tegmaslik | RAM yetmasa alohida VPS |

## Ochiq masalalar
- Oferta matni: yurist tayyorlaydi (tuzilma: shartlar, shaxsiy ma'lumot, chet elga uzatish, ovoz).
- SMTP: pochta yuboruvchi xizmat kerak (hozir xat konsolga chiqadi).
- Google OAuth: Google Cloud'da Client ID/Secret kerak.
- Ovoz yozuvi biometrik hisoblanishi mumkin: yurist bilan aniqlash.

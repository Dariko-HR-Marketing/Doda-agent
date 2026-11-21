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
| 10 | Suhbat: Gemini REST (oqim, `alt=sse`), o'z yupqa provayder qatlami | Model almashtirish oson (keyin Claude/OpenAI) | 4–5 bosqichda asboblar (tool calling) |
| 11 | Model yo'naltirgich: oddiy savol Flash-Lite, murakkab 3.8 Flash; oylik limit $5, sarf hisobi | Token tejash va kutilmagan hisobning oldini olish | Haqiqiy sarf o'lchangach |
| 12 | Ishchi maydon: serverdagi virtual papka (matnli fayllar, 20 versiya, bekor qilish, to'qnashuvda 409) | Xotira o'qiladigan va tahrirlanadigan bo'lsin; desktop papka bilan keyin sinxronlanadi | 8-bosqich (desktop) |
| 13 | Xotira: DODA faqat shaxsiy/doimiy ma'lumotga o'xshash xabarlardan, arzon modelda, javobdan keyin faktlarni ajratadi; maxfiy ma'lumot (parol, karta, kalit) yozilmaydi; foydalanuvchi o'chira oladi | Qo'shimcha so'rov va tokenni kamaytirish, maxfiylik | Agent xotirasi (5-bosqich) |

## Ochiq masalalar
- Oferta matni: yurist tayyorlaydi (tuzilma: shartlar, shaxsiy ma'lumot, chet elga uzatish, ovoz).
- SMTP: pochta yuboruvchi xizmat kerak (hozir xat konsolga chiqadi).
- Google OAuth: Google Cloud'da Client ID/Secret kerak.
- Ovoz yozuvi biometrik hisoblanishi mumkin: yurist bilan aniqlash.

# DODA: AI ulanishi va tashkilot kabineti standarti

## 1. Ishlash chegarasi

Bu versiya **bitta tashkilot** uchun. Egasi serverdagi `DODA_OWNER_EMAIL` bilan belgilanadi. Egasi xodim emailini kabinetga qo‘shadi; xodim kod orqali tasdiqlamaguncha kira olmaydi. Tashkilot a’zolari suhbat, topshiriq va fayllarni umumiy ko‘radi. Yakuniy qabul va prototip ma’lumotlarini import qilish faqat egasiga tegishli. Alohida tashkilotlar va shaxsiy ma’lumot bo‘limlari uchun ko‘p tashkilotli arxitektura keyingi bosqichda zarur.

## 2. AI xizmatlari

| Xizmat | Server kaliti | Standart model | So‘rov | Model katalogi |
| --- | --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `DODA_MODEL` | Responses API | `GET /v1/models` |
| Google Gemini | `GEMINI_API_KEY` | `DODA_GEMINI_MODEL` | `generateContent` | `GET /v1beta/models` |
| Anthropic Claude | `ANTHROPIC_API_KEY` | `DODA_CLAUDE_MODEL` | Messages API | `GET /v1/models` |

Kalitlar faqat serverdagi `/opt/doda-private.env` faylida, huquqi `0600`; browserga yuborilmaydi. Anthropic kaliti workspace bilan bog‘lanmagan bo‘lsa, `ANTHROPIC_WORKSPACE_ID` ham beriladi. Google Cloud Vertex AI OAuth yo‘li bu versiyaga kirmaydi; Gemini API kaliti Google AI Studio/Google Cloud loyihasi orqali olinadi. ChatGPT veb obunasi OpenAI API kaliti emas.

`DODA_AI_ORDER=openai,gemini,claude` avtomatik tartibdir. Vaqtinchalik tarmoq, limit yoki server xatosida keyingi sozlangan xizmat sinab ko‘riladi. Autentifikatsiya va model konfiguratsiyasi xatosi keyingi xizmatga yashirilmaydi. Bir model qo‘lda tanlansa, faqat o‘sha xizmat chaqiriladi. Fallback xususiy matn yoki faylni keyingi provayderga ham uzatishi mumkin; tashkilot ma’lumot siyosati bilan mosligini tekshirish kerak.

Katalog har bir kalit orqali ko‘rinadigan model IDlarini ko‘rsatadi. Bu hamma model matnli muloqot yoki fayl tahlilini qo‘llaydi degani emas: mos kelmagan model aniq xato qaytaradi. Gemini va Claude yo‘li PDF hamda UTF-8 matn fayllari (`.txt`, `.md`, `.csv`) bilan cheklangan; Office fayllarining hozirgi yo‘li OpenAI. Fayl faqat agent ishga tushirilganda modelga yuboriladi. Hozirgi adapterlarda web qidiruv, tasvir yaratish, ovoz modeli va tashqi amallar yo‘q.

## 3. Elektron pochta va sessiya

1. Tashkilot egasi emaili serverda oldindan belgilanadi. Egasi boshqa a’zolarni kabinetda ro‘yxatga qo‘shadi.
2. Kiruvchi emailini yuboradi. Tizim ruxsatli va noma’lum manzilga bir xil javob qaytaradi; noma’lum manzilga xat yubormaydi.
3. Ruxsatli manzilga SMTP TLS orqali 8 xonali tasodifiy kod yuboriladi. Kod 10 daqiqa amal qiladi, 5 xato urinishdan so‘ng yaroqsiz, tasdiqlangach o‘chiriladi. Qayta yuborish 60 soniya ichida cheklanadi.
4. Tasdiqdan keyin server bazada qaytarib olinadigan sessiya yaratadi. Browser faqat `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie oladi. Chiqishda sessiya bekor qilinadi. Session va API kalitlari localStorage’da saqlanmaydi.
5. Profil tashkilot nomi, tasdiqlangan email, ism va rolni ko‘rsatadi. Egasi a’zolar ro‘yxatini ko‘radi va email qo‘shadi. A’zolar umumiy kabinetga kiradi; tashkilotlararo ajratish bu versiyada yo‘q.

**Pochta sozlamalari:** `DODA_SMTP_HOST`, `DODA_SMTP_PORT`, `DODA_SMTP_SECURITY=starttls` yoki `ssl`, `DODA_SMTP_FROM`, ixtiyoriy `DODA_SMTP_USER`/`DODA_SMTP_PASSWORD`. Pochta xizmati ishlamasa, kod berilgan deb ko‘rsatmaydi. Email kodi bitta faktorli kirish; u alohida MFA emas. Korporativ foydalanishda SSO/Passkey va audit jurnalini keyin alohida baholash kerak.

## 4. Qabul sinovi

- Anonim `/api/state`, `/api/me`, `/api/ai/models` so‘rovlari `401` qaytaradi.
- Noma’lum emailga kod ketmaydi; tasdiqlanmagan email kabinetga kirmaydi. Noto‘g‘ri kod va muddati tugagan kod ishlamaydi; logout sessiyani bekor qiladi.
- Egasi xodim emailini qo‘shadi; xodim kiradi, lekin a’zo qo‘sholmaydi va yakuniy qabul qilolmaydi.
- Uch provayderning har birida ruxsatli matn modelidan haqiqiy javob olinadi. Bir model tanlansa aynan o‘sha javob beradi. Avtomatik tartibda vaqtinchalik xato keyingisiga o‘tadi.
- PDF yuborish va yozma natija Kapitan qabuligacha tekshiruv holatida qolishi sinovdan o‘tadi.
- Server kalitlari xatolik matni, brauzer HTML/JS, GitHub va loglarda chiqmaydi.

## Rasmiy manbalar

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses) va [Models API](https://platform.openai.com/docs/api-reference/models/list)
- [Gemini generateContent](https://ai.google.dev/api/generate-content) va [Models API](https://ai.google.dev/api/models)
- [Claude Messages API](https://platform.claude.com/docs/en/api/messages/create) va [Models API](https://platform.claude.com/docs/en/api/models/list)
- [OWASP email tasdig‘i](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html), [OTP himoyasi](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [sessiya cookie](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

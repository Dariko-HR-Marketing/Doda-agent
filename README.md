# DODA — shaxsiy agent prototipi

O‘rtoq Kapitan uchun DODA shaxsiy agenti va DARIKO mutaxassis agentlarining interaktiv web prototipi.

## Hozir ishlaydigan qismlar

- DODA bilan suhbat va topshiriqni ajratish namoyishi.
- Topshiriq pasporti, besh bosqichli yo‘l xaritasi va Kapitan qabuli namoyishi.
- Hujjat va sifat, HR jarayonlari, marketing va tadqiqot agentlarining rol tavsiflari.
- Brauzerda vazifalarni `localStorage`da, biriktirilgan fayllarni `IndexedDB`da saqlash.
- Brauzer qo‘llab-quvvatlasa, `SpeechRecognition` orqali ilova ochiq paytda ovoz kiritishni sinash.

## Chegaralar

Bu versiya statik HTML/CSS/JavaScript prototipidir. AI modeli, server bazasi, haqiqiy agent ijrosi, ko‘p qurilmali sinxronlash, doimiy ovozli uyg‘otish va tashqi xizmatlarga amallar ulanmagan. Topshiriq bosqichlari qo‘lda o‘zgartiriladi. Brauzer ma’lumotlarini o‘chirish yoki boshqa qurilmaga o‘tish saqlangan namuna ishlarni yo‘qotishi mumkin.

## Ishga tushirish

`index.html` faylini brauzerda oching yoki katalogni oddiy statik web serverda xizmat qildiring. Serverda joylashtirishda shu katalogni saytning web ildizi sifatida tanlang; `index.html` asosiy sahifa bo‘ladi. HTTPS ishlating, ayniqsa mikrofon sinovi uchun.

## Fayllar

- `index.html` — sahifalar va matnlar.
- `app.css` — adaptiv dizayn va animatsiyalar.
- `app.js` — prototip interaksiyalari va brauzer ichidagi saqlash.

Bu repozitoriy loyihaning yagona manbasi: barcha kod va dizayn o‘zgarishlari shu yerda, Claude Code orqali amalga oshiriladi. `main` tarmog‘iga tushgan o‘zgarishlar avtomatik deploy qilinadi.

## Deploy

- Jonli sayt: https://doda.tajriba24.uz
- Server: VPS (Ubuntu 24.04), Nginx, HTTPS (Let's Encrypt).
- `main` tarmog'iga push qilinganda `.github/workflows/deploy.yml` fayllarni serverga yuboradi.
- GitHub Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
- Serverni birinchi marta sozlash: `deploy/server-setup.sh`.

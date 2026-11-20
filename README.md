# DODA — shaxsiy agent

O‘rtoq Kapitan uchun DODA suhbat oynasi va DARIKO mutaxassis agentlarining web ilovasi. Jonli statik prototip: [doda.tajriba24.uz](https://doda.tajriba24.uz/).

## Joriy funksiyalar va chegaralar

| Oqim | Statik prototip (`main`) | Server bosqichi (`feature/doda-core`) |
| --- | --- | --- |
| Suhbat | Namuna javob | OpenAI Responses API orqali haqiqiy javob; tarix SQLite’da |
| Topshiriq pasporti | Shu brauzerda | Serverda, loyiha/agent/natija/muddat bilan |
| Bosqich va Kapitan qabuli | Qo‘lda namoyish | Serverda qayd, faqat dalildan keyin qabul |
| Fayl | IndexedDB’da | Serverda xususiy fayl; topshiriqqa biriktirish va yuklash |
| Agent | Rol tavsifi | Tanlangan rol bo‘yicha yozma natija; fayllar faqat **Agent bilan bajarish** bosilganda modelga yuboriladi |
| Ovoz | Brauzer SpeechRecognition | O‘sha brauzer imkoniyati; fon rejimidagi uyg‘otish yo‘q |
| Bilim va integratsiyalar | Arxitektura tavsifi | RAG, tashqi xizmatlarga amallar va ko‘p foydalanuvchi hali yo‘q |

Agent yozma natijani `.txt` faylida beradi. U reklamani nashr qilmaydi, xabar yubormaydi, byudjet sarflamaydi va vazifani o‘zi qabul qilmaydi. Marketing bo‘yicha joriy bozor faktlari manbasiz tekshirilgan deb aytilmasligi kerak; web qidiruv vositasi hali ulanmagan.

## Ishlab chiqish

Python 3.12 bilan `pip install -r backend/requirements.txt`, so‘ng `uvicorn backend.server:app --reload`. `DODA_DB_PATH`, `DODA_FILES_PATH`, `DODA_PUBLIC_ORIGIN`, `DODA_PASSWORD_HASH`, `DODA_SESSION_SECRET`, `DODA_MODEL` va `OPENAI_API_KEY` server muhiti orqali beriladi. Maxfiy qiymatlarni gitga kiritmang. Parol hashini `python -m backend.server hash-password` bilan yarating. API va sayt bir domen ostida `/api/*` orqali xizmat qilishi kerak.

`python -m unittest backend.test_server -v` backendning xususiy ma’lumot, fayl, topshiriq, tasdiq va xatolik holatlarini tekshiradi. `node --check app.js` frontend sintaksisini tekshiradi.

Serverga qo‘yish bo‘yicha [yo‘riqnoma](docs/DEPLOY_CORE.md). Hozirgi statik saytni shu tarmoq tayyor va maxfiy muhit qiymatlari sozlanmaguncha almashtirmang.

# DODA — shaxsiy agent

O‘rtoq Kapitan uchun DODA suhbat oynasi va DARIKO mutaxassis agentlarining web ilovasi. Jonli statik prototip: [doda.tajriba24.uz](https://doda.tajriba24.uz/).

## Joriy funksiyalar va chegaralar

| Oqim | Statik prototip (`main`) | Server bosqichi (`feature/doda-core`) |
| --- | --- | --- |
| Suhbat | Namuna javob | OpenAI yoki Gemini API orqali haqiqiy javob; tarix SQLite’da |
| Topshiriq pasporti | Shu brauzerda | Serverda, loyiha/agent/natija/muddat bilan |
| Bosqich va Kapitan qabuli | Qo‘lda namoyish | Serverda qayd, faqat dalildan keyin qabul |
| Fayl | IndexedDB’da | Serverda xususiy fayl; topshiriqqa biriktirish va yuklash |
| Eski ishlarni ko‘chirish | Brauzerda saqlanadi | Shu domen va brauzerdagi ishlar uchun zaxira va ixtiyoriy import |
| Agent | Rol tavsifi | Tanlangan rol bo‘yicha yozma natija; fayllar faqat **Agent bilan bajarish** bosilganda modelga yuboriladi |
| Ovoz | Brauzer SpeechRecognition | O‘sha brauzer imkoniyati; fon rejimidagi uyg‘otish yo‘q |
| Bilim va integratsiyalar | Arxitektura tavsifi | RAG, tashqi xizmatlarga amallar va ko‘p foydalanuvchi hali yo‘q |

Agent yozma natijani `.txt` faylida beradi. U reklamani nashr qilmaydi, xabar yubormaydi, byudjet sarflamaydi va vazifani o‘zi qabul qilmaydi. Marketing bo‘yicha joriy bozor faktlari manbasiz tekshirilgan deb aytilmasligi kerak; web qidiruv vositasi hali ulanmagan.

AI xizmatlari faqat serverda sozlanadi: `DODA_AI_ORDER=openai,gemini` avval OpenAI’ga, vaqtinchalik xatoda Gemini’ga so‘rov yuboradi. `gemini,openai` tartibni almashtiradi; faqat bitta nomni yozish boshqa xizmatga o‘tishni o‘chiradi. Ikkala xizmat uchun kalit va model nomi alohida kerak. Fallback yoqilgan bo‘lsa, suhbat yoki topshiriq mazmuni ikkinchi xizmatga ham yuborilishi mumkin. Gemini yo‘li bu bosqichda PDF va UTF-8 matnli `.txt`, `.md`, `.csv` fayllarini o‘qiydi; Office fayllari OpenAI talab qiladi. Ilova ichida faqat maxfiy konfiguratsiya holatini ko‘rish uchun `/api/ai/status` mavjud; u kalitlarni qaytarmaydi. Google Cloud Vertex AI OAuth yo‘li bu adapterda yo‘q.

## Ishlab chiqish

Python 3.12 bilan `pip install -r backend/requirements.txt`, so‘ng `uvicorn backend.server:app --reload`. Muhit nomlari `.env.example`da; OpenAI uchun `OPENAI_API_KEY` va `DODA_MODEL`, Gemini API uchun `GEMINI_API_KEY` va `DODA_GEMINI_MODEL` kerak. ChatGPT veb obunasi DODA serveridagi API o‘rnini bosmaydi. Maxfiy qiymatlarni gitga kiritmang. Parol hashini `python -m backend.server hash-password` bilan yarating. API va sayt bir domen ostida `/api/*` orqali xizmat qilishi kerak.

`python -m unittest backend.test_server -v` backendning xususiy ma’lumot, fayl, topshiriq, import, tasdiq va xatolik holatlarini tekshiradi. `node --check app.js` va `node --check migration.js` frontend sintaksisini tekshiradi.

Serverga qo‘yish bo‘yicha [yo‘riqnoma](docs/DEPLOY_CORE.md). Hozirgi statik saytni shu tarmoq tayyor va maxfiy muhit qiymatlari sozlanmaguncha almashtirmang.

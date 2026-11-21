# DODA — shaxsiy agent

O‘rtoq Kapitan uchun DODA suhbat oynasi va DARIKO mutaxassis agentlarining web ilovasi. Jonli statik prototip: [doda.tajriba24.uz](https://doda.tajriba24.uz/).

## Joriy funksiyalar va chegaralar

| Oqim | Statik prototip (`main`) | Server bosqichi (`feature/doda-core`) |
| --- | --- | --- |
| Suhbat | Namuna javob | OpenAI, Gemini yoki Claude API orqali haqiqiy javob; tarix SQLite’da |
| Model tanlash | Yo‘q | Kalit orqali ko‘rinadigan modellar katalogi; bitta model yoki avtomatik tartib |
| Topshiriq pasporti | Shu brauzerda | Serverda, loyiha/agent/natija/muddat bilan |
| Bosqich va Kapitan qabuli | Qo‘lda namoyish | Serverda qayd, faqat dalildan keyin qabul |
| Fayl | IndexedDB’da | Serverda xususiy fayl; topshiriqqa biriktirish va yuklash |
| Eski ishlarni ko‘chirish | Brauzerda saqlanadi | Shu domen va brauzerdagi ishlar uchun zaxira va ixtiyoriy import |
| Agent | Rol tavsifi | Tanlangan rol bo‘yicha yozma natija; fayllar faqat **Agent bilan bajarish** bosilganda modelga yuboriladi |
| Ovoz | Brauzer SpeechRecognition | O‘sha brauzer imkoniyati; fon rejimidagi uyg‘otish yo‘q |
| Bilim va integratsiyalar | Arxitektura tavsifi | RAG, tashqi xizmatlarga amallar va ko‘p foydalanuvchi hali yo‘q |

Agent yozma natijani `.txt` faylida beradi. U reklamani nashr qilmaydi, xabar yubormaydi, byudjet sarflamaydi va vazifani o‘zi qabul qilmaydi. Marketing bo‘yicha joriy bozor faktlari manbasiz tekshirilgan deb aytilmasligi kerak; web qidiruv vositasi hali ulanmagan.

AI xizmatlari faqat serverda sozlanadi: `DODA_AI_ORDER=openai,gemini,claude` avtomatik tartib. Xatoda keyingisiga faqat vaqtinchalik uzilishlarda o‘tiladi. Bir model aniq tanlansa, boshqa xizmatga o‘tilmaydi. Har bir xizmat uchun kalit va standart model nomi alohida kerak. Avtomatik tartibdagi fallback suhbat yoki topshiriq mazmunini keyingi xizmatga ham yuborishi mumkin. Gemini va Claude yo‘li bu bosqichda PDF va UTF-8 matnli `.txt`, `.md`, `.csv` fayllarini o‘qiydi; Office fayllari OpenAI talab qiladi. `/api/ai/status` maxfiy qiymatlarni qaytarmaydi, `/api/ai/models` esa kalit orqali ko‘rinadigan model identifikatorlarini oladi. Katalogga kirish modelning DODA’dagi matn/fayl oqimiga mosligi kafolati emas: ba’zi modellar boshqa turdagi API yoki imkoniyat talab qiladi. Google Cloud Vertex AI OAuth yo‘li bu adapterda yo‘q.

## Ishlab chiqish

Python 3.12 bilan `pip install -r backend/requirements.txt`, so‘ng `uvicorn backend.server:app --reload`. Muhit nomlari `.env.example`da; OpenAI uchun `OPENAI_API_KEY`/`DODA_MODEL`, Gemini API uchun `GEMINI_API_KEY`/`DODA_GEMINI_MODEL`, Claude uchun `ANTHROPIC_API_KEY`/`DODA_CLAUDE_MODEL` kerak. ChatGPT veb obunasi DODA serveridagi API o‘rnini bosmaydi. Maxfiy qiymatlarni gitga kiritmang. Parol hashini `python -m backend.server hash-password` bilan yarating. API va sayt bir domen ostida `/api/*` orqali xizmat qilishi kerak.

`python -m unittest backend.test_server -v` backendning xususiy ma’lumot, fayl, topshiriq, import, AI adapterlari, model katalogi, tasdiq va xatolik holatlarini tekshiradi. `node --check app.js`, `node --check migration.js` va `node --check model-picker.js` frontend sintaksisini tekshiradi.

Serverga qo‘yish bo‘yicha [yo‘riqnoma](docs/DEPLOY_CORE.md). Hozirgi statik saytni shu tarmoq tayyor va maxfiy muhit qiymatlari sozlanmaguncha almashtirmang.

# DODA: bozor va texnologiya tahlili (2026-noyabr)

Manba: internetdagi ochiq maqolalar va hujjatlar. Raqamlarning ko'pi sotuvchilarning o'z e'lon qilgan ko'rsatkichlari, mustaqil tasdiqlanmagan. Yuridik qismlar maslahat emas.

## 1. Xizmatlar xaritasi

### A. Tayyor "agent jamoasi" platformalari (kod yozmasdan)
| Xizmat | Nima qiladi | Kuchli tomoni | Kamchiligi |
|---|---|---|---|
| Lindy | Shaxsiy yordamchi: pochta, kalendar | Juda tez boshlanadi, tashqariga yuborishdan oldin tasdiq | Ovoz/telefon va tez-tez ishlaydigan jarayonlarda kredit tez tugaydi; chuqur kod/o'z serveri uchun mos emas |
| Relevance AI | Vizual ko'p agentli iyerarxiya (savdo/GTM) | Agentlar ierarxiyasi tayyor | Foydalanuvchi o'rni va "action" hisobi qimmatlashishi mumkin |
| Dust | Kompaniya bilimini ulaydigan umumiy yordamchilar | Notion/Drive kabi manbalar ulanadi | Asosan bilim qidiruvi, rol agentlar zavodi emas |
| Agenta | Ochiq kodli low-code "AI hamkasblar" | Cron/webhook/Slack, versiyalangan yo'riqnoma, ochiq kod | Yosh mahsulot |
| Glean, Salesforce Agentforce, IBM watsonx Orchestrate | Korporativ platformalar | Xavfsizlik, integratsiya, A2A | Qimmat, ekotizimga bog'lanib qolish, foydalanishga qarab narx oshadi |

### B. Dasturchilar uchun kutubxonalar (agent "dvigateli")
| Kutubxona | Yondashuv | Qachon yaxshi | Savdosi |
|---|---|---|---|
| LangGraph | Aniq holat grafiklari | Murakkab, uzoq jarayonlar | Ko'p dizayn ishi, o'rganish qiyinroq |
| CrewAI | Rol asosidagi "jamoalar" | Ko'p agentli hamkorlik | Natijani oldindan aytish qiyinroq |
| OpenAI Agents SDK | Minimal: handoff, guardrail | OpenAI atrofida | Kichikroq to'plam |
| Google ADK | Google agent toolkit (Py/TS/Java/Go) | Gemini va Google Cloud | Google ekotizimiga moyil |
| Claude Agent SDK | Claude Code harnessi, subagentlar, ruxsatlar | Fayl/buyruq bilan ishlovchi agentlar | Subprocess ishlatadi, host ishchi maydon va ruxsatlarni o'zi boshqaradi |
| Microsoft Agent Framework | Agent + graf ish oqimlari | Azure/.NET | Katta sirt |
| Vercel AI SDK, Mastra, Pydantic AI | Yengil TypeScript/Python | Ko'p modelli ilova | Orkestratsiyani o'zingiz yozasiz |

Ochiq protokollar: **MCP** (agent-asbob), **A2A** (agent-agent), **OpenTelemetry** (kuzatuv).

### C. Agent-birinchi muhit: Google Antigravity
- "Agent Manager" oynasi: bir nechta agent parallel ishlaydi, foydalanuvchi bildirishnoma qutisida kuzatadi.
- **Artifact**lar: vazifalar ro'yxati, reja, yakuniy hisobot, skrinshot/yozuv. Foydalanuvchi ularga Google Docs uslubida izoh qoldiradi, agent to'xtamasdan hisobga oladi.
- Agent ish va fikrlardan "bilim elementlari" yig'adi.
- Kamchiliklar (manbalarga ko'ra): ikki agent bir faylni o'zgartirsa to'qnashuv; sessiyalar orasida o'rgangan kontekst yo'qolishi mumkin; ish maydoni shaxsiy Google akkauntiga bog'liq.
- **DODA uchun saboq:** artifact + izoh orqali nazorat va "Kiruvchilar qutisi" g'oyasi juda mos. Ayniqsa topshiriq pasporti uchun.

### D. Xotira qatlami
| Yechim | Qanday saqlaydi | Kuchli | Zaif |
|---|---|---|---|
| Mem0 | Suhbatdan faktlar (vektor+graf), foydalanuvchi/agent/tashkilot doirasi | Eng oson ulanadi, MCP, Apache-2.0 | Bir qidiruvda ko'proq token (~7K) |
| Zep / Graphiti | Vaqtga bog'liq bilim grafi (fakt amal qilish muddati bilan) | Faktlar o'zgaradigan sohalar, kam token (~1.6K) | Xizmat ishga tushirish kerak, murakkab |
| Letta (MemGPT) | Agent o'z xotira bloklarini o'zi tahrirlaydi | Uzoq ishlaydigan agentlar, matn ko'rinishida o'qiladi | Kuchli model kerak, o'z runtime'iga bog'lanish |

Ogohlantirish: har bir sotuvchi benchmark'da o'zini oldinda ko'rsatadi, mustaqil sinovda raqamlar ancha past chiqqan. **O'qiladigan (matn) xotira** eng amaliy: nima o'rganganini tekshira olasiz. Bu bizning "ishchi maydon papkasi" g'oyasiga mos.

## 2. Ovoz (o'zbek tili)
- **ElevenLabs Scribe**: o'zbek uchun STT, sotuvchi ma'lumotiga ko'ra FLEURS'da WER ~3.1%. Boshqa model bilan taqqoslashi ham sotuvchi tomonidan, mustaqil tasdiq kerak.
- **Muxlisa** (muxlisa.uz): mahalliy STT/TTS API, ro'yxatdan o'tganda bonus daqiqalar, narx so'mda.
- **UzbekVoice**: mahalliy, taxminan 60 000 so'm/soat (qiyoslash saytiga ko'ra).
- Whisper large v3 o'zbekchada zaif ko'rsatilgan (sotuvchi sinovi).
- Gemini o'zi ham ovozni qayta ishlaydi, qo'shimcha xizmat o'rniga ishlatish mumkin.
- **Qaror:** haqiqiy ovozingizda 3 variantni sinab tanlaymiz.

## 3. Ma'lumot maxfiyligi va qonun
- **Gemini bepul darajasi (Unpaid Services):** Google shartlariga ko'ra yuborilgan kontent va javoblar Google mahsulotlarini yaxshilash uchun ishlatiladi va **inson tekshiruvchilar o'qishi mumkin**. Pullik (billing yoqilgan) rejada bunday emas.
  - **Xulosa:** bepul kalitni faqat soxta/test ma'lumotlar bilan ishlating. HR hujjatlari, shaxsiy ma'lumotlar bilan ishlatmang.
- **O'zbekiston "Shaxsga doir ma'lumotlar to'g'risida"gi qonun** (lex.uz, tahriri 2026-yil mart):
  - Biometrik, genetik ma'lumotlar va telekom operatorlari mijozlari ma'lumotlari **O'zbekiston hududida** saqlanishi shart (27¹-modda).
  - Boshqa shaxsiy ma'lumotlar xorijda saqlanishi mumkin, agar davlat bir xil himoyani ta'minlasa yoki operator xalqaro standartlarga rioya qilsa.
  - Transchegaraviy uzatishda (15-modda) bir xil himoyali davlat yoki sub'ekt roziligi kerak.
  - Ba'zi bazalar davlat reyestrida ro'yxatdan o'tishi kerak (mehnat qonuniga ko'ra HR bazalari bundan mustasno).
  - **Ovoz yozuvi biometrik hisoblanishi mumkin**, bu yurist bilan aniqlanishi kerak.
- Sizning "O'zbekiston serverlarida" qaroringiz: Eskiz VPS shu talabni qondiradi. Lekin modelga yuborilgan matn xorijga chiqadi. Shuning uchun: shaxsiy ma'lumotni yashirish (maskalash), maxfiylik darajalari, keyin mahalliy model varianti.

## 4. DODA uchun xulosalar
**Bozor to'ldirilgan:** konstruktorlar (Lindy, Relevance, Dust) bor. Lekin ular odatda ingliz tilida, ma'lumot ularning bulutida, narx kredit/o'ringa qarab oshadi.

**DODA ustunligi bo'lishi mumkin bo'lgan joylar:**
1. O'zbek va rus tili birinchi darajada, ovoz bilan.
2. Bitta kirish nuqtasi (DODA) va rollarni o'zi yaratishi ("agent zavodi").
3. Ma'lumotlar O'zbekistonda va foydalanuvchining o'z papkasida.
4. Davlat tashkilotlari, agentliklar uchun maxfiylik darajalari.
5. Oldindan hisoblanadigan, nazorat qilinadigan xarajat.

**Texnik tavsiya:**
- Til: **TypeScript** (web, desktop, mobil, backend uchun bitta til).
- Agent yadrosi: og'ir framework emas, **o'z yupqa orkestratorimiz** (brief, ma'lumot ajratilishi, model yo'naltirgich, tasdiq maxsus talablar) + **Vercel AI SDK** (Gemini/OpenAI/Anthropic bitta interfeys).
- Baza: MVP'da **SQLite**, SaaS bosqichida PostgreSQL.
- Asboblar: **MCP** orqali.
- Xotira: o'z **matnli xotira** (papka + qidiruv), Mem0 g'oyalaridan foydalaniladi.
- Nazorat: Antigravity'dan ilhomlanib, artifact va izohlar.

## 5. Xavflar
- Gemini bepul darajasida maxfiylik va limit (so'rovlar soni cheklangan, o'zgarib turadi).
- Ko'p agentli tizimlarda xato zanjiri: DODA tekshiruvi va testlar shart.
- 2 GB VPS: baza va backend xotira limiti bilan ishlashi kerak.
- Raqobat: katta kompaniyalar mahalliy tillarni qo'shishi mumkin, shuning uchun tezlik va mahalliy ustunlik muhim.

## 6. API narxlari (rasmiy sahifalar, 2026-noyabr; USD, 1 million token uchun)

| Model | Kirish | Chiqish | Keshdan o'qish | Izoh |
|---|---|---|---|---|
| Claude Haiku 5.5 | 0.10 | 0.50 | 0.01 | Yo'naltirish, ajratish; 100K tokendan uzun so'rovda 5x qimmat |
| Claude Sonnet 5.5 | 2 | 10 | 0.10 | Asosiy ish uchun |
| Claude Opus 5.5 | 4 | 20 | 0.20 | Murakkab ishlar |
| Claude Fable 5.2 | 8 | 40 | 0.20 | Eng kuchli |
| GPT-6 Luna (OpenAI) | 0.10 | 0.50 | 0.01 | Eng tejamkor |
| GPT-6.1 Terra | 1 | 5 | 0.05 | |
| GPT-6.2 Sol | 2 | 10 | 0.10 | |
| GPT-6.2 Astra | 8 | 40 | 0.40 | Eng kuchli |
| Gemini 3.5 Flash-Lite | 0.30 | 2.50 | 0.03 | |
| Gemini 3.8 Flash | 0.75 | 3.75 | 0.075 | **2027-yil 1-yanvardan 1.50 / 7.50** |
| Gemini 4 Hydrogen | 1.50 | 7.50 | 0.075 | Bepul daraja bor |
| Gemini 4 Carbon/Argon | 2.00 | 10.00 | 0.10 | Dekabrdan 4 / 20; faqat pullik |

Chegirmalar: Batch (asinxron) 50%. Keshlash: Claude'da keshdan o'qish bazaviy kirish narxining 0.05x-0.1x. Veb-qidiruv: Claude va OpenAI 10$/1000 so'rov, Gemini 5000 bepul/oy, keyin 14$/1000.
Ovoz: OpenAI GPT-Transcribe ~0.0045$/daq, Live-Transcribe 0.017$/daq. Gemini 3.5 Transcribe ~0.005$/daq.

Muhim:
- Obunalar (ChatGPT Plus, Claude Pro, Gemini) API'ni **o'z ichiga olmaydi**. OpenAI FAQ'da buni aniq yozgan. API alohida hisob va to'lov.
- Gemini bepul darajasida kontent Google mahsulotlarini yaxshilash uchun ishlatiladi. Pullik darajada yo'q.
- Claude 4.7 va keyingi modellar eski tokenizerdan ~30% ko'proq token hosil qiladi. O'zbek/rus matni odatda inglizchadan ko'proq token oladi (taxminiy, o'lchash kerak).

### Taxminiy oylik xarajat (bitta faol foydalanuvchi)
Faraz: oyiga 900 oddiy suhbat (4K kirish / 0.6K chiqish) + 60 murakkab topshiriq (30K kirish / 4K chiqish), keshsiz.

| Faqat shu model | Oyiga |
|---|---|
| Claude Haiku 5.5 yoki GPT-6 Luna | ~$0.9 |
| Gemini 3.5 Flash-Lite | ~$3.6 |
| Gemini 3.8 Flash (hozir / 2027) | ~$7 / ~$14 |
| GPT-6.1 Terra | ~$9 |
| Claude Sonnet 5.5 yoki GPT-6.2 Sol | ~$19 |
| Claude Opus 5.5 | ~$37 |

Aralash yo'naltirish (oddiy ishlar arzon modelda, murakkab ishlar kuchlisida) odatda $3-8 atrofida bo'ladi. Bu faraz, haqiqiy sarfni 1-2 haftalik ishlatishdan o'lchaymiz.

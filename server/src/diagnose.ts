/** Gemini aloqasini tekshiradi: kalit bormi, har bir model javob beradimi. Kalitni CHIQARMAYDI.
 *  Ishga tushirish: docker exec doda-server node dist/diagnose.js */
import { loadConfig } from "./config.js";

const config = loadConfig();
const key = config.GEMINI_API_KEY;

const HINTS: Record<number, string> = {
  400: "So'rov yoki kalit noto'g'ri (ko'pincha: kalit xato, yoki hudud qo'llab-quvvatlanmaydi). Google xabariga qarang.",
  401: "Kalit qabul qilinmadi. AI Studio'da yangi kalit oling va .env dagi GEMINI_API_KEY ni almashtiring.",
  403: "Ruxsat yo'q: kalit boshqa loyihaga tegishli, o'chirilgan yoki hudud/hisob cheklovi bor. Google xabariga qarang.",
  404: "Bunday model topilmadi yoki bu kalit uchun ochiq emas.",
  429: "Bepul chegara (daqiqa/kun) tugagan. Biroz kuting yoki to'lovli rejimga o'ting.",
  500: "Google tomonida vaqtincha xato.",
  503: "Model band (Google tomoni). Zaxira model buni qoplaydi.",
};

async function probe(model: string): Promise<boolean> {
  const url = `${config.GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key! },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Salom! Bitta so'z bilan javob ber: ok" }] }] }),
      signal: AbortSignal.timeout(30_000),
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      console.log(`  OK    ${model}  (${ms} ms)  javob: ${JSON.stringify(text.slice(0, 40))}`);
      return true;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    const msg = (body.error?.message ?? "").replace(key!, "***").slice(0, 220);
    console.log(`  XATO  ${model}  status ${res.status} ${body.error?.status ?? ""}`);
    if (msg) console.log(`        Google: ${msg}`);
    console.log(`        Maslahat: ${HINTS[res.status] ?? "Noma'lum xato."}`);
    return false;
  } catch (e) {
    console.log(`  XATO  ${model}  tarmoq: ${e instanceof Error ? e.name : "noma'lum"} (Google'ga ulanib bo'lmadi yoki vaqt tugadi)`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log("DODA: AI aloqasini tekshirish");
  if (!key) {
    console.log("  XATO  GEMINI_API_KEY .env faylida YO'Q (yoki bo'sh). Chat shu sababli ishlamaydi.");
    console.log("        Qilinadigan ish: https://aistudio.google.com/apikey dan kalit oling, serverda .env ga GEMINI_API_KEY=... qo'shing, install.sh ni qayta ishga tushiring.");
    process.exit(2);
  }
  console.log(`  Kalit bor (uzunligi ${key.length} belgi, odatda ~39).`);
  const models = [...new Set([config.GEMINI_MODEL_LIGHT, config.GEMINI_MODEL_MAIN, config.GEMINI_MODEL_STT])];
  const results: boolean[] = [];
  for (const m of models) results.push(await probe(m));
  if (results.every(Boolean)) console.log("Natija: HAMMASI ISHLAYAPTI.");
  else if (results.some(Boolean)) console.log("Natija: ba'zi modellar ishlamayapti; ishlayotganlari zaxira sifatida ishlatiladi.");
  else console.log("Natija: AI ishlamayapti. Yuqoridagi XATO qatorlarini yuboring.");
  process.exit(results.some(Boolean) ? 0 : 1);
}

void main();

/** AI aloqasini tekshiradi: qaysi provayderlarning kaliti bor, har bir model javob beradimi. Kalitni CHIQARMAYDI.
 *  Ishga tushirish: docker exec doda-server node dist/diagnose.js */
import { loadConfig } from "./config.js";

const config = loadConfig();

const HINTS: Record<number, string> = {
  400: "So'rov noto'g'ri yoki hudud qo'llab-quvvatlanmaydi. Google/provayder xabariga qarang.",
  401: "Kalit qabul qilinmadi. Provayder sahifasida yangi kalit oling va .env dagi qiymatni almashtiring.",
  402: "To'lov kerak: hisobda mablag' yo'q yoki to'lov usuli ulanmagan.",
  403: "Ruxsat yo'q: kalit o'chirilgan, hudud/hisob cheklovi bor yoki to'lov ulanmagan.",
  404: "Bunday model topilmadi yoki bu kalit uchun ochiq emas.",
  429: "Chegara tugagan (bepul kvota yoki to'lov limiti). Biroz kuting yoki hisobni to'ldiring.",
  500: "Provayder tomonida vaqtincha xato.",
  503: "Model band (provayder tomoni).",
};

interface Probe { model: string; ok: boolean }

async function call(label: string, model: string, req: () => Promise<Response>, pickText: (j: any) => string, key: string): Promise<boolean> {
  const t0 = Date.now();
  try {
    const res = await req();
    const ms = Date.now() - t0;
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      console.log(`    OK    ${model}  (${ms} ms)  javob: ${JSON.stringify(pickText(j).trim().slice(0, 40))}`);
      return true;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string; type?: string } };
    const msg = (body.error?.message ?? "").split(key).join("***").slice(0, 220);
    console.log(`    XATO  ${model}  status ${res.status} ${body.error?.status ?? body.error?.type ?? ""}`);
    if (msg) console.log(`          ${label}: ${msg}`);
    console.log(`          Maslahat: ${HINTS[res.status] ?? "Noma'lum xato."}`);
    return false;
  } catch (e) {
    console.log(`    XATO  ${model}  tarmoq: ${e instanceof Error ? e.name : "noma'lum"} (ulanib bo'lmadi yoki vaqt tugadi)`);
    return false;
  }
}

const sig = () => AbortSignal.timeout(30_000);

async function gemini(): Promise<Probe[]> {
  const key = config.GEMINI_API_KEY!;
  const models = [...new Set([config.GEMINI_MODEL_LIGHT, config.GEMINI_MODEL_MAIN, config.GEMINI_MODEL_STT])];
  const out: Probe[] = [];
  for (const m of models)
    out.push({
      model: m,
      ok: await call("Google", m, () => fetch(`${config.GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Salom! Bitta so'z bilan javob ber: ok" }] }] }), signal: sig(),
      }), (j) => (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join(""), key),
    });
  return out;
}

async function anthropic(): Promise<Probe[]> {
  const key = config.ANTHROPIC_API_KEY!;
  const out: Probe[] = [];
  for (const m of [config.ANTHROPIC_MODEL_LIGHT, config.ANTHROPIC_MODEL_MAIN])
    out.push({
      model: m,
      ok: await call("Anthropic", m, () => fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: m, max_tokens: 64, messages: [{ role: "user", content: "Salom! Bitta so'z bilan javob ber: ok" }] }), signal: sig(),
      }), (j) => (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(""), key),
    });
  return out;
}

async function openai(): Promise<Probe[]> {
  const key = config.OPENAI_API_KEY!;
  const out: Probe[] = [];
  for (const m of [config.OPENAI_MODEL_LIGHT, config.OPENAI_MODEL_MAIN])
    out.push({
      model: m,
      ok: await call("OpenAI", m, () => fetch(`${config.OPENAI_BASE_URL}/v1/responses`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: m, input: "Salom! Bitta so'z bilan javob ber: ok", max_output_tokens: 64, store: false, reasoning: { effort: "low" } }), signal: sig(),
      }), (j) => (j.output ?? []).filter((o: { type: string }) => o.type === "message").flatMap((o: { content?: Array<{ text?: string }> }) => o.content ?? []).map((c: { text?: string }) => c.text ?? "").join(""), key),
    });
  return out;
}

async function main(): Promise<void> {
  console.log("DODA: AI aloqasini tekshirish");
  const order = [...new Set([...config.LLM_PRIORITY.split(",").map((x) => x.trim()), "gemini", "anthropic", "openai"])];
  const defs: Record<string, { title: string; key?: string; run: () => Promise<Probe[]>; env: string }> = {
    gemini: { title: "Gemini (Google)", key: config.GEMINI_API_KEY, run: gemini, env: "GEMINI_API_KEY" },
    anthropic: { title: "Claude (Anthropic)", key: config.ANTHROPIC_API_KEY, run: anthropic, env: "ANTHROPIC_API_KEY" },
    openai: { title: "OpenAI", key: config.OPENAI_API_KEY, run: openai, env: "OPENAI_API_KEY" },
  };
  const working: string[] = [];
  let any = false;
  for (const name of order) {
    const d = defs[name];
    if (!d) continue;
    if (!d.key) { console.log(`  ${d.title}: O'CHIQ (${d.env} yo'q)`); continue; }
    any = true;
    console.log(`  ${d.title}: YOQILGAN (kalit uzunligi ${d.key.length})`);
    const r = await d.run();
    if (r.some((x) => x.ok)) working.push(d.title);
  }
  if (!any) {
    console.log("Natija: hech bir kalit yo'q. .env ga GEMINI_API_KEY, ANTHROPIC_API_KEY yoki OPENAI_API_KEY dan kamida bittasini qo'shing.");
    process.exit(2);
  }
  console.log(working.length ? `Natija: ishlayotgan provayderlar: ${working.join(", ")}. Qolganlari o'chiq turadi, DODA o'zi ishlayotganini tanlaydi.` : "Natija: AI ishlamayapti. Yuqoridagi XATO qatorlarini yuboring.");
  process.exit(working.length ? 0 : 1);
}

void main();

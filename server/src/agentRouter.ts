/**
 * DODA marshrutizatori (AI siz): topshiriq matniga qarab mos agentni tanlaydi.
 * Ball: rol kalit so'zlari (suffikslardan qat'i nazar, 5 harfli o'zak), tanlangan imkoniyatlar va agent nomi/roli.
 * AI ulangach, bu qoida-asosli bosqich aniqroq tanlovga zaxira sifatida qoladi.
 */
import { catalogFor, recommendedIds, suggestTemplate, templateScores } from "./catalog.js";

export interface RouteAgent {
  id: string;
  template: string | null;
  name: string;
  role: string;
  capabilities: string[];
  custom: Array<{ group: string; text: string }>;
}

const STOP = new Set([
  "uchun", "bilan", "kerak", "qilib", "bering", "iltimos", "menga", "bizga", "qiling", "qilish", "haqida", "boyicha", "bo'yicha", "yoki", "ham", "bir", "shu", "bu", "va", "bor", "yoq",
  "для", "надо", "нужно", "мне", "нам", "сделай", "сделать", "пожалуйста", "или", "это", "что", "как", "по", "на", "про", "и", "в", "с",
]);

/** So'zlarni 5 harfli o'zakka keltiradi (uzbekcha/ruscha qo'shimchalarga chidamli, oddiy usul) */
export function stems(text: string): string[] {
  const words = text.toLowerCase().replace(/[‘’`ʻ]/g, "'").split(/[^\p{L}\p{N}']+/u).filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words.map((w) => w.slice(0, 5)))];
}

export interface Route {
  /** Eng mos mavjud agent (yetarli ball bo'lsa) */
  match: { agentId: string; name: string; score: number; confidence: "high" | "low"; reasons: string[] } | null;
  alternatives: Array<{ agentId: string; name: string; score: number }>;
  /** Mos agent yo'q: yaratishni tavsiya qilish */
  create: { template: string; recommended: string[] } | null;
}

export function routeRequest(text: string, agents: RouteAgent[], lang: "uz" | "ru" = "uz"): Route {
  const req = stems(text);
  const hints = templateScores(text);
  const scored = agents.map((a) => {
    const cat = catalogFor(a.template);
    const chosen = new Set(a.capabilities);
    const caps = cat.groups.flatMap((g) => g.items).filter((i) => chosen.has(i.id));
    const own = new Set(stems(`${a.name} ${a.role}`));
    const capStems = new Set(caps.flatMap((i) => stems(`${i.label.uz} ${i.label.ru} ${i.desc.uz}`)));
    for (const c of a.custom) for (const s of stems(c.text)) capStems.add(s);
    const reasons: string[] = [];
    let score = 0;
    for (const w of req) {
      if (own.has(w)) { score += 2; reasons.push(w); }
      else if (capStems.has(w)) { score += 1; reasons.push(w); }
    }
    const hint = a.template ? hints[a.template] ?? 0 : 0;
    if (hint > 0) { score += hint * 2; reasons.push(`rol:${a.template}`); }
    return { a, score, reasons };
  }).sort((x, y) => y.score - x.score);

  const best = scored[0];
  const second = scored[1];
  const MIN = 2;
  // Matn aniq boshqa rolga ishora qilsa (ikki va undan ortiq kalit so'z) va shu rol agenti yo'q bo'lsa, tasodifiy umumiy so'z moslashuvi emas, yangi agent tavsiya qilinadi
  const [topId, topScore] = Object.entries(hints).sort((x, y) => y[1] - x[1])[0] ?? ["general", 0];
  if (topScore >= 2 && !agents.some((a) => a.template === topId) && (!best || (best.a.template ? hints[best.a.template] ?? 0 : 0) === 0)) {
    return { match: null, alternatives: [], create: { template: topId, recommended: recommendedIds(catalogFor(topId)) } };
  }
  if (best && best.score >= MIN) {
    const confident = best.score >= 4 && (!second || best.score - second.score >= 2);
    return {
      match: { agentId: best.a.id, name: best.a.name, score: best.score, confidence: confident ? "high" : "low", reasons: best.reasons.slice(0, 6) },
      alternatives: scored.slice(1, 3).filter((x) => x.score >= MIN).map((x) => ({ agentId: x.a.id, name: x.a.name, score: x.score })),
      create: null,
    };
  }
  void lang;
  // Mos agent yo'q: matn aniq bir rolga o'xshasa, yaratishni taklif qilamiz
  const t = suggestTemplate(text);
  if (t !== "general" && !agents.some((a) => a.template === t)) return { match: null, alternatives: [], create: { template: t, recommended: recommendedIds(catalogFor(t)) } };
  return { match: null, alternatives: [], create: null };
}

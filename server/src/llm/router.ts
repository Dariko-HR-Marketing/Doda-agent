export type Tier = "light" | "main";

const HEAVY = [
  "reja", "tahlil", "hujjat", "shartnoma", "yoz ", "tuz ", "strategiya", "kod", "dastur", "hisobla", "solishtir", "taqqosla", "xulosa", "jadval", "maqola", "taqdimot",
  "анализ", "план", "договор", "напиши", "составь", "код", "сравни", "стратег", "таблиц", "отчёт", "отчет", "документ", "презентац",
];

/** Token tejash: oddiy va qisqa savollar arzon modelga, murakkablari asosiy modelga */
export function pickTier(message: string, historyCount: number): Tier {
  const m = message.toLowerCase();
  if (message.length > 400) return "main";
  if (message.includes("```")) return "main";
  if (HEAVY.some((k) => m.includes(k))) return "main";
  // Uzoq davom etayotgan suhbatda ham kontekst muhim
  if (historyCount > 12 && message.length > 150) return "main";
  return "light";
}

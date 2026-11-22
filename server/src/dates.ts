/** Sana yordamchilari (YYYY-MM-DD, vaqt zonasiga bog'liq emas) */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type Repeat = "none" | "daily" | "weekly" | "monthly";

/** Keyingi takror sanasi: kun +1, hafta +7, oy +1 (oy oxiriga moslanadi: 31-yanvar -> 28/29-fevral) */
export function nextDue(from: string, repeat: Repeat): string {
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  if (repeat === "daily" || repeat === "weekly") {
    const t = new Date(Date.UTC(y, m - 1, d + (repeat === "daily" ? 1 : 7)));
    return t.toISOString().slice(0, 10);
  }
  if (repeat === "monthly") {
    const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d, lastOfNext))).toISOString().slice(0, 10);
  }
  return from;
}

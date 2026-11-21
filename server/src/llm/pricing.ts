/** USD / 1M token. Manba: Google AI Studio narxlar sahifasi (2026-noyabr). Narx o'zgarsa, shu yerni yangilang. */
interface Price { in: number; out: number }

const JAN_2027 = Date.UTC(2027, 0, 1);

export function priceFor(model: string, now: number): Price {
  if (model.startsWith("gemini-3.5-flash-lite")) return { in: 0.3, out: 2.5 };
  if (model.startsWith("gemini-3.8-flash") || model.startsWith("gemini-3.6-flash")) {
    return now < JAN_2027 ? { in: 0.75, out: 3.75 } : { in: 1.5, out: 7.5 };
  }
  // Noma'lum model: ehtiyotkorlik bilan yuqoriroq baho (limit erta ishlasin)
  return { in: 2, out: 10 };
}

export function costUsd(model: string, tokensIn: number, tokensOut: number, now: number): number {
  const p = priceFor(model, now);
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}

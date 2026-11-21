/** Oddiy xotiradagi cheklov (bitta jarayon uchun yetarli; ko'p serverda Redis'ga o'tiladi) */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private now: () => number = Date.now) {}

  /** true = ruxsat; false = cheklov oshgan */
  take(key: string, limit: number, windowMs: number): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(windowMs);
    return true;
  }

  private prune(windowMs: number): void {
    const t = this.now();
    for (const [k, v] of this.hits) {
      if (v.every((x) => t - x >= windowMs)) this.hits.delete(k);
    }
  }
}

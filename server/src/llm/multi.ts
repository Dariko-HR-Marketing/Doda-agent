import { LlmHttpError, type LlmCompletion, type LlmEvent, type LlmMessage, type LlmProvider, type Tier } from "./types.js";

export type ProviderName = "gemini" | "anthropic" | "openai";

export interface Slot {
  name: ProviderName;
  provider: LlmProvider;
  models: { light: string; main: string; stt?: string };
}

/** Model identifikatoridan provayderni aniqlaydi */
export function providerOf(model: string): ProviderName | null {
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-")) return "openai";
  return null;
}

const AUTH = new Set([400, 401, 402, 403]);

/**
 * Bir nechta provayderni birlashtiradi. Kalit bor provayder yoqiladi, yo'qlari o'chiq.
 * Provayder kalit/hudud/to'lov xatosi (400-403) bersa, 10 daqiqa chetlab o'tiladi; kvota (429) bo'lsa 1 daqiqa.
 */
export class LlmRouter implements LlmProvider {
  private downUntil = new Map<ProviderName, number>();

  constructor(
    private slots: Slot[],
    private now: () => number = Date.now,
    private onFail?: (name: ProviderName, status: number) => void,
  ) {}

  enabled(): string[] {
    return this.slots.map((s) => s.name);
  }

  private healthy(s: Slot): boolean {
    return (this.downUntil.get(s.name) ?? 0) <= this.now();
  }

  /** Daraja uchun modellar ro'yxati: sog'lom provayderlar ustuvorlik tartibida; asosiy daraja arzonlari bilan zaxiralanadi */
  chain(tier: Tier): string[] {
    const pick = (t: Tier) => {
      const of = (list: Slot[]) =>
        list.map((s) => (t === "stt" ? s.models.stt : s.models[t])).filter((m): m is string => !!m);
      const ok = this.slots.filter((s) => this.healthy(s));
      const bad = this.slots.filter((s) => !this.healthy(s));
      return [...of(ok), ...of(bad)];
    };
    const out = tier === "main" ? [...pick("main"), ...pick("light")] : pick(tier);
    return [...new Set(out)];
  }

  private slotFor(model: string): Slot {
    const name = providerOf(model);
    const s = this.slots.find((x) => x.name === name);
    if (!s) throw new LlmHttpError(404);
    return s;
  }

  private note(s: Slot, e: unknown): void {
    if (!(e instanceof LlmHttpError)) return;
    this.onFail?.(s.name, e.status);
    if (AUTH.has(e.status)) this.downUntil.set(s.name, this.now() + 10 * 60_000);
    else if (e.status === 429) this.downUntil.set(s.name, this.now() + 60_000);
  }

  private ok(s: Slot): void {
    this.downUntil.delete(s.name);
  }

  async complete(p: { model: string; system: string; messages: LlmMessage[]; json?: boolean; signal?: AbortSignal }): Promise<LlmCompletion> {
    const s = this.slotFor(p.model);
    try {
      const r = await s.provider.complete(p);
      this.ok(s);
      return r;
    } catch (e) {
      this.note(s, e);
      throw e;
    }
  }

  async transcribe(p: { model: string; mime: string; data: string; lang: "uz" | "ru"; signal?: AbortSignal }): Promise<LlmCompletion> {
    const s = this.slotFor(p.model);
    try {
      const r = await s.provider.transcribe(p);
      this.ok(s);
      return r;
    } catch (e) {
      this.note(s, e);
      throw e;
    }
  }

  async *stream(p: { model: string; system: string; messages: LlmMessage[]; signal?: AbortSignal }): AsyncIterable<LlmEvent> {
    const s = this.slotFor(p.model);
    try {
      for await (const ev of s.provider.stream(p)) yield ev;
      this.ok(s);
    } catch (e) {
      this.note(s, e);
      throw e;
    }
  }
}

/** Chat/agent/vazifa marshrutlari uchun: modellar zanjiri va yakuniy xato turini aniqlash */
export interface ChainEnv {
  llm: LlmProvider;
  legacy: Record<Tier, string[]>;
}

export function chainFor(env: ChainEnv, tier: Tier): string[] {
  return env.llm.chain ? env.llm.chain(tier) : env.legacy[tier];
}

export function failureCode(statuses: number[]): "llm_rate_limited" | "llm_auth" | "llm_unavailable" {
  if (statuses.length && statuses.every((s) => AUTH.has(s) || s === 404 || s === 501)) return statuses.some((s) => AUTH.has(s)) ? "llm_auth" : "llm_unavailable";
  if (statuses.some((s) => s === 429)) return "llm_rate_limited";
  return "llm_unavailable";
}

/** Zanjir bo'ylab ketma-ket urinadi. Birinchi muvaffaqiyatli natija va ishlatilgan model qaytariladi. */
export async function runChain<T>(chain: string[], fn: (model: string) => Promise<T>, signal?: AbortSignal): Promise<{ result: T; model: string }> {
  const statuses: number[] = [];
  for (const model of chain) {
    try {
      return { result: await fn(model), model };
    } catch (e) {
      if (signal?.aborted) throw e;
      statuses.push(e instanceof LlmHttpError ? e.status : 0);
      console.error(`[llm] ${model} xato: status ${statuses[statuses.length - 1]}`);
    }
  }
  throw new ChainError(failureCode(statuses), statuses);
}

export class ChainError extends Error {
  constructor(
    public code: "llm_rate_limited" | "llm_auth" | "llm_unavailable",
    public statuses: number[],
  ) {
    super(`llm chain failed: ${statuses.join(",")}`);
    this.name = "ChainError";
  }
}

export function legacyChain(c: { GEMINI_MODEL_LIGHT: string; GEMINI_MODEL_MAIN: string; GEMINI_MODEL_STT: string }): Record<Tier, string[]> {
  return { light: [c.GEMINI_MODEL_LIGHT], main: [c.GEMINI_MODEL_MAIN, c.GEMINI_MODEL_LIGHT], stt: [c.GEMINI_MODEL_STT, c.GEMINI_MODEL_MAIN] };
}

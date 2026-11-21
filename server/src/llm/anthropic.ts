import Anthropic from "@anthropic-ai/sdk";
import { LlmHttpError, type LlmCompletion, type LlmEvent, type LlmMessage, type LlmProvider } from "./types.js";

/** Claude (rasmiy SDK). Ovozni matnga aylantirish yo'q: bu Gemini yoki OpenAI vazifasi. */
export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;

  constructor(apiKey: string, fetchFn: typeof fetch = fetch, timeoutMs = 90_000, baseURL?: string) {
    this.client = new Anthropic({ apiKey, fetch: fetchFn, timeout: timeoutMs, maxRetries: 1, ...(baseURL ? { baseURL } : {}) });
  }

  /** Tez/arzon (Haiku) uchun past, asosiy uchun o'rta fikrlash chuqurligi: token va kutish tejaladi */
  private effort(model: string): "low" | "medium" {
    return model.includes("haiku") ? "low" : "medium";
  }

  private wrap(e: unknown): never {
    if (e instanceof Anthropic.APIError) throw new LlmHttpError(typeof e.status === "number" ? e.status : 0);
    throw e;
  }

  private body(model: string, system: string, messages: LlmMessage[], maxTokens: number) {
    return {
      model,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: { effort: this.effort(model) },
    };
  }

  async complete(p: { model: string; system: string; messages: LlmMessage[]; json?: boolean; signal?: AbortSignal }): Promise<LlmCompletion> {
    try {
      const r = await this.client.messages.create(this.body(p.model, p.system, p.messages, 4096), { signal: p.signal });
      const text = r.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
      return { text, tokensIn: r.usage.input_tokens + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0), tokensOut: r.usage.output_tokens };
    } catch (e) {
      return this.wrap(e);
    }
  }

  transcribe(): Promise<LlmCompletion> {
    return Promise.reject(new LlmHttpError(501));
  }

  async *stream(p: { model: string; system: string; messages: LlmMessage[]; signal?: AbortSignal }): AsyncIterable<LlmEvent> {
    try {
      const s = this.client.messages.stream(this.body(p.model, p.system, p.messages, 8192), { signal: p.signal });
      for await (const ev of s) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield { type: "delta", text: ev.delta.text };
      }
      const f = await s.finalMessage();
      yield { type: "usage", tokensIn: f.usage.input_tokens + (f.usage.cache_read_input_tokens ?? 0) + (f.usage.cache_creation_input_tokens ?? 0), tokensOut: f.usage.output_tokens };
    } catch (e) {
      this.wrap(e);
    }
  }
}

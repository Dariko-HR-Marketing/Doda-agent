import { LlmHttpError, type LlmCompletion, type LlmEvent, type LlmMessage, type LlmProvider } from "./types.js";

interface GeminiChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string };
}

/** Gemini REST (streamGenerateContent, alt=sse). Kalit faqat sarlavhada yuboriladi, logga/xatoga yozilmaydi. */
export class GeminiProvider implements LlmProvider {
  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch = fetch,
    private timeoutMs = 90_000,
    private baseUrl = "https://generativelanguage.googleapis.com",
  ) {}

  async complete(p: { model: string; system: string; messages: LlmMessage[]; json?: boolean; signal?: AbortSignal }): Promise<LlmCompletion> {
    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(p.model)}:generateContent`;
    const signals = [AbortSignal.timeout(this.timeoutMs), ...(p.signal ? [p.signal] : [])];
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents: p.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        ...(p.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
      signal: AbortSignal.any(signals),
    });
    if (!res.ok) throw new LlmHttpError(res.status);
    const j = (await res.json()) as GeminiChunk;
    const text = (j.candidates?.[0]?.content?.parts ?? []).filter((x) => x.text && !x.thought).map((x) => x.text).join("");
    const u = j.usageMetadata;
    return { text, tokensIn: u?.promptTokenCount ?? 0, tokensOut: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) };
  }

  async *stream(p: { model: string; system: string; messages: LlmMessage[]; signal?: AbortSignal }): AsyncIterable<LlmEvent> {
    const url = `${this.baseUrl}/v1beta/models/${encodeURIComponent(p.model)}:streamGenerateContent?alt=sse`;
    const signals = [AbortSignal.timeout(this.timeoutMs), ...(p.signal ? [p.signal] : [])];
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.system }] },
        contents: p.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      }),
      signal: AbortSignal.any(signals),
    });
    if (!res.ok || !res.body) throw new LlmHttpError(res.status);

    let tokensIn = 0;
    let tokensOut = 0;
    const decoder = new TextDecoder();
    let buf = "";
    const reader = res.body.getReader();

    const handle = function* (data: string): Generator<LlmEvent> {
      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(data) as GeminiChunk;
      } catch {
        return;
      }
      if (chunk.error) throw new Error(`gemini error: ${chunk.error.message ?? "unknown"}`.slice(0, 200));
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) yield { type: "delta", text: part.text };
      }
      const u = chunk.usageMetadata;
      if (u) {
        tokensIn = u.promptTokenCount ?? tokensIn;
        // fikrlash (thinking) tokenlari ham chiqish tokeni sifatida hisoblanadi
        tokensOut = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || tokensOut;
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (line.startsWith("data:")) yield* handle(line.slice(5).trim());
        }
      }
      const rest = buf.trim();
      if (rest.startsWith("data:")) yield* handle(rest.slice(5).trim());
    } finally {
      reader.releaseLock?.();
    }
    yield { type: "usage", tokensIn, tokensOut };
  }
}

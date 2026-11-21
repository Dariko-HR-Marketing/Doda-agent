import { LlmHttpError, type LlmCompletion, type LlmEvent, type LlmMessage, type LlmProvider } from "./types.js";

interface ResponsesBody {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** OpenAI Responses API (fetch). Ovozni matnga aylantirish: /v1/audio/transcriptions */
export class OpenAIProvider implements LlmProvider {
  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch = fetch,
    private timeoutMs = 90_000,
    private baseUrl = "https://api.openai.com",
  ) {}

  private headers(json = true): Record<string, string> {
    return { authorization: `Bearer ${this.apiKey}`, ...(json ? { "content-type": "application/json" } : {}) };
  }

  private payload(p: { model: string; system: string; messages: LlmMessage[]; json?: boolean }, stream: boolean) {
    return {
      model: p.model,
      instructions: p.system,
      input: p.messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
      store: false,
      reasoning: { effort: "low" },
      ...(p.json ? { text: { format: { type: "json_object" } } } : {}),
    };
  }

  async complete(p: { model: string; system: string; messages: LlmMessage[]; json?: boolean; signal?: AbortSignal }): Promise<LlmCompletion> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/responses`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.payload(p, false)),
      signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(p.signal ? [p.signal] : [])]),
    });
    if (!res.ok) throw new LlmHttpError(res.status);
    const j = (await res.json()) as ResponsesBody;
    const text = (j.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
    return { text, tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
  }

  async *stream(p: { model: string; system: string; messages: LlmMessage[]; signal?: AbortSignal }): AsyncIterable<LlmEvent> {
    const res = await this.fetchFn(`${this.baseUrl}/v1/responses`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.payload(p, true)),
      signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(p.signal ? [p.signal] : [])]),
    });
    if (!res.ok || !res.body) throw new LlmHttpError(res.status);
    const decoder = new TextDecoder();
    let buf = "";
    let tin = 0;
    let tout = 0;
    let failed = false;
    const reader = res.body.getReader();
    const handle = function* (data: string): Generator<LlmEvent> {
      let j: { type?: string; delta?: string; response?: ResponsesBody & { status?: string } };
      try {
        j = JSON.parse(data);
      } catch {
        return;
      }
      if (j.type === "response.output_text.delta" && typeof j.delta === "string" && j.delta) yield { type: "delta", text: j.delta };
      else if (j.type === "response.completed" || j.type === "response.incomplete") {
        tin = j.response?.usage?.input_tokens ?? tin;
        tout = j.response?.usage?.output_tokens ?? tout;
      } else if (j.type === "response.failed" || j.type === "error") failed = true;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buf.search(/\r?\n\r?\n/)) !== -1) {
        const block = buf.slice(0, i);
        buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
        const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (data && data !== "[DONE]") yield* handle(data);
      }
    }
    if (failed) throw new LlmHttpError(502);
    yield { type: "usage", tokensIn: tin, tokensOut: tout };
  }

  async transcribe(p: { model: string; mime: string; data: string; lang: "uz" | "ru"; signal?: AbortSignal }): Promise<LlmCompletion> {
    const ext = p.mime.includes("mp4") || p.mime.includes("m4a") ? "m4a" : p.mime.includes("ogg") ? "ogg" : p.mime.includes("wav") ? "wav" : p.mime.includes("mpeg") ? "mp3" : "webm";
    const bytes = Buffer.from(p.data, "base64");
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: p.mime }), `audio.${ext}`);
    form.append("model", p.model);
    form.append("language", p.lang);
    form.append("response_format", "json");
    const res = await this.fetchFn(`${this.baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: this.headers(false),
      body: form,
      signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(p.signal ? [p.signal] : [])]),
    });
    if (!res.ok) throw new LlmHttpError(res.status);
    const j = (await res.json()) as { text?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    return { text: j.text ?? "", tokensIn: j.usage?.input_tokens ?? Math.ceil(bytes.length / 160), tokensOut: j.usage?.output_tokens ?? Math.ceil((j.text ?? "").length / 3) };
  }
}

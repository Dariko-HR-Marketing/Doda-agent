import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../src/llm/anthropic.js";
import { OpenAIProvider } from "../src/llm/openai.js";
import { ChainError, LlmRouter, failureCode, providerOf, runChain, type Slot } from "../src/llm/multi.js";
import { costUsd } from "../src/llm/pricing.js";
import { LlmHttpError, type LlmEvent, type LlmProvider } from "../src/llm/types.js";

const sse = (events: Array<[string, unknown]>) => events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const stream = (text: string) => new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });

describe("Claude provayderi (rasmiy SDK)", () => {
  const msg = (text: string) => ({ id: "m1", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 11, output_tokens: 7 } });

  it("complete: matn, token, sarlavhalar va past fikrlash chuqurligi", async () => {
    let seen: { url: string; headers: Headers; body: any } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, headers: new Headers(init.headers), body: JSON.parse(init.body as string) };
      return json(200, msg("Salom!"));
    }) as unknown as typeof fetch;
    const p = new AnthropicProvider("sk-ant-test", f);
    const r = await p.complete({ model: "claude-haiku-5-5", system: "Sen DODA", messages: [{ role: "user", content: "Salom" }] });
    expect(r).toEqual({ text: "Salom!", tokensIn: 11, tokensOut: 7 });
    expect(seen!.url).toContain("/v1/messages");
    expect(seen!.headers.get("authorization") ?? seen!.headers.get("x-api-key")).toContain("sk-ant-test");
    expect(seen!.body).toMatchObject({ model: "claude-haiku-5-5", system: "Sen DODA", output_config: { effort: "low" } });
    expect(seen!.body.temperature).toBeUndefined();
  });

  it("asosiy model o'rta chuqurlik bilan chaqiriladi", async () => {
    let body: any;
    const f = (async (_u: string, init: RequestInit) => { body = JSON.parse(init.body as string); return json(200, msg("x")); }) as unknown as typeof fetch;
    await new AnthropicProvider("k", f).complete({ model: "claude-sonnet-5-5", system: "s", messages: [{ role: "user", content: "a" }] });
    expect(body.output_config.effort).toBe("medium");
  });

  it("stream: bo'laklar va usage", async () => {
    const body = sse([
      ["message_start", { type: "message_start", message: { ...msg(""), content: [], usage: { input_tokens: 20, output_tokens: 1 } } }],
      ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
      ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Sal" } }],
      ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "om" } }],
      ["content_block_stop", { type: "content_block_stop", index: 0 }],
      ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } }],
      ["message_stop", { type: "message_stop" }],
    ]);
    const f = (async () => stream(body)) as unknown as typeof fetch;
    const evs: LlmEvent[] = [];
    for await (const e of new AnthropicProvider("k", f).stream({ model: "claude-haiku-5-5", system: "s", messages: [{ role: "user", content: "a" }] })) evs.push(e);
    expect(evs.filter((e) => e.type === "delta").map((e: any) => e.text).join("")).toBe("Salom");
    expect(evs.at(-1)).toEqual({ type: "usage", tokensIn: 20, tokensOut: 5 });
  });

  it("HTTP xatolari LlmHttpError ga aylanadi; ovoz qo'llab-quvvatlanmaydi", async () => {
    const f = (async () => json(401, { type: "error", error: { type: "authentication_error", message: "bad" } })) as unknown as typeof fetch;
    const p = new AnthropicProvider("k", f);
    await expect(p.complete({ model: "claude-haiku-5-5", system: "s", messages: [{ role: "user", content: "a" }] })).rejects.toMatchObject({ status: 401 });
    await expect(p.transcribe()).rejects.toMatchObject({ status: 501 });
  });
});

describe("OpenAI provayderi", () => {
  it("complete: Responses API, JSON rejimi, token", async () => {
    let seen: { url: string; auth: string | null; body: any } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(init.body as string) };
      return json(200, { output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: '{"a":1}' }] }], usage: { input_tokens: 9, output_tokens: 4 } });
    }) as unknown as typeof fetch;
    const r = await new OpenAIProvider("sk-oa", f).complete({ model: "gpt-6-luna", system: "SYS", messages: [{ role: "user", content: "hi" }], json: true });
    expect(r).toEqual({ text: '{"a":1}', tokensIn: 9, tokensOut: 4 });
    expect(seen!.url).toBe("https://api.openai.com/v1/responses");
    expect(seen!.auth).toBe("Bearer sk-oa");
    expect(seen!.body).toMatchObject({ model: "gpt-6-luna", instructions: "SYS", stream: false, store: false, text: { format: { type: "json_object" } } });
  });

  it("stream: oqim bo'laklari va usage", async () => {
    const body = sse([
      ["response.output_text.delta", { type: "response.output_text.delta", delta: "Sal" }],
      ["response.output_text.delta", { type: "response.output_text.delta", delta: "om" }],
      ["response.completed", { type: "response.completed", response: { usage: { input_tokens: 30, output_tokens: 6 } } }],
    ]);
    const f = (async () => stream(body)) as unknown as typeof fetch;
    const evs: LlmEvent[] = [];
    for await (const e of new OpenAIProvider("k", f).stream({ model: "gpt-6-luna", system: "s", messages: [{ role: "user", content: "a" }] })) evs.push(e);
    expect(evs.filter((e) => e.type === "delta").map((e: any) => e.text).join("")).toBe("Salom");
    expect(evs.at(-1)).toEqual({ type: "usage", tokensIn: 30, tokensOut: 6 });
  });

  it("xato statuslari va ovoz (multipart)", async () => {
    const bad = (async () => json(403, { error: { message: "no" } })) as unknown as typeof fetch;
    await expect(new OpenAIProvider("k", bad).complete({ model: "gpt-6-luna", system: "s", messages: [{ role: "user", content: "a" }] })).rejects.toMatchObject({ status: 403 });
    let form: FormData | null = null;
    const f = (async (_u: string, init: RequestInit) => { form = init.body as FormData; return json(200, { text: "salom dunyo" }); }) as unknown as typeof fetch;
    const r = await new OpenAIProvider("k", f).transcribe({ model: "gpt-transcribe", mime: "audio/webm", data: Buffer.alloc(800, 1).toString("base64"), lang: "uz" });
    expect(r.text).toBe("salom dunyo");
    expect(form!.get("model")).toBe("gpt-transcribe");
    expect(form!.get("language")).toBe("uz");
    expect((form!.get("file") as File).name).toBe("audio.webm");
  });
});

function fakeProvider(opts: { fail?: number; text?: string; stt?: boolean } = {}): LlmProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async complete(p) { calls.push("complete:" + p.model); if (opts.fail) throw new LlmHttpError(opts.fail); return { text: opts.text ?? "ok", tokensIn: 1, tokensOut: 1 }; },
    async transcribe(p) { calls.push("stt:" + p.model); if (opts.fail) throw new LlmHttpError(opts.fail); return { text: "matn", tokensIn: 1, tokensOut: 1 }; },
    stream(p) { calls.push("stream:" + p.model); return (async function* (): AsyncIterable<LlmEvent> { if (opts.fail) throw new LlmHttpError(opts.fail); yield { type: "delta", text: "x" }; yield { type: "usage", tokensIn: 1, tokensOut: 1 }; })(); },
  };
}

const slot = (name: Slot["name"], provider: LlmProvider, stt = true): Slot => ({
  name, provider, models: { light: `${name === "gemini" ? "gemini-l" : name === "anthropic" ? "claude-l" : "gpt-l"}`, main: `${name === "gemini" ? "gemini-m" : name === "anthropic" ? "claude-m" : "gpt-m"}`, ...(stt ? { stt: `${name === "gemini" ? "gemini" : "gpt"}-stt` } : {}) },
});

describe("LlmRouter: ko'p provayderli marshrutlash", () => {
  it("model nomidan provayder aniqlanadi", () => {
    expect([providerOf("gemini-3.5-flash-lite"), providerOf("claude-haiku-5-5"), providerOf("gpt-6-luna"), providerOf("llama")]).toEqual(["gemini", "anthropic", "openai", null]);
  });

  it("zanjir: ustuvorlik tartibi; asosiy daraja arzon modellar bilan zaxiralanadi", () => {
    const r = new LlmRouter([slot("anthropic", fakeProvider(), false), slot("gemini", fakeProvider())]);
    expect(r.chain("light")).toEqual(["claude-l", "gemini-l"]);
    expect(r.chain("main")).toEqual(["claude-m", "gemini-m", "claude-l", "gemini-l"]);
    expect(r.chain("stt")).toEqual(["gemini-stt"]);
    expect(r.enabled()).toEqual(["anthropic", "gemini"]);
  });

  it("kalit/hudud xatosi (400-403) provayderni 10 daqiqaga chetlaydi, keyin qaytaradi", async () => {
    let t = 1_000_000;
    const g = fakeProvider({ fail: 400 });
    const r = new LlmRouter([slot("gemini", g), slot("anthropic", fakeProvider(), false)], () => t);
    await expect(r.complete({ model: "gemini-l", system: "s", messages: [] })).rejects.toMatchObject({ status: 400 });
    expect(r.chain("light")).toEqual(["claude-l", "gemini-l"]);
    t += 11 * 60_000;
    expect(r.chain("light")).toEqual(["gemini-l", "claude-l"]);
  });

  it("kvota (429) 1 daqiqaga chetlaydi; muvaffaqiyat holatni tiklaydi", async () => {
    let t = 0;
    let fail = 429;
    const p: LlmProvider = { async complete() { if (fail) throw new LlmHttpError(fail); return { text: "ok", tokensIn: 0, tokensOut: 0 }; }, transcribe: async () => ({ text: "", tokensIn: 0, tokensOut: 0 }), stream: fakeProvider().stream };
    const r = new LlmRouter([slot("openai", p), slot("gemini", fakeProvider())], () => t);
    await expect(r.complete({ model: "gpt-l", system: "s", messages: [] })).rejects.toBeInstanceOf(LlmHttpError);
    expect(r.chain("light")[0]).toBe("gemini-l");
    t += 61_000; fail = 0;
    await r.complete({ model: "gpt-l", system: "s", messages: [] });
    expect(r.chain("light")[0]).toBe("gpt-l");
  });

  it("runChain: keyingi provayderga o'tadi; hammasi yiqilsa tur bo'yicha xato", async () => {
    const out = await runChain(["a", "b"], async (m) => { if (m === "a") throw new LlmHttpError(403); return m; });
    expect(out).toEqual({ result: "b", model: "b" });
    await expect(runChain(["a", "b"], async () => { throw new LlmHttpError(403); })).rejects.toMatchObject({ code: "llm_auth" });
    await expect(runChain(["a", "b"], async (m) => { throw new LlmHttpError(m === "a" ? 403 : 429); })).rejects.toMatchObject({ code: "llm_rate_limited" });
    await expect(runChain(["a"], async () => { throw new Error("tarmoq"); })).rejects.toBeInstanceOf(ChainError);
    expect(failureCode([])).toBe("llm_unavailable");
    expect(failureCode([404, 501])).toBe("llm_unavailable");
    expect(failureCode([403, 501])).toBe("llm_auth");
  });

  it("narxlar: Claude va OpenAI modellari ma'lum, noma'lum model ehtiyotkorona", () => {
    const now = Date.UTC(2026, 10, 21);
    expect(costUsd("claude-haiku-5-5", 1_000_000, 1_000_000, now)).toBeCloseTo(0.6);
    expect(costUsd("claude-sonnet-5-5", 1_000_000, 1_000_000, now)).toBeCloseTo(12);
    expect(costUsd("gpt-6-luna", 1_000_000, 1_000_000, now)).toBeCloseTo(0.6);
    expect(costUsd("gpt-6.2-sol", 1_000_000, 0, now)).toBeCloseTo(2);
    expect(costUsd("nomalum-model", 1_000_000, 0, now)).toBeCloseTo(2);
  });
});

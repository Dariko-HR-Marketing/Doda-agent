export type ChatRole = "user" | "assistant";

export interface LlmMessage {
  role: ChatRole;
  content: string;
}

export type LlmEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; tokensIn: number; tokensOut: number };

export interface LlmProvider {
  /** Javobni oqim bilan qaytaradi; oxirida 'usage' hodisasi */
  stream(p: { model: string; system: string; messages: LlmMessage[]; signal?: AbortSignal }): AsyncIterable<LlmEvent>;
}

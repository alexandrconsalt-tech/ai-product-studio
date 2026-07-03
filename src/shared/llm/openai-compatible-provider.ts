import { LLMProviderError, type LLMCompletionRequest, type LLMCompletionResult, type LLMProvider } from "./types";

export type OpenAiCompatibleConfig = Readonly<{
  /** Human-readable label, e.g. "openai" or "anthropic-via-proxy". Purely diagnostic. */
  name: string;
  apiKey: string;
  baseUrl: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}>;

type ChatCompletionResponse = Readonly<{
  model: string;
  choices: readonly { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}>;

function mapFinishReason(reason: string | undefined): LLMCompletionResult["finishReason"] {
  if (reason === "length") return "length";
  return "stop";
}

/**
 * Real LLMProvider implementation calling an OpenAI-compatible chat
 * completions endpoint. This is the only file in this repository that
 * makes an outbound network call to an LLM provider, and it never
 * runs unless a caller explicitly constructs it with a real API key
 * (see provider-registry.ts -- nothing does this by default). No key
 * is hardcoded anywhere; CLAUDE.md §49 SEC-1 applies.
 */
export class OpenAiCompatibleProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAiCompatibleConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch (error) {
      // Network failure (DNS, connection refused, timeout) -- worth retrying.
      throw new LLMProviderError(`${this.name}: network error calling LLM provider.`, true, error);
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      // 429 (rate limit) and 5xx are transient; other 4xx are not.
      const retryable = response.status === 429 || response.status >= 500;
      const body = await response.text().catch(() => "");
      throw new LLMProviderError(`${this.name}: request failed with status ${response.status}. ${body}`.trim(), retryable);
    }

    let payload: ChatCompletionResponse;
    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      throw new LLMProviderError(`${this.name}: response was not valid JSON.`, false, error);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string") {
      throw new LLMProviderError(`${this.name}: response had no message content.`, false);
    }

    return {
      content,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      },
      latencyMs,
      model: payload.model ?? request.model,
      finishReason: mapFinishReason(choice?.finish_reason),
    };
  }
}

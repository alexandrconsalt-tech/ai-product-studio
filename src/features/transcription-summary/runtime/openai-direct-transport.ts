import type {
  ProviderErrorCategory,
  ProviderStructuredResponse,
  SafeProviderDiagnostic,
  StructuredOutputErrorCode,
  StructuredProviderTransport,
} from "./structured-output";

export const DEFAULT_AI_API_BASE_URL = "https://api.aitunnel.ru/v1";
export const OPENAI_CHAT_COMPLETIONS_ENDPOINT =
  `${DEFAULT_AI_API_BASE_URL}/chat/completions`;

const AITUNNEL_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "gpt-5-mini-2025-08-07": "gpt-5-mini",
};

type OpenAiFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type OpenAiEnvironment = Readonly<Record<string, string | undefined>>;

type OpenAiProviderError = Readonly<{
  type: string | null;
  code: string | null;
  param: string | null;
  message: string | null;
}>;

function configuredBaseUrl(environment: OpenAiEnvironment): string {
  const configured = environment.AI_API_BASE_URL ?? environment.OPENAI_BASE_URL;
  return (configured?.trim() || DEFAULT_AI_API_BASE_URL).replace(/\/+$/, "");
}

function chatCompletionsEndpoint(environment: OpenAiEnvironment): string {
  return `${configuredBaseUrl(environment)}/chat/completions`;
}

function providerModel(model: string, endpoint: string): string {
  let hostname = "";
  try {
    hostname = new URL(endpoint).hostname.toLowerCase();
  } catch {
    return model;
  }
  return hostname === "api.aitunnel.ru"
    ? AITUNNEL_MODEL_ALIASES[model] ?? model
    : model;
}

function environmentScope(
  environment: OpenAiEnvironment,
): SafeProviderDiagnostic["environmentScope"] {
  if (environment.VERCEL_ENV === "preview") return "preview";
  if (environment.VERCEL_ENV === "production") return "production";
  if (environment.NODE_ENV === "test") return "test";
  if (environment.NODE_ENV === "development") return "development";
  if (environment.NODE_ENV === "production") return "production";
  return "unknown";
}

export function redactProviderDiagnosticText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED_EMAIL]")
    .replace(/(?:\+?\d[\s()-]*){10,}/g, "[REDACTED_PHONE]")
    .slice(0, 500);
}

function providerError(payload: unknown): OpenAiProviderError {
  const error = payload
    && typeof payload === "object"
    && "error" in payload
    && payload.error
    && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : {};
  return {
    type: typeof error.type === "string" ? redactProviderDiagnosticText(error.type) : null,
    code: typeof error.code === "string" ? redactProviderDiagnosticText(error.code) : null,
    param: typeof error.param === "string" ? redactProviderDiagnosticText(error.param) : null,
    message: typeof error.message === "string"
      ? redactProviderDiagnosticText(error.message)
      : null,
  };
}

function providerRequestId(response: Response | null, payload: unknown): string | null {
  const header = response?.headers.get("x-request-id");
  if (header) return redactProviderDiagnosticText(header);
  if (payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string") {
    return redactProviderDiagnosticText(payload.id);
  }
  return null;
}

function classifyProviderError(input: {
  status: number;
  error: OpenAiProviderError;
}): {
  errorCode: StructuredOutputErrorCode;
  category: ProviderErrorCategory;
} {
  const combined = `${input.error.type ?? ""} ${input.error.code ?? ""} ${input.error.param ?? ""} ${input.error.message ?? ""}`.toLowerCase();
  if (input.status === 401 || input.status === 403) {
    return { errorCode: "OPENAI_AUTH_FAILED", category: "auth" };
  }
  if (input.status === 408 || input.status === 504) {
    return { errorCode: "OPENAI_TIMEOUT", category: "timeout" };
  }
  if (input.status === 429 && /insufficient_quota|quota/.test(combined)) {
    return { errorCode: "OPENAI_QUOTA_EXCEEDED", category: "quota" };
  }
  if (input.status === 429) {
    return { errorCode: "OPENAI_RATE_LIMITED", category: "rate_limit" };
  }
  if ([400, 404, 422].includes(input.status) && /model|does not exist|not found|access/.test(combined)) {
    return { errorCode: "OPENAI_MODEL_UNAVAILABLE", category: "model" };
  }
  if ([400, 422].includes(input.status) && /schema|response.?format|structured/.test(combined)) {
    return { errorCode: "OPENAI_STRUCTURED_SCHEMA_INVALID", category: "schema" };
  }
  if ([400, 404, 409, 422].includes(input.status)) {
    return { errorCode: "OPENAI_REQUEST_VALIDATION_ERROR", category: "request_validation" };
  }
  return { errorCode: "PROVIDER_ERROR", category: "unknown" };
}

function usage(payload: unknown): SafeProviderDiagnostic["usage"] {
  if (!payload || typeof payload !== "object" || !("usage" in payload) || !payload.usage || typeof payload.usage !== "object") {
    return null;
  }
  const value = payload.usage as Record<string, unknown>;
  const inputTokens = typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0;
  const outputTokens = typeof value.completion_tokens === "number" ? value.completion_tokens : 0;
  const totalTokens = typeof value.total_tokens === "number"
    ? value.total_tokens
    : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

function structuredContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("choices" in payload) || !Array.isArray(payload.choices)) {
    return null;
  }
  const first = payload.choices[0];
  if (!first || typeof first !== "object" || !("message" in first) || !first.message || typeof first.message !== "object") {
    return null;
  }
  return "content" in first.message && typeof first.message.content === "string"
    ? first.message.content
    : null;
}

export function createOpenAiDirectTransport(input: {
  environment?: OpenAiEnvironment;
  fetchImpl?: OpenAiFetch;
  timeoutMs?: number;
  now?: () => Date;
} = {}): StructuredProviderTransport {
  const environment = input.environment ?? process.env;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const now = input.now ?? (() => new Date());

  return async (request): Promise<ProviderStructuredResponse> => {
    const endpoint = chatCompletionsEndpoint(environment);
    const model = providerModel(request.model, endpoint);
    const attemptStartedAt = now();
    const startedMs = attemptStartedAt.getTime();
    let requestDispatchedAt: Date | null = null;
    let responseReceivedAt: Date | null = null;
    let requestSerializationStatus: SafeProviderDiagnostic["requestSerializationStatus"] = "not_started";
    let requestDispatched = false;
    let response: Response | null = null;
    let payload: unknown = null;
    let errorCategory: ProviderErrorCategory | null = null;
    let timeoutNetworkClassification: SafeProviderDiagnostic["timeoutNetworkClassification"] = null;
    let structuredOutputNotAppliedReason: string | null = null;
    let providerErrorValue: OpenAiProviderError = {
      type: null,
      code: null,
      param: null,
      message: null,
    };

    const finishDiagnostic = (): SafeProviderDiagnostic => {
      const attemptFinishedAt = now();
      return {
        requestDispatched,
        endpoint,
        model,
        schemaId: request.schemaId,
        schemaHash: request.schemaHash,
        responseFormatType: "json_schema",
        httpStatus: response?.status ?? null,
        providerErrorType: providerErrorValue.type,
        providerErrorCode: providerErrorValue.code,
        providerErrorParam: providerErrorValue.param,
        providerErrorMessage: providerErrorValue.message,
        providerRequestId: providerRequestId(response, payload),
        errorCategory,
        apiKeyPresent: Boolean(environment.OPENAI_API_KEY?.trim()),
        environmentScope: environmentScope(environment),
        requestSerializationStatus,
        timeoutNetworkClassification,
        structuredOutputNotAppliedReason,
        attemptStartedAt: attemptStartedAt.toISOString(),
        requestDispatchedAt: requestDispatchedAt?.toISOString() ?? null,
        responseReceivedAt: responseReceivedAt?.toISOString() ?? null,
        attemptFinishedAt: attemptFinishedAt.toISOString(),
        durationMs: Math.max(0, attemptFinishedAt.getTime() - startedMs),
        usage: usage(payload),
      };
    };

    const fail = (
      errorCode: Extract<ProviderStructuredResponse, { ok: false }>["errorCode"],
      message: string,
    ): ProviderStructuredResponse => ({
      ok: false,
      errorCode,
      message: redactProviderDiagnosticText(message),
      rawResponse: payload,
      attestation: {
        requested: requestDispatched,
        forwarded: requestDispatched,
        accepted: false,
        structuredResponseReturned: false,
      },
      providerDiagnostic: finishDiagnostic(),
    });

    if (environment.OPENAI_API_KEY === undefined) {
      errorCategory = "auth";
      structuredOutputNotAppliedReason = environmentScope(environment) === "preview"
        ? "OPENAI_API_KEY_UNAVAILABLE_IN_PREVIEW"
        : "OPENAI_API_KEY_MISSING";
      return fail(
        environmentScope(environment) === "preview"
          ? "OPENAI_API_KEY_UNAVAILABLE_IN_PREVIEW"
          : "OPENAI_API_KEY_MISSING",
        structuredOutputNotAppliedReason,
      );
    }
    if (environment.OPENAI_API_KEY.trim().length === 0) {
      errorCategory = "auth";
      structuredOutputNotAppliedReason = "OPENAI_API_KEY_EMPTY";
      return fail("OPENAI_API_KEY_EMPTY", structuredOutputNotAppliedReason);
    }

    let body: string;
    try {
      body = JSON.stringify({
        model,
        messages: [{ role: "user", content: request.prompt }],
        response_format: request.responseFormat,
      });
      requestSerializationStatus = "success";
    } catch {
      requestSerializationStatus = "failed";
      errorCategory = "request_validation";
      structuredOutputNotAppliedReason = "OPENAI_REQUEST_SERIALIZATION_FAILED";
      return fail(
        "OPENAI_REQUEST_VALIDATION_ERROR",
        "OpenAI request serialization failed",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      requestDispatched = true;
      requestDispatchedAt = now();
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
        },
        body,
        signal: controller.signal,
      });
      responseReceivedAt = now();
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      errorCategory = timedOut ? "timeout" : "network";
      timeoutNetworkClassification = timedOut ? "timeout" : "network";
      structuredOutputNotAppliedReason = timedOut ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK_ERROR";
      return fail(
        timedOut ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK_ERROR",
        structuredOutputNotAppliedReason,
      );
    } finally {
      clearTimeout(timeout);
    }

    payload = await response.json().catch(() => null);
    providerErrorValue = providerError(payload);
    if (!response.ok) {
      const classified = classifyProviderError({
        status: response.status,
        error: providerErrorValue,
      });
      errorCategory = classified.category;
      structuredOutputNotAppliedReason = classified.errorCode;
      return fail(
        classified.errorCode as Extract<ProviderStructuredResponse, { ok: false }>["errorCode"],
        providerErrorValue.message ?? `OpenAI API ${response.status}`,
      );
    }

    const rawText = structuredContent(payload);
    if (rawText === null) {
      errorCategory = "unknown";
      structuredOutputNotAppliedReason = "OPENAI_STRUCTURED_RESPONSE_MISSING";
      return fail("PROVIDER_ERROR", "OpenAI response did not contain structured message content");
    }
    const providerDiagnostic = finishDiagnostic();
    return {
      ok: true,
      rawResponse: payload,
      rawText,
      attestation: {
        requested: true,
        forwarded: true,
        accepted: true,
        structuredResponseReturned: true,
      },
      providerDiagnostic: {
        ...providerDiagnostic,
        structuredOutputNotAppliedReason: null,
      },
    };
  };
}

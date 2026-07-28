"use client";

import { loadAiTunnelApiKey, loadAiTunnelBaseUrl, loadAnthropicApiKey, loadOpenAiApiKey, loadSelectedLlmProvider } from "@/shared/llm/browser-direct-provider";
import type { z } from "zod";
import type { TechnicalValidationError } from "./contracts";

export type StructuredLlmResponse<T> = Readonly<{
  data: T;
  model: string;
  provider?: string;
  durationMs: number;
  retryCount?: number;
  rawResponseAvailable?: boolean;
}>;

export class StructuredLlmError extends Error {
  readonly errorCode: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly retryCount: number;
  readonly rawResponseAvailable: boolean;
  readonly validationErrors: readonly TechnicalValidationError[];

  constructor(input: {
    errorCode: string;
    message: string;
    provider: string | null;
    model: string | null;
    retryCount: number;
    rawResponseAvailable: boolean;
    validationErrors?: readonly TechnicalValidationError[];
  }) {
    super(input.message);
    this.name = "StructuredLlmError";
    this.errorCode = input.errorCode;
    this.provider = input.provider;
    this.model = input.model;
    this.retryCount = input.retryCount;
    this.rawResponseAvailable = input.rawResponseAvailable;
    this.validationErrors = input.validationErrors ?? [];
  }
}

function printableValue(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function zodValidationErrors(error: z.ZodError, output: unknown): TechnicalValidationError[] {
  return error.issues.map((issue) => {
    let received = output;
    for (const segment of issue.path) {
      if (received === null || typeof received !== "object") {
        received = undefined;
        break;
      }
      received = (received as Record<string, unknown>)[String(segment)];
    }
    const allowed = "values" in issue && Array.isArray(issue.values) ? issue.values.map(String) : [];
    return {
      field: issue.path.join(".") || "$",
      message: issue.message,
      got: printableValue(received),
      allowed,
    };
  });
}

function shouldRetry(error: StructuredLlmError): boolean {
  return error.errorCode === "invalid_json"
    || error.errorCode === "timeout"
    || error.errorCode === "network_or_internal_error"
    || /(?:rate|429|provider_http_5\d\d|anthropic_http_5\d\d)/i.test(error.errorCode);
}

export async function callStructuredLlm<T>(
  prompt: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
  validator: z.ZodType<T>,
  model: string,
): Promise<StructuredLlmResponse<T>> {
  const provider = loadSelectedLlmProvider();
  if (provider === "mock") {
    throw new StructuredLlmError({
      errorCode: "provider_not_configured",
      message: "Для конвейера саммари v2 нужен реальный провайдер модели.",
      provider,
      model,
      retryCount: 0,
      rawResponseAvailable: false,
    });
  }
  const apiKey = provider === "ai-tunnel" ? loadAiTunnelApiKey() : provider === "openai-direct" ? loadOpenAiApiKey() : loadAnthropicApiKey();
  if (!apiKey) {
    throw new StructuredLlmError({
      errorCode: "api_key_missing",
      message: "В настройках не сохранён ключ выбранного провайдера.",
      provider,
      model,
      retryCount: 0,
      rawResponseAvailable: false,
    });
  }

  let lastError: StructuredLlmError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = performance.now();
    try {
      const response = await fetch("/api/summary-v2-llm", {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl: provider === "ai-tunnel" ? loadAiTunnelBaseUrl() : undefined,
          model,
          prompt,
          schemaName,
          jsonSchema,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new StructuredLlmError({
          errorCode: String(payload?.error_code ?? `provider_http_${response.status}`),
          message: String(payload?.error_message ?? payload?.error ?? `Ошибка провайдера: HTTP ${response.status}`),
          provider: String(payload?.provider ?? provider),
          model: String(payload?.model ?? model),
          retryCount: attempt,
          rawResponseAvailable: Boolean(payload?.raw_response_available),
        });
      }
      const parsed = validator.safeParse(payload.output);
      if (!parsed.success) {
        throw new StructuredLlmError({
          errorCode: "schema_validation_failed",
          message: "Ответ модели не соответствует контракту этапа.",
          provider: String(payload?.provider ?? provider),
          model: String(payload?.model ?? model),
          retryCount: attempt,
          rawResponseAvailable: true,
          validationErrors: zodValidationErrors(parsed.error, payload.output),
        });
      }
      return {
        data: parsed.data,
        model: String(payload.model ?? model),
        provider: String(payload.provider ?? provider),
        durationMs: Math.round(performance.now() - started),
        retryCount: attempt,
        rawResponseAvailable: true,
      };
    } catch (error) {
      lastError = error instanceof StructuredLlmError
        ? error
        : new StructuredLlmError({
          errorCode: error instanceof DOMException && /^(?:AbortError|TimeoutError)$/.test(error.name) ? "timeout" : "network_or_internal_error",
          message: error instanceof Error ? error.message : "Неизвестная ошибка структурированного ответа.",
          provider,
          model,
          retryCount: attempt,
          rawResponseAvailable: false,
        });
      if (!shouldRetry(lastError)) break;
    }
  }
  throw new StructuredLlmError({
    errorCode: lastError?.errorCode ?? "structured_output_failed",
    message: lastError?.message ?? "Не удалось получить структурированный ответ.",
    provider: lastError?.provider ?? provider,
    model: lastError?.model ?? model,
    retryCount: lastError?.retryCount ?? 0,
    rawResponseAvailable: lastError?.rawResponseAvailable ?? false,
    validationErrors: lastError?.validationErrors,
  });
}

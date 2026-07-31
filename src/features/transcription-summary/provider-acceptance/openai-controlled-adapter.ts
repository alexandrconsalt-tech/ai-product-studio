import type { z } from "zod";
import type { ContractDefinition } from "../contracts/contract-types";
import { normalizeContractOutput } from "../normalization/normalize";
import type { NormalizationErrorCode } from "../normalization/types";

export const PHASE_2A_DEFAULT_MODEL = "gpt-5-mini-2025-08-07";

export type ProviderAcceptanceErrorCode =
  | "STRUCTURED_OUTPUT_SCHEMA_REJECTED"
  | "STRUCTURED_OUTPUT_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "JSON_DECODE_ERROR"
  | "SCHEMA_VALIDATION_ERROR"
  | NormalizationErrorCode;

export type ProviderAcceptanceDiagnostic = Readonly<{
  provider: "openai";
  model: string;
  providerRequestId: string | null;
  contractId: string;
  contractVersion: string;
  schemaHash: string;
  responseFormatRequested: true;
  providerAcceptedRequest: boolean;
  responseType: string | null;
  zodValidationPassed: boolean;
  validationIssues: readonly {
    path: string;
    issueCode: string;
    message: string;
  }[];
  repairAttempted: boolean;
  attemptCount: number;
  durationMs: number;
}>;

export type ProviderAcceptanceResult<T> =
  | Readonly<{
      ok: true;
      value: T;
      diagnostic: ProviderAcceptanceDiagnostic;
    }>
  | Readonly<{
      ok: false;
      error: {
        status: "TECHNICAL_ERROR";
        errorCode: ProviderAcceptanceErrorCode;
        message: string;
      };
      diagnostic: ProviderAcceptanceDiagnostic;
    }>;

type AcceptanceFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function requestId(response: Response, payload: unknown): string | null {
  const header = response.headers.get("x-request-id");
  if (header) return header;
  if (payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string") {
    return payload.id;
  }
  return null;
}

function responseType(payload: unknown): string | null {
  return payload && typeof payload === "object" && "object" in payload && typeof payload.object === "string"
    ? payload.object
    : null;
}

function providerMessage(payload: unknown, fallback: string): string {
  if (
    payload
    && typeof payload === "object"
    && "error" in payload
    && payload.error
    && typeof payload.error === "object"
    && "message" in payload.error
    && typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

function providerErrorCode(response: Response, payload: unknown): ProviderAcceptanceErrorCode {
  const message = providerMessage(payload, "").toLowerCase();
  const code = (
    payload
    && typeof payload === "object"
    && "error" in payload
    && payload.error
    && typeof payload.error === "object"
    && "code" in payload.error
    && typeof payload.error.code === "string"
  )
    ? payload.error.code.toLowerCase()
    : "";
  if (
    [400, 422].includes(response.status)
    && /schema|response.?format|structured/.test(`${code} ${message}`)
  ) {
    return "STRUCTURED_OUTPUT_SCHEMA_REJECTED";
  }
  if (
    [400, 404, 422].includes(response.status)
    && /model|unsupported|not supported|does not exist/.test(`${code} ${message}`)
  ) {
    return "STRUCTURED_OUTPUT_UNAVAILABLE";
  }
  return "PROVIDER_ERROR";
}

function messageContent(payload: unknown): string | null {
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

export async function runControlledOpenAiAcceptance<TContract extends ContractDefinition>(input: {
  apiKey: string;
  contract: TContract;
  prompt: string;
  model?: string;
  timeoutMs?: number;
  allowRepair?: boolean;
  fetchImpl?: AcceptanceFetch;
}): Promise<ProviderAcceptanceResult<z.infer<TContract["validator"]>>> {
  const startedAt = Date.now();
  const model = input.model ?? PHASE_2A_DEFAULT_MODEL;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 30_000;
  let attemptCount = 0;
  let repairAttempted = false;
  let lastIssues: ProviderAcceptanceDiagnostic["validationIssues"] = [];
  let lastRequestId: string | null = null;
  let lastResponseType: string | null = null;
  let providerAcceptedRequest = false;

  const diagnostic = (zodValidationPassed: boolean): ProviderAcceptanceDiagnostic => ({
    provider: "openai",
    model,
    providerRequestId: lastRequestId,
    contractId: input.contract.id,
    contractVersion: input.contract.version,
    schemaHash: input.contract.schemaHash,
    responseFormatRequested: true,
    providerAcceptedRequest,
    responseType: lastResponseType,
    zodValidationPassed,
    validationIssues: lastIssues,
    repairAttempted,
    attemptCount,
    durationMs: Date.now() - startedAt,
  });

  const maxAttempts = input.allowRepair ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    attemptCount += 1;
    repairAttempted = attempt > 0;
    const prompt = attempt === 0
      ? input.prompt
      : `${input.prompt}\n\nREPAIR ATTEMPT. Use the identical response schema. Previous validation issues:\n${JSON.stringify(lastIssues)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: input.contract.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
              strict: true,
              schema: input.contract.schema,
            },
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      const timedOut = error instanceof Error && error.name === "AbortError";
      const errorCode = timedOut ? "TIMEOUT" : "PROVIDER_ERROR";
      return {
        ok: false,
        error: {
          status: "TECHNICAL_ERROR",
          errorCode,
          message: timedOut ? "Controlled OpenAI request timed out" : (error instanceof Error ? error.message : String(error)),
        },
        diagnostic: diagnostic(false),
      };
    }
    clearTimeout(timeout);
    const payload: unknown = await response.json().catch(() => null);
    lastRequestId = requestId(response, payload);
    lastResponseType = responseType(payload);
    if (!response.ok) {
      const errorCode = providerErrorCode(response, payload);
      return {
        ok: false,
        error: {
          status: "TECHNICAL_ERROR",
          errorCode,
          message: providerMessage(payload, `OpenAI API ${response.status}`),
        },
        diagnostic: diagnostic(false),
      };
    }
    providerAcceptedRequest = true;
    const content = messageContent(payload);
    if (content === null) {
      return {
        ok: false,
        error: {
          status: "TECHNICAL_ERROR",
          errorCode: "JSON_DECODE_ERROR",
          message: "OpenAI response did not contain structured message content",
        },
        diagnostic: diagnostic(false),
      };
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(content);
    } catch (error) {
      lastIssues = [{
        path: "",
        issueCode: "invalid_json",
        message: error instanceof Error ? error.message : String(error),
      }];
      if (attempt + 1 < maxAttempts) continue;
      return {
        ok: false,
        error: {
          status: "TECHNICAL_ERROR",
          errorCode: "JSON_DECODE_ERROR",
          message: lastIssues[0].message,
        },
        diagnostic: diagnostic(false),
      };
    }
    const transportParsed = input.contract.transportValidator.safeParse(decoded);
    if (transportParsed.success) {
      const normalized = normalizeContractOutput(input.contract, transportParsed.data);
      if (!normalized.ok) {
        return {
          ok: false,
          error: {
            status: "TECHNICAL_ERROR",
            errorCode: normalized.error.errorCode,
            message: normalized.error.message,
          },
          diagnostic: diagnostic(false),
        };
      }
      return {
        ok: true,
        value: normalized.value as z.infer<TContract["validator"]>,
        diagnostic: diagnostic(true),
      };
    }
    lastIssues = transportParsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      issueCode: issue.code,
      message: issue.message,
    }));
    if (attempt + 1 < maxAttempts) continue;
    return {
      ok: false,
      error: {
        status: "TECHNICAL_ERROR",
        errorCode: "SCHEMA_VALIDATION_ERROR",
        message: transportParsed.error.message,
      },
      diagnostic: diagnostic(false),
    };
  }
  throw new Error("Unreachable provider acceptance state");
}

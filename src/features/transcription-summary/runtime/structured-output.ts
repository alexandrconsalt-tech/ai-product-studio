import type { z } from "zod";
import type { ContractDefinition } from "../contracts/contract-types";
import { normalizeContractOutput } from "../normalization/normalize";
import type {
  NormalizationErrorCode,
  NormalizationTransformation,
} from "../normalization/types";
import { validateOpenAIStructuredOutputSchema } from "./openai-schema-preflight";

export type StructuredOutputErrorCode =
  | "JSON_DECODE_ERROR"
  | "SCHEMA_VALIDATION_ERROR"
  | "OPENAI_API_KEY_MISSING"
  | "OPENAI_API_KEY_EMPTY"
  | "OPENAI_API_KEY_UNAVAILABLE_IN_PREVIEW"
  | "OPENAI_AUTH_FAILED"
  | "OPENAI_MODEL_UNAVAILABLE"
  | "OPENAI_QUOTA_EXCEEDED"
  | "OPENAI_RATE_LIMITED"
  | "OPENAI_TIMEOUT"
  | "OPENAI_NETWORK_ERROR"
  | "OPENAI_REQUEST_VALIDATION_ERROR"
  | "OPENAI_STRUCTURED_SCHEMA_INVALID"
  | "PROVIDER_ERROR"
  | "PROVIDER_SCHEMA_ERROR"
  | "STRUCTURED_OUTPUT_UNAVAILABLE"
  | "STRUCTURED_OUTPUT_NOT_APPLIED"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | NormalizationErrorCode;

export type StructuredOutputAttestation = Readonly<{
  requested: boolean;
  forwarded: boolean;
  accepted: boolean;
  structuredResponseReturned: boolean;
}>;

export type ProviderErrorCategory =
  | "auth"
  | "schema"
  | "model"
  | "quota"
  | "rate_limit"
  | "network"
  | "timeout"
  | "request_validation"
  | "unknown";

export type SafeProviderDiagnostic = Readonly<{
  requestDispatched: boolean;
  providerName: "AITUNNEL" | "OPENAI_COMPATIBLE";
  baseUrl: string;
  endpoint: string;
  model: string;
  schemaId: string;
  schemaHash: string;
  responseFormatType: "json_schema";
  httpStatus: number | null;
  providerErrorType: string | null;
  providerErrorCode: string | null;
  providerErrorParam: string | null;
  providerErrorMessage: string | null;
  providerRequestId: string | null;
  errorCategory: ProviderErrorCategory | null;
  apiKeyPresent: boolean;
  environmentScope: "preview" | "development" | "production" | "test" | "unknown";
  requestSerializationStatus: "not_started" | "success" | "failed";
  timeoutNetworkClassification: "timeout" | "network" | null;
  structuredOutputNotAppliedReason: string | null;
  attemptStartedAt: string;
  requestDispatchedAt: string | null;
  responseReceivedAt: string | null;
  attemptFinishedAt: string;
  durationMs: number;
  usage: Readonly<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }> | null;
}>;

export type ProviderStructuredRequest = Readonly<{
  provider: string;
  model: string;
  prompt: string;
  schemaId: string;
  schemaHash: string;
  responseFormat: Readonly<{
    type: "json_schema";
    json_schema: Readonly<{
      name: string;
      strict: true;
      schema: Readonly<Record<string, unknown>>;
    }>;
  }>;
  timeoutMs?: number;
}>;

export type ProviderStructuredResponse =
  | Readonly<{
      ok: true;
      rawResponse: unknown;
      structuredValue?: unknown;
      rawText?: string;
      attestation: StructuredOutputAttestation;
      providerDiagnostic?: SafeProviderDiagnostic;
    }>
  | Readonly<{
      ok: false;
      errorCode: Exclude<StructuredOutputErrorCode, "JSON_DECODE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "STRUCTURED_OUTPUT_NOT_APPLIED">;
      message: string;
      rawResponse?: unknown;
      attestation: StructuredOutputAttestation;
      providerDiagnostic?: SafeProviderDiagnostic;
    }>;

export type StructuredProviderTransport = (
  request: ProviderStructuredRequest,
) => Promise<ProviderStructuredResponse>;

export type ValidationIssue = Readonly<{
  path: string;
  expected: string | null;
  received: string | null;
  issueCode: string;
  message: string;
}>;

export type StructuredDiagnostic = Readonly<{
  stageId: string;
  manifestHash: string;
  contractId: string;
  contractVersion: string;
  schemaHash: string;
  promptHash: string;
  structuredOutputRequested: boolean;
  structuredOutputApplied: boolean;
  provider: string;
  model: string;
  attemptCount: number;
  repairAttempted: boolean;
  validationStatus: "valid" | "invalid" | "not_run";
  validationIssues: readonly ValidationIssue[];
  normalizationStatus: "completed" | "failed" | "not_run";
  normalizationTransformations: readonly NormalizationTransformation[];
  providerDiagnostic: SafeProviderDiagnostic | null;
  durationMs: number;
  errorType: string | null;
  errorCode: StructuredOutputErrorCode | null;
}>;

export type StructuredCompletionResult<T> =
  | Readonly<{
      ok: true;
      value: T;
      rawResponse: unknown;
      diagnostic: StructuredDiagnostic;
    }>
  | Readonly<{
      ok: false;
      error: {
        status: "TECHNICAL_ERROR";
        errorType: string;
        errorCode: StructuredOutputErrorCode;
        message: string;
      };
      rawResponse?: unknown;
      diagnostic: StructuredDiagnostic;
    }>;

function validationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    expected: "expected" in issue ? String(issue.expected) : null,
    received: "received" in issue ? String(issue.received) : null,
    issueCode: issue.code,
    message: issue.message,
  }));
}

function decode(response: Extract<ProviderStructuredResponse, { ok: true }>): { ok: true; value: unknown } | { ok: false; message: string } {
  if (response.structuredValue !== undefined) return { ok: true, value: response.structuredValue };
  if (typeof response.rawText !== "string") return { ok: false, message: "Provider did not return a structured value or JSON text" };
  try {
    return { ok: true, value: JSON.parse(response.rawText) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function errorType(code: StructuredOutputErrorCode): string {
  if (code.startsWith("NORMALIZATION_")) return "normalization_error";
  if (code === "PROVIDER_SCHEMA_ERROR" || code === "OPENAI_STRUCTURED_SCHEMA_INVALID") return "provider_schema_error";
  if (code === "STRUCTURED_OUTPUT_UNAVAILABLE") return "provider_capability_error";
  if (code === "STRUCTURED_OUTPUT_NOT_APPLIED") return "transport_contract_error";
  if (code === "SCHEMA_VALIDATION_ERROR" || code === "JSON_DECODE_ERROR") return "validation_error";
  return "provider_error";
}

export async function executeStructuredCompletion<TContract extends ContractDefinition>(input: {
  stageId: string;
  manifestHash: string;
  contract: TContract;
  prompt: string;
  promptHash: string;
  provider: string;
  model: string;
  transport: StructuredProviderTransport;
  timeoutMs?: number;
  transportOutputOnly?: boolean;
  validationRepairEnabled?: boolean;
}): Promise<StructuredCompletionResult<z.infer<TContract["validator"]>>> {
  const startedAt = Date.now();
  const completionDeadlineAt = input.timeoutMs ? startedAt + input.timeoutMs : null;
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: input.contract.id.replace(/[^a-zA-Z0-9_-]/g, "_"),
      strict: true as const,
      schema: input.contract.schema,
    },
  };
  let attemptCount = 0;
  let repairAttempted = false;
  let lastRaw: unknown;
  let lastIssues: ValidationIssue[] = [];
  let normalizationStatus: StructuredDiagnostic["normalizationStatus"] = "not_run";
  let normalizationTransformations: readonly NormalizationTransformation[] = [];
  let providerDiagnostic: SafeProviderDiagnostic | null = null;
  let structuredOutputRequested = false;

  const diagnostic = (
    applied: boolean,
    validationStatus: StructuredDiagnostic["validationStatus"],
    code: StructuredOutputErrorCode | null,
  ): StructuredDiagnostic => ({
    stageId: input.stageId,
    manifestHash: input.manifestHash,
    contractId: input.contract.id,
    contractVersion: input.contract.version,
    schemaHash: input.contract.schemaHash,
    promptHash: input.promptHash,
    structuredOutputRequested,
    structuredOutputApplied: applied,
    provider: input.provider,
    model: input.model,
    attemptCount,
    repairAttempted,
    validationStatus,
    validationIssues: lastIssues,
    normalizationStatus,
    normalizationTransformations,
    providerDiagnostic,
    durationMs: Math.max(0, Date.now() - startedAt),
    errorType: code ? errorType(code) : null,
    errorCode: code,
  });

  const schemaPreflight = validateOpenAIStructuredOutputSchema(input.contract.schema);
  if (!schemaPreflight.ok) {
    lastIssues = schemaPreflight.issues.map((issue) => ({
      path: issue.path,
      expected: "OpenAI Structured Outputs JSON Schema subset",
      received: "unsupported schema",
      issueCode: issue.code,
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        status: "TECHNICAL_ERROR",
        errorType: errorType("OPENAI_STRUCTURED_SCHEMA_INVALID"),
        errorCode: "OPENAI_STRUCTURED_SCHEMA_INVALID",
        message: "Registry schema failed OpenAI Structured Outputs preflight",
      },
      diagnostic: diagnostic(false, "invalid", "OPENAI_STRUCTURED_SCHEMA_INVALID"),
    };
  }

  const maximumAttempts = input.validationRepairEnabled === false ? 1 : 2;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    attemptCount += 1;
    repairAttempted = attempt === 1;
    const prompt = attempt === 0
      ? input.prompt
      : `${input.prompt}\n\nREPAIR ATTEMPT (same contract and schema)\nValidation errors:\n${JSON.stringify(lastIssues)}`;
    const response = await input.transport({
      provider: input.provider,
      model: input.model,
      prompt,
      schemaId: input.contract.id,
      schemaHash: input.contract.schemaHash,
      responseFormat,
      timeoutMs: completionDeadlineAt === null
        ? undefined
        : Math.max(1, completionDeadlineAt - Date.now()),
    });
    providerDiagnostic = response.providerDiagnostic ?? null;
    structuredOutputRequested = response.attestation.requested
      && (response.providerDiagnostic?.requestDispatched ?? response.attestation.forwarded);
    lastRaw = response.rawResponse;
    if (!response.ok) {
      return {
        ok: false,
        error: { status: "TECHNICAL_ERROR", errorType: errorType(response.errorCode), errorCode: response.errorCode, message: response.message },
        rawResponse: response.rawResponse,
        diagnostic: diagnostic(false, "not_run", response.errorCode),
      };
    }
    const applied = response.attestation.requested
      && response.attestation.forwarded
      && response.attestation.accepted
      && response.attestation.structuredResponseReturned;
    if (!applied) {
      const code = response.attestation.forwarded && response.attestation.accepted
        ? "STRUCTURED_OUTPUT_NOT_APPLIED"
        : "STRUCTURED_OUTPUT_UNAVAILABLE";
      return {
        ok: false,
        error: { status: "TECHNICAL_ERROR", errorType: errorType(code), errorCode: code, message: "Provider path did not attest the complete Structured Output chain" },
        rawResponse: response.rawResponse,
        diagnostic: diagnostic(false, "not_run", code),
      };
    }
    const decoded = decode(response);
    if (!decoded.ok) {
      lastIssues = [{ path: "", expected: "JSON", received: "text", issueCode: "invalid_json", message: decoded.message }];
      if (attempt + 1 < maximumAttempts) continue;
      return {
        ok: false,
        error: { status: "TECHNICAL_ERROR", errorType: errorType("JSON_DECODE_ERROR"), errorCode: "JSON_DECODE_ERROR", message: decoded.message },
        rawResponse: response.rawResponse,
        diagnostic: diagnostic(true, "invalid", "JSON_DECODE_ERROR"),
      };
    }
    const transportParsed = input.contract.transportValidator.safeParse(decoded.value);
    if (transportParsed.success) {
      if (input.transportOutputOnly) {
        normalizationStatus = "not_run";
        return {
          ok: true,
          value: transportParsed.data as z.infer<TContract["validator"]>,
          rawResponse: response.rawResponse,
          diagnostic: diagnostic(true, "valid", null),
        };
      }
      const normalized = normalizeContractOutput(input.contract, transportParsed.data);
      normalizationTransformations = normalized.transformations;
      if (!normalized.ok) {
        normalizationStatus = "failed";
        return {
          ok: false,
          error: {
            status: "TECHNICAL_ERROR",
            errorType: errorType(normalized.error.errorCode),
            errorCode: normalized.error.errorCode,
            message: normalized.error.message,
          },
          rawResponse: response.rawResponse,
          diagnostic: diagnostic(true, "valid", normalized.error.errorCode),
        };
      }
      normalizationStatus = "completed";
      return {
        ok: true,
        value: normalized.value as z.infer<TContract["validator"]>,
        rawResponse: response.rawResponse,
        diagnostic: diagnostic(true, "valid", null),
      };
    }
    lastIssues = validationIssues(transportParsed.error);
    if (attempt + 1 < maximumAttempts) continue;
    return {
      ok: false,
      error: { status: "TECHNICAL_ERROR", errorType: errorType("SCHEMA_VALIDATION_ERROR"), errorCode: "SCHEMA_VALIDATION_ERROR", message: transportParsed.error.message },
      rawResponse: response.rawResponse,
      diagnostic: diagnostic(true, "invalid", "SCHEMA_VALIDATION_ERROR"),
    };
  }
  throw new Error(`unreachable structured completion state: ${String(lastRaw)}`);
}

export const aiTunnelFailClosedTransport: StructuredProviderTransport = async () => ({
  ok: false,
  errorCode: "STRUCTURED_OUTPUT_UNAVAILABLE",
  message: "AI Tunnel does not expose verifiable requested/forwarded/accepted Structured Output attestation",
  attestation: {
    requested: true,
    forwarded: false,
    accepted: false,
    structuredResponseReturned: false,
  },
});

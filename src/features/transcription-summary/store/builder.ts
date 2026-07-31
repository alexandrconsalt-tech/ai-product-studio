import { createHash } from "node:crypto";
import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  ConversationStoreV3Contract,
  ConversationStoreV3Schema,
  type ConversationStoreV3,
} from "../contracts/conversation-store/v3/contract";
import { FactsV3Schema } from "../contracts/facts/v3/contract";
import { validateContractManifest } from "../contracts/manifest";
import { NeedsV3Schema } from "../contracts/needs/v3/contract";
import {
  EMPTY_OUTCOME_V3,
  OutcomeV3Schema,
} from "../contracts/outcome/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import {
  TranscriptV3Schema,
  type TranscriptV3,
} from "../contracts/transcript/v3/contract";

export type ConversationStoreV3ErrorCode =
  | "STORE_INPUT_INVALID"
  | "STORE_MANIFEST_MISMATCH"
  | "STORE_SOURCE_INTEGRITY_ERROR";

export type ConversationStoreV3Diagnostic = Readonly<{
  stageId: "conversation_store_v3";
  contractId: "conversation.store.v3";
  contractVersion: "3.2.0";
  manifestHash: string;
  storeId: string | null;
  complete: boolean;
  partial: boolean;
  sourceErrors: readonly string[];
  factsCount: number;
  quotesCount: number;
  needsCount: number;
  requirementsCount: number;
  agreementsCount: number;
  hasPrimaryNextStep: boolean;
  sourceIntegrityStatus: "valid" | "invalid" | "not_checked";
  validationStatus: "valid" | "invalid" | "not_run";
  errorType: "validation_error" | "dependency_error" | "integrity_error" | null;
  errorCode: ConversationStoreV3ErrorCode | null;
  durationMs: number;
}>;

export type BuildConversationStoreV3Result =
  | Readonly<{ ok: true; store: ConversationStoreV3; diagnostic: ConversationStoreV3Diagnostic }>
  | Readonly<{
      ok: false;
      error: { status: "TECHNICAL_ERROR"; errorCode: ConversationStoreV3ErrorCode; message: string };
      diagnostic: ConversationStoreV3Diagnostic;
    }>;

export type BuildConversationStoreV3Input = Readonly<{
  manifest: PipelineContractManifest;
  transcript: unknown;
  facts?: unknown;
  needs?: unknown;
  outcome?: unknown;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function calculateConversationStoreContentHash(store: unknown): string {
  return sha256(store);
}

export function calculateTranscriptContentHash(
  transcript: Pick<TranscriptV3, "transcript_id" | "turns">,
): string {
  return sha256({
    transcript_id: transcript.transcript_id,
    turns: [...transcript.turns].sort((left, right) =>
      left.sequence - right.sequence || left.id.localeCompare(right.id)),
  });
}

function diagnostic(
  startedAt: number,
  manifestHash: string,
  overrides: Partial<ConversationStoreV3Diagnostic> = {},
): ConversationStoreV3Diagnostic {
  return {
    stageId: "conversation_store_v3",
    contractId: "conversation.store.v3",
    contractVersion: "3.2.0",
    manifestHash,
    storeId: null,
    complete: false,
    partial: false,
    sourceErrors: [],
    factsCount: 0,
    quotesCount: 0,
    needsCount: 0,
    requirementsCount: 0,
    agreementsCount: 0,
    hasPrimaryNextStep: false,
    sourceIntegrityStatus: "not_checked",
    validationStatus: "not_run",
    errorType: null,
    errorCode: null,
    durationMs: Date.now() - startedAt,
    ...overrides,
  };
}

function failure(
  startedAt: number,
  manifestHash: string,
  errorCode: ConversationStoreV3ErrorCode,
  message: string,
  errorType: NonNullable<ConversationStoreV3Diagnostic["errorType"]>,
): BuildConversationStoreV3Result {
  return {
    ok: false,
    error: { status: "TECHNICAL_ERROR", errorCode, message },
    diagnostic: diagnostic(startedAt, manifestHash, {
      errorType,
      errorCode,
      validationStatus: "invalid",
    }),
  };
}

function stripPii(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/(?:\\+?7|8)[\\s()-]*\\d{3}[\\s()-]*\\d{3}[\\s-]*\\d{2}[\\s-]*\\d{2}/g, "[PII удалено]")
      .replace(/[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}/g, "[PII удалено]");
  }
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, stripPii(nested)]));
  }
  return value;
}

function uniqueById<T extends Record<string, unknown>>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = typeof item.id === "string" ? item.id : stableStringify(item);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function buildConversationStoreV3(
  input: BuildConversationStoreV3Input,
): BuildConversationStoreV3Result {
  const startedAt = Date.now();
  const manifestHash = input?.manifest?.manifestHash ?? "";
  try {
    validateContractManifest(input.manifest);
  } catch (error) {
    return failure(
      startedAt,
      manifestHash,
      "STORE_MANIFEST_MISMATCH",
      error instanceof Error ? error.message : String(error),
      "dependency_error",
    );
  }
  const storeReference = input.manifest.contracts.conversationStore;
  if (
    storeReference.id !== ConversationStoreV3Contract.id
    || storeReference.version !== ConversationStoreV3Contract.version
  ) {
    return failure(
      startedAt,
      manifestHash,
      "STORE_MANIFEST_MISMATCH",
      "Manifest does not reference the active Conversation Store contract",
      "dependency_error",
    );
  }

  const transcript = TranscriptV3Schema.safeParse(input.transcript);
  if (!transcript.success) {
    return failure(startedAt, manifestHash, "STORE_INPUT_INVALID", "Transcript is invalid", "validation_error");
  }
  const actualTranscriptHash = calculateTranscriptContentHash(transcript.data);
  if (actualTranscriptHash !== transcript.data.metadata.sha256) {
    return failure(
      startedAt,
      manifestHash,
      "STORE_SOURCE_INTEGRITY_ERROR",
      "Transcript hash does not match",
      "integrity_error",
    );
  }

  const facts = FactsV3Schema.safeParse(input.facts);
  const needs = NeedsV3Schema.safeParse(input.needs);
  const outcome = OutcomeV3Schema.safeParse(input.outcome);
  const sourceErrors = [
    ...(!facts.success ? ["facts" as const] : []),
    ...(!needs.success ? ["needs" as const] : []),
    ...(!outcome.success ? ["outcome" as const] : []),
  ];
  const safeFacts = facts.success ? facts.data : {
    confirmed_facts: [],
    quotes: [],
    client_questions: [],
    contextual_statements: [],
    rejected_assumptions: [],
  };
  const safeNeeds = needs.success ? needs.data : {
    business_needs: [],
    property_requirements: [],
    structured_crm_attributes: {},
    communication_preferences: [],
    client_questions: [],
  };
  const safeOutcome = outcome.success ? outcome.data : EMPTY_OUTCOME_V3;
  const sourceQuality = {
    facts: facts.success ? "valid" : "technical_error",
    needs: needs.success ? "valid" : "technical_error",
    outcome: outcome.success ? "valid" : "technical_error",
  };
  const payload = stripPii({
    meta: {
      run_id: transcript.data.metadata.run_id,
      schema_id: "conversation.store.v3" as const,
      contract_version: "3.2.0" as const,
      publication_status: "published" as const,
      manifest_hash: manifestHash,
      transcript_ref: {
        id: transcript.data.transcript_id,
        sha256: actualTranscriptHash,
      },
    },
    facts: uniqueById(safeFacts.confirmed_facts),
    quotes: uniqueById(safeFacts.quotes),
    attributes: safeNeeds.structured_crm_attributes,
    requirements: uniqueById([
      ...safeNeeds.business_needs,
      ...safeNeeds.property_requirements,
    ]),
    call_results: uniqueById(safeOutcome.call_results),
    agreements: uniqueById(safeOutcome.agreements),
    primary_next_step: safeOutcome.primary_next_step,
    source_quality: sourceQuality,
    transcript_available: true as const,
    partial: sourceErrors.length > 0,
    source_errors: sourceErrors,
    sources: [...transcript.data.turns]
      .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
      .map(({ id, speaker, text }) => ({ turn_id: id, speaker, text })),
  }) as Omit<ConversationStoreV3, "content_hash">;
  const identityHash = sha256(payload);
  const withIdentity = {
    ...payload,
    meta: {
      ...payload.meta,
      store_id: `store-${identityHash.slice(0, 24)}`,
    },
  };
  const candidate = {
    ...withIdentity,
    content_hash: calculateConversationStoreContentHash(withIdentity),
  };
  const parsed = ConversationStoreV3Schema.safeParse(candidate);
  if (!parsed.success) {
    return failure(startedAt, manifestHash, "STORE_INPUT_INVALID", parsed.error.message, "validation_error");
  }
  return {
    ok: true,
    store: parsed.data,
    diagnostic: diagnostic(startedAt, manifestHash, {
      storeId: parsed.data.meta.store_id,
      complete: true,
      partial: parsed.data.partial,
      sourceErrors: parsed.data.source_errors,
      factsCount: parsed.data.facts.length,
      quotesCount: parsed.data.quotes.length,
      needsCount: parsed.data.requirements.length,
      requirementsCount: parsed.data.requirements.length,
      agreementsCount: parsed.data.agreements.length,
      hasPrimaryNextStep: parsed.data.primary_next_step.status === "confirmed",
      sourceIntegrityStatus: "valid",
      validationStatus: "valid",
    }),
  };
}

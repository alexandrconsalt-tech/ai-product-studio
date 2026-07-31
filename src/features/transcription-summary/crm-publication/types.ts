import { z } from "zod";
import {
  FUNDING_SOURCE_VALUES,
  INTEREST_VALUES,
  PURCHASE_TERM_VALUES,
  QUALITY_GATE_DECISIONS,
} from "../contracts/canonical-enums";
import type { CrmPublicationInputV3 } from "../contracts/crm-publication-input/v3/contract";

export const CRM_ERROR_CODES = [
  "CRM_INPUT_INVALID",
  "CRM_HASH_MISMATCH",
  "CRM_POLICY_BLOCKED",
  "CRM_IDEMPOTENCY_CONFLICT",
  "CRM_WRITE_TIMEOUT",
  "CRM_WRITE_REJECTED",
  "CRM_AUTH_ERROR",
  "CRM_RATE_LIMIT",
  "CRM_UNKNOWN_ERROR",
] as const;
export type CrmErrorCode = (typeof CRM_ERROR_CODES)[number];

export type PublicationError = Readonly<{
  code: CrmErrorCode;
  retryable: boolean;
}>;

export const CRM_WRITABLE_FIELDS = Object.freeze([
  "summary",
  "attributes",
  "summary_quality_score",
  "summary_quality_status",
  "quality_issues",
  "quality_evaluation_partial",
  "technicalMetadata",
] as const);

export const CrmPayloadV3Schema = z.object({
  target: z.object({
    crmSystem: z.string().trim().min(1),
    entityType: z.enum(["lead", "request", "contact", "call"]),
    entityId: z.string().trim().min(1),
  }).strict(),
  summary: z.object({
    conversation_result: z.string().trim().min(1),
    key_facts: z.array(z.object({
      label: z.string().trim().min(1),
      value: z.string().trim().min(1),
    }).strict()).max(4),
    quotes: z.array(z.object({ text: z.string().trim().min(1) }).strict()).max(2),
    next_step: z.string().trim().min(1),
  }).strict(),
  attributes: z.object({
    interest: z.array(z.string().trim().min(1)),
    funding_source: z.string().trim().min(1),
    purchase_term: z.string().trim().min(1),
  }).strict(),
  summary_quality_score: z.number().min(0).max(100).nullable(),
  summary_quality_status: z.enum(["EXCELLENT", "GOOD", "NEEDS_ATTENTION", "LOW_QUALITY", "NOT_EVALUATED"]),
  quality_issues: z.array(z.object({
    code: z.string().trim().min(1),
    criterion: z.string().trim().min(1).nullable(),
  }).strict()),
  quality_evaluation_partial: z.boolean(),
  technicalMetadata: z.object({
    idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
    runId: z.string().trim().min(1),
    storeHash: z.string().regex(/^[a-f0-9]{64}$/),
    summaryHash: z.string().regex(/^[a-f0-9]{64}$/),
    qualityScore: z.number().min(0).max(100).nullable(),
    qualityDecision: z.enum(QUALITY_GATE_DECISIONS),
    policyVersion: z.literal("3.0.0"),
    storeContractVersion: z.literal("3.2.0"),
    summaryContractVersion: z.literal("3.1.0"),
    qualityGateContractVersion: z.literal("3.2.0"),
  }).strict(),
}).strict();

export type CrmPayloadV3 = z.infer<typeof CrmPayloadV3Schema>;

export type CrmWriteResult =
  | Readonly<{
      ok: true;
      publicationId: string;
      providerResponseId: string;
      writtenFields: readonly string[];
    }>
  | Readonly<{
      ok: false;
      providerResponseId: string | null;
      error: PublicationError;
    }>;

export interface CrmClientV3 {
  publishSummary(payload: CrmPayloadV3): Promise<CrmWriteResult>;
}

export type PendingPublicationRecord = Readonly<{
  idempotencyKey: string;
  executionId: string;
  input: CrmPublicationInputV3;
  reservedAt: string;
}>;

export type PublicationRecord = Readonly<{
  idempotencyKey: string;
  executionId: string;
  state: "PENDING" | "PUBLISHED" | "FAILED";
  publicationId: string | null;
  error: PublicationError | null;
  retryable: boolean;
  attempts: number;
}>;

export type ReserveResult =
  | Readonly<{ status: "RESERVED"; record: PublicationRecord }>
  | Readonly<{ status: "ALREADY_PUBLISHED"; record: PublicationRecord }>
  | Readonly<{ status: "CONFLICT"; record: PublicationRecord }>;

export interface CrmPublicationRepositoryV3 {
  findByIdempotencyKey(key: string): Promise<PublicationRecord | null>;
  reserve(record: PendingPublicationRecord): Promise<ReserveResult>;
  markPublished(key: string, publicationId: string): Promise<void>;
  markFailed(key: string, error: PublicationError): Promise<void>;
}

import { createHash } from "node:crypto";
import {
  CrmPublicationResultV3Schema,
  type CrmPublicationResultV3,
} from "../contracts/crm-publication-result/v3/contract";
import { stableStringify } from "../contracts/schema-utils";
import type { PipelineContractManifest } from "../contracts/contract-types";
import {
  buildCrmPublicationInputV3,
  type BuildCrmPublicationInputResult,
} from "./input-builder";
import { evaluateCrmPublicationPolicyV3 } from "./policy";
import {
  CRM_WRITABLE_FIELDS,
  CrmPayloadV3Schema,
  type CrmClientV3,
  type CrmErrorCode,
  type CrmPayloadV3,
  type CrmPublicationRepositoryV3,
} from "./types";

export type CrmPublicationDiagnosticV3 = Readonly<{
  stageId: "crm_publication_v3";
  inputContractId: "crm.publication.input.v3";
  outputContractId: "crm.publication.result.v3";
  manifestHash: string;
  entityType: "lead" | "request" | "contact" | "call" | null;
  entityIdHash: string;
  idempotencyKey: string;
  qualityDecision: "QUALITY_RECORDED" | "NOT_RUN";
  qualityScore: number | null;
  publicationPolicyVersion: "3.0.0";
  dryRun: boolean;
  status: CrmPublicationResultV3["status"] | "NOT_RUN";
  reasonCode: CrmPublicationResultV3["reasonCode"] | "NOT_RUN";
  writtenFields: readonly string[];
  skippedFields: readonly string[];
  crmProviderResponseId: string | null;
  errorType: "input_validation" | "policy" | "idempotency" | "crm_write" | null;
  errorCode: CrmErrorCode | null;
  durationMs: number;
}>;

export type ExecuteCrmPublicationV3Result =
  | Readonly<{
      ok: true;
      value: CrmPublicationResultV3;
      diagnostic: CrmPublicationDiagnosticV3;
    }>
  | Readonly<{
      ok: false;
      disposition: "NOT_RUN" | "TECHNICAL_ERROR";
      error: { status: "NOT_RUN" | "TECHNICAL_ERROR"; errorCode: CrmErrorCode };
      diagnostic: CrmPublicationDiagnosticV3;
    }>;

export function calculateCrmIdempotencyKey(input: {
  crmSystem: string;
  entityType: string;
  entityId: string;
  runId: string;
  summaryHash: string;
  policyVersion: string;
}): string {
  return createHash("sha256").update(stableStringify([
    input.crmSystem,
    input.entityType,
    input.entityId,
    input.runId,
    input.summaryHash,
    input.policyVersion,
  ])).digest("hex");
}

export function buildCrmPayloadV3(
  input: Extract<BuildCrmPublicationInputResult, { ok: true }>["value"],
): CrmPayloadV3 {
  const storeAttributes = input.conversationStore.attributes as {
    interested_in?: Array<{ value?: unknown }>;
    funding_source?: { value?: unknown };
    purchase_term?: { value?: unknown };
  };
  const attributeValue = (value: unknown): string =>
    typeof value === "string" && value.trim() ? value.trim() : "не определено";
  const idempotencyKey = calculateCrmIdempotencyKey({
    ...input.target,
    runId: input.meta.runId,
    summaryHash: input.meta.summaryHash,
    policyVersion: input.publicationPolicy.policyVersion,
  });
  return CrmPayloadV3Schema.parse({
    target: input.target,
    summary: input.summary,
    attributes: {
      interest: (storeAttributes.interested_in ?? [])
        .map((item) => attributeValue(item.value))
        .filter((value) => value !== "не определено"),
      funding_source: attributeValue(storeAttributes.funding_source?.value),
      purchase_term: attributeValue(storeAttributes.purchase_term?.value),
    },
    summary_quality_score: input.qualityGate.qualityScore,
    summary_quality_status: input.qualityGate.qualityStatus,
    quality_issues: [
      ...input.qualityGate.issues.map((issue) => ({
        code: issue.code,
        criterion: issue.criterion ?? null,
      })),
    ],
    quality_evaluation_partial: input.qualityGate.partialEvaluation,
    technicalMetadata: {
      idempotencyKey,
      runId: input.meta.runId,
      storeHash: input.meta.storeContentHash,
      summaryHash: input.meta.summaryHash,
      qualityScore: input.qualityGate.qualityScore,
      qualityDecision: input.qualityGate.decision,
      policyVersion: input.publicationPolicy.policyVersion,
      storeContractVersion: input.conversationStore.meta.contract_version,
      summaryContractVersion: "3.1.0",
      qualityGateContractVersion: input.qualityGate.metadata.contractVersion,
    },
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameFields(actual: readonly string[]): boolean {
  return actual.length === CRM_WRITABLE_FIELDS.length
    && actual.every((field, index) => field === CRM_WRITABLE_FIELDS[index]);
}

export async function executeCrmPublicationV3(input: {
  manifest: PipelineContractManifest;
  executionId: string;
  conversationStore: unknown;
  summary: unknown;
  qualityGate: unknown | null | undefined;
  target: unknown;
  dryRun: boolean;
  repository: CrmPublicationRepositoryV3;
  client: CrmClientV3;
  now?: () => Date;
}): Promise<ExecuteCrmPublicationV3Result> {
  const startedAt = Date.now();
  const now = input.now ?? (() => new Date());
  const built = buildCrmPublicationInputV3(input);
  const rawTarget = input.target && typeof input.target === "object"
    ? input.target as Record<string, unknown>
    : {};
  const baseDiagnostic = {
    stageId: "crm_publication_v3" as const,
    inputContractId: "crm.publication.input.v3" as const,
    outputContractId: "crm.publication.result.v3" as const,
    manifestHash: input.manifest.manifestHash,
    entityType: ["lead", "request", "contact", "call"].includes(String(rawTarget.entityType))
      ? rawTarget.entityType as "lead" | "request" | "contact" | "call"
      : null,
    entityIdHash: typeof rawTarget.entityId === "string" ? sha256(rawTarget.entityId) : sha256(""),
    publicationPolicyVersion: "3.0.0" as const,
    dryRun: input.dryRun,
  };
  if (!built.ok) {
    const notRun = built.disposition === "NOT_RUN";
    return {
      ok: false,
      disposition: built.disposition,
      error: {
        status: notRun ? "NOT_RUN" : "TECHNICAL_ERROR",
        errorCode: built.errorCode,
      },
      diagnostic: {
        ...baseDiagnostic,
        idempotencyKey: "",
        qualityDecision: "NOT_RUN",
        qualityScore: null,
        status: notRun ? "NOT_RUN" : "TECHNICAL_ERROR",
        reasonCode: notRun ? "NOT_RUN" : "INPUT_INVALID",
        writtenFields: [],
        skippedFields: CRM_WRITABLE_FIELDS,
        crmProviderResponseId: null,
        errorType: "input_validation",
        errorCode: built.errorCode,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const value = built.value;
  const idempotencyKey = calculateCrmIdempotencyKey({
    ...value.target,
    runId: value.meta.runId,
    summaryHash: value.meta.summaryHash,
    policyVersion: value.publicationPolicy.policyVersion,
  });
  const policy = evaluateCrmPublicationPolicyV3(value.qualityGate.decision);
  const result = (fields: Omit<CrmPublicationResultV3, "metadata">): CrmPublicationResultV3 =>
    CrmPublicationResultV3Schema.parse({
      ...fields,
      metadata: {
        runId: value.meta.runId,
        entityId: value.target.entityId,
        sourceStoreHash: value.meta.storeContentHash,
        sourceSummaryHash: value.meta.summaryHash,
        qualityScore: value.qualityGate.qualityScore,
        policyVersion: value.publicationPolicy.policyVersion,
        createdAt: now().toISOString(),
      },
    });
  const diagnostic = (
    publication: CrmPublicationResultV3,
    providerResponseId: string | null,
    errorType: CrmPublicationDiagnosticV3["errorType"],
    errorCode: CrmErrorCode | null,
  ): CrmPublicationDiagnosticV3 => ({
    ...baseDiagnostic,
    idempotencyKey,
    qualityDecision: value.qualityGate.decision,
    qualityScore: value.qualityGate.qualityScore,
    status: publication.status,
    reasonCode: publication.reasonCode,
    writtenFields: publication.writtenFields,
    skippedFields: publication.skippedFields,
    crmProviderResponseId: providerResponseId,
    errorType,
    errorCode,
    durationMs: Date.now() - startedAt,
  });

  const payload = buildCrmPayloadV3(value);
  if (value.publicationPolicy.dryRun) {
    const publication = result({
      status: "DRY_RUN",
      publicationId: null,
      idempotencyKey,
      decision: value.qualityGate.decision,
      writtenFields: [...CRM_WRITABLE_FIELDS],
      skippedFields: [],
      reasonCode: "DRY_RUN",
    });
    return { ok: true, value: publication, diagnostic: diagnostic(publication, null, null, null) };
  }

  const reservation = await input.repository.reserve({
    idempotencyKey,
    executionId: value.meta.executionId,
    input: value,
    reservedAt: now().toISOString(),
  });
  if (reservation.status === "ALREADY_PUBLISHED") {
    const publication = result({
      status: "ALREADY_PUBLISHED",
      publicationId: reservation.record.publicationId,
      idempotencyKey,
      decision: value.qualityGate.decision,
      writtenFields: [],
      skippedFields: [...CRM_WRITABLE_FIELDS],
      reasonCode: "IDEMPOTENT_REPLAY",
    });
    return { ok: true, value: publication, diagnostic: diagnostic(publication, null, null, null) };
  }
  if (reservation.status === "CONFLICT") {
    const publication = result({
      status: "TECHNICAL_ERROR",
      publicationId: null,
      idempotencyKey,
      decision: value.qualityGate.decision,
      writtenFields: [],
      skippedFields: [...CRM_WRITABLE_FIELDS],
      reasonCode: "CRM_WRITE_FAILED",
    });
    return {
      ok: true,
      value: publication,
      diagnostic: diagnostic(publication, null, "idempotency", "CRM_IDEMPOTENCY_CONFLICT"),
    };
  }

  let write;
  try {
    write = await input.client.publishSummary(payload);
  } catch {
    write = {
      ok: false as const,
      providerResponseId: null,
      error: { code: "CRM_UNKNOWN_ERROR" as const, retryable: true },
    };
  }
  if (
    write.ok
    && (
      !write.publicationId.trim()
      || !write.providerResponseId.trim()
      || !sameFields(write.writtenFields)
    )
  ) {
    write = {
      ok: false as const,
      providerResponseId: write.providerResponseId || null,
      error: { code: "CRM_WRITE_REJECTED" as const, retryable: true },
    };
  }
  if (!write.ok) {
    await input.repository.markFailed(idempotencyKey, write.error);
    const publication = result({
      status: "TECHNICAL_ERROR",
      publicationId: null,
      idempotencyKey,
      decision: value.qualityGate.decision,
      writtenFields: [],
      skippedFields: [...CRM_WRITABLE_FIELDS],
      reasonCode: "CRM_WRITE_FAILED",
    });
    return {
      ok: true,
      value: publication,
      diagnostic: diagnostic(publication, write.providerResponseId, "crm_write", write.error.code),
    };
  }
  await input.repository.markPublished(idempotencyKey, write.publicationId);
  const publication = result({
    status: "PUBLISHED",
    publicationId: write.publicationId,
    idempotencyKey,
    decision: value.qualityGate.decision,
    writtenFields: [...CRM_WRITABLE_FIELDS],
    skippedFields: [],
    reasonCode: policy.reasonCode,
  });
  return {
    ok: true,
    value: publication,
    diagnostic: diagnostic(publication, write.providerResponseId, null, null),
  };
}

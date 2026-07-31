import { z } from "zod";
import { QUALITY_GATE_DECISIONS } from "../../canonical-enums";
import { CRM_PUBLICATION_POLICY_VERSION } from "../../crm-publication-input/v3/contract";
import { defineContract } from "../../schema-utils";
import { IdentifierSchema, NonEmptyStringSchema } from "../../shared-schemas";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const CRM_PUBLICATION_STATUSES = [
  "PUBLISHED",
  "SKIPPED",
  "ALREADY_PUBLISHED",
  "DRY_RUN",
  "TECHNICAL_ERROR",
] as const;
export const CRM_PUBLICATION_REASON_CODES = [
  "SUMMARY_SAVE_ALLOWED",
  "IDEMPOTENT_REPLAY",
  "DRY_RUN",
  "CRM_WRITE_FAILED",
  "INPUT_INVALID",
] as const;

export const CrmPublicationResultV3Schema = z.object({
  status: z.enum(CRM_PUBLICATION_STATUSES),
  publicationId: NonEmptyStringSchema.nullable(),
  idempotencyKey: Sha256Schema,
  decision: z.enum(QUALITY_GATE_DECISIONS),
  writtenFields: z.array(NonEmptyStringSchema),
  skippedFields: z.array(NonEmptyStringSchema),
  reasonCode: z.enum(CRM_PUBLICATION_REASON_CODES),
  metadata: z.object({
    runId: IdentifierSchema,
    entityId: IdentifierSchema,
    sourceStoreHash: Sha256Schema,
    sourceSummaryHash: Sha256Schema,
    qualityScore: z.number().min(0).max(100).nullable(),
    policyVersion: z.literal(CRM_PUBLICATION_POLICY_VERSION),
    createdAt: z.string().datetime(),
  }).strict(),
}).strict().superRefine((result, context) => {
  const needsPublicationId = ["PUBLISHED", "ALREADY_PUBLISHED"].includes(result.status);
  if (needsPublicationId !== (result.publicationId !== null)) {
    context.addIssue({
      code: "custom",
      path: ["publicationId"],
      message: "Only confirmed publications may contain publicationId",
    });
  }
});

const valid = {
  status: "DRY_RUN",
  publicationId: null,
  idempotencyKey: "a".repeat(64),
  decision: "QUALITY_RECORDED",
  writtenFields: [
    "summary",
    "summary_quality_score",
    "summary_quality_status",
    "quality_issues",
    "quality_evaluation_partial",
  ],
  skippedFields: [],
  reasonCode: "DRY_RUN",
  metadata: {
    runId: "run-1",
    entityId: "call-1",
    sourceStoreHash: "b".repeat(64),
    sourceSummaryHash: "c".repeat(64),
    qualityScore: 100,
    policyVersion: CRM_PUBLICATION_POLICY_VERSION,
    createdAt: "2026-07-30T00:00:00.000Z",
  },
} as const;

export const CrmPublicationResultV3Contract = defineContract({
  id: "crm.publication.result.v3",
  version: "3.0.0",
  stageId: "crm_publication_v3",
  description: "Typed deterministic CRM publication result and idempotency audit.",
  validator: CrmPublicationResultV3Schema,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  canonicalEnums: [...CRM_PUBLICATION_STATUSES, ...CRM_PUBLICATION_REASON_CODES],
  fixtures: {
    valid,
    missing_required: {
      status: valid.status,
      publicationId: valid.publicationId,
      idempotencyKey: valid.idempotencyKey,
      decision: valid.decision,
      writtenFields: valid.writtenFields,
      skippedFields: valid.skippedFields,
      reasonCode: valid.reasonCode,
    },
    extra_legacy_field: { ...valid, text: "saved" },
    invalid_enum: { ...valid, status: "SUCCESS" },
    invalid_nested_type: { ...valid, publicationId: "crm-1" },
  },
});

export type CrmPublicationResultV3 = z.infer<typeof CrmPublicationResultV3Schema>;

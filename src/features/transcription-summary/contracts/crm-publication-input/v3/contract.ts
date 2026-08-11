import { z } from "zod";
import {
  AI_SUMMARY_V3_PIPELINE_ID,
  AI_SUMMARY_V3_PIPELINE_VERSION,
  TRANSCRIPTION_SUMMARY_PRODUCT_ID,
} from "../../constants";
import { ConversationStoreV3Contract, ConversationStoreV3Schema } from "../../conversation-store/v3/contract";
import { QualityGateV3Contract, SummaryQualityGateResultV3Schema } from "../../quality-gate/v3/contract";
import { defineContract } from "../../schema-utils";
import { IdentifierSchema, NonEmptyStringSchema } from "../../shared-schemas";
import { SummaryV3Contract, SummaryV3Schema } from "../../summary/v3/contract";
import type { JsonValue } from "../../contract-types";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PublishableQualityGateSchema = SummaryQualityGateResultV3Schema.and(z.object({
  decision: z.literal("QUALITY_RECORDED"),
  blocking: z.literal(false),
}));

export const CRM_PUBLICATION_POLICY_ID = "crm-publication-policy-v3.0.0";
export const CRM_PUBLICATION_POLICY_VERSION = "3.0.0";

export const CrmPublicationInputV3Schema = z.object({
  meta: z.object({
    runId: IdentifierSchema,
    executionId: IdentifierSchema,
    productId: z.literal(TRANSCRIPTION_SUMMARY_PRODUCT_ID),
    pipelineId: z.literal(AI_SUMMARY_V3_PIPELINE_ID),
    pipelineVersion: z.literal(AI_SUMMARY_V3_PIPELINE_VERSION),
    manifestHash: Sha256Schema,
    storeId: IdentifierSchema,
    storeContentHash: Sha256Schema,
    summaryHash: Sha256Schema,
    qualityGatePolicyVersion: z.literal("3.0.0"),
  }).strict(),
  conversationStore: ConversationStoreV3Schema,
  summary: SummaryV3Schema,
  qualityGate: PublishableQualityGateSchema,
  target: z.object({
    crmSystem: NonEmptyStringSchema,
    entityType: z.enum(["lead", "request", "contact", "call"]),
    entityId: IdentifierSchema,
  }).strict(),
  publicationPolicy: z.object({
    policyId: z.literal(CRM_PUBLICATION_POLICY_ID),
    policyVersion: z.literal(CRM_PUBLICATION_POLICY_VERSION),
    dryRun: z.boolean(),
  }).strict(),
}).strict().superRefine((input, context) => {
  const store = input.conversationStore;
  const summary = input.summary;
  const gate = input.qualityGate;
  if (
    input.meta.runId !== store.meta.run_id
    || input.meta.storeId !== store.meta.store_id
    || input.meta.storeContentHash !== store.content_hash
    || input.meta.manifestHash !== store.meta.manifest_hash
    || gate.metadata.runId !== input.meta.runId
    || gate.metadata.sourceStoreId !== input.meta.storeId
    || gate.metadata.sourceStoreHash !== input.meta.storeContentHash
    || gate.metadata.sourceSummaryHash !== input.meta.summaryHash
    || gate.metadata.manifestHash !== input.meta.manifestHash
    || gate.metadata.policyVersion !== input.meta.qualityGatePolicyVersion
  ) {
    context.addIssue({
      code: "custom",
      path: ["meta"],
      message: "CRM publication provenance and hashes must match",
    });
  }
});

const store = structuredClone(ConversationStoreV3Contract.fixtures.valid) as Record<string, unknown>;
const storeHash = "c".repeat(64);
const summaryHash = "d".repeat(64);
const summary = {
  ...(structuredClone(SummaryV3Contract.fixtures.valid) as Record<string, unknown>),
};
const qualityGate = {
  ...(structuredClone(QualityGateV3Contract.fixtures.valid) as Record<string, unknown>),
  metadata: {
    runId: "run-1",
    sourceStoreId: "store-0123456789abcdef01234567",
    sourceStoreHash: storeHash,
    sourceSummaryHash: summaryHash,
    manifestHash: "a".repeat(64),
    contractVersion: "3.2.0",
    policyVersion: "3.0.0",
  },
};
const valid = {
  meta: {
    runId: "run-1",
    executionId: "execution-1",
    productId: TRANSCRIPTION_SUMMARY_PRODUCT_ID,
    pipelineId: AI_SUMMARY_V3_PIPELINE_ID,
    pipelineVersion: AI_SUMMARY_V3_PIPELINE_VERSION,
    manifestHash: "a".repeat(64),
    storeId: "store-0123456789abcdef01234567",
    storeContentHash: storeHash,
    summaryHash,
    qualityGatePolicyVersion: "3.0.0",
  },
  conversationStore: store,
  summary,
  qualityGate,
  target: { crmSystem: "mock-crm", entityType: "call", entityId: "call-1" },
  publicationPolicy: {
    policyId: CRM_PUBLICATION_POLICY_ID,
    policyVersion: CRM_PUBLICATION_POLICY_VERSION,
    dryRun: true,
  },
} as const;

export const CrmPublicationInputV3Contract = defineContract({
  id: "crm.publication.input.v3",
  version: "3.0.0",
  stageId: "crm_publication_input_build",
  description: "Typed immutable CRM publication input with Store, Summary and Quality Gate provenance.",
  validator: CrmPublicationInputV3Schema,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  canonicalEnums: ["lead", "request", "contact", "call"],
  fixtures: {
    valid: valid as unknown as JsonValue,
    missing_required: {
      ...valid,
      target: { crmSystem: "mock-crm", entityType: "call" },
    } as unknown as JsonValue,
    extra_legacy_field: { ...valid, transcript: "forbidden" } as unknown as JsonValue,
    invalid_enum: {
      ...valid,
      target: { ...valid.target, entityType: "deal" },
    } as unknown as JsonValue,
    invalid_nested_type: {
      ...valid,
      publicationPolicy: { ...valid.publicationPolicy, dryRun: "yes" },
    } as unknown as JsonValue,
  },
});

export type CrmPublicationInputV3 = z.infer<typeof CrmPublicationInputV3Schema>;

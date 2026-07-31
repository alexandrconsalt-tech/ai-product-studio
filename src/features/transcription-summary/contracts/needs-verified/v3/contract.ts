import { z } from "zod";
import { FUNDING_SOURCE_VALUES, INTEREST_VALUES, PURCHASE_TERM_VALUES } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
  ReconciliationTechnicalMetadataSchema,
  RejectedItemReferenceSchema,
  SourceReferenceSchema,
  SourceTurnIdsSchema,
  VerdictTrailEntrySchema,
  VerifiedStatusSchema,
  addVerifiedBoundaryChecks,
} from "../../shared-schemas";

const verifiedBase = {
  id: IdentifierSchema,
  source_turn_ids: SourceTurnIdsSchema,
  evidence: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
};
export const VerifiedNeedSchema = z.object({ ...verifiedBase, need_type: NonEmptyStringSchema, value: NonEmptyStringSchema }).strict();
export const VerifiedInterestSchema = z.object({ ...verifiedBase, value: z.enum(INTEREST_VALUES) }).strict();
export const VerifiedFundingSchema = z.object({ ...verifiedBase, value: z.enum(FUNDING_SOURCE_VALUES) }).strict();
export const VerifiedTermSchema = z.object({ ...verifiedBase, value: z.enum(PURCHASE_TERM_VALUES) }).strict();
export const VerifiedPreferenceSchema = z.object({ ...verifiedBase, channel: NonEmptyStringSchema }).strict();
export const VerifiedNeedQuestionSchema = z.object({
  ...verifiedBase,
  question: NonEmptyStringSchema,
}).strict();

export const NeedsVerifiedV3Schema = z.object({
  verified_business_needs: z.array(VerifiedNeedSchema),
  verified_property_requirements: z.array(VerifiedNeedSchema),
  verified_structured_crm_attributes: z.object({
    interested_in: z.array(VerifiedInterestSchema),
    funding_source: VerifiedFundingSchema.nullable(),
    purchase_term: VerifiedTermSchema.nullable(),
  }).strict(),
  verified_communication_preferences: z.array(VerifiedPreferenceSchema),
  verified_client_questions: z.array(VerifiedNeedQuestionSchema),
  rejected_item_references: z.array(RejectedItemReferenceSchema),
  source_references: z.array(SourceReferenceSchema),
  verdict_trail: z.array(VerdictTrailEntrySchema).min(1),
  technical_metadata: ReconciliationTechnicalMetadataSchema,
}).strict().superRefine((value, context) => {
  addVerifiedBoundaryChecks(value, context, [
    value.verified_business_needs,
    value.verified_property_requirements,
    value.verified_structured_crm_attributes.interested_in,
    value.verified_structured_crm_attributes.funding_source ? [value.verified_structured_crm_attributes.funding_source] : [],
    value.verified_structured_crm_attributes.purchase_term ? [value.verified_structured_crm_attributes.purchase_term] : [],
    value.verified_communication_preferences,
    value.verified_client_questions,
  ]);
});

const base = {
  id: "funding-1",
  value: "наличные / депозит",
  source_turn_ids: ["turn-1"],
  evidence: "Оплачу наличными.",
  confidence: 0.96,
  verification_status: "verified",
} as const;
const valid = {
  verified_business_needs: [],
  verified_property_requirements: [],
  verified_structured_crm_attributes: { interested_in: [], funding_source: base, purchase_term: null },
  verified_communication_preferences: [],
  verified_client_questions: [],
  rejected_item_references: [],
  source_references: [{ turn_id: "turn-1", speaker: "client", text: "Оплачу наличными." }],
  verdict_trail: [{
    item_id: "funding-1",
    agent_value: { value: "наличные / депозит" },
    judge_verdict: "verified",
    applied_correction: null,
    invariant_result: "passed",
    final_verdict: "verified",
    rule_id: "reconcile.verified.v1",
  }],
  technical_metadata: {
    reconciliation_status: "completed",
    reconciled_at: "2026-07-30T00:00:00.000Z",
    source_contract_id: "needs.agent.output.v3",
    judge_contract_id: "needs.judge.verdict.v3",
  },
} as const;

export const NeedsVerifiedV3Contract = defineContract({
  id: "needs.verified.v3",
  stageId: "needs_verified",
  description: "Детерминированно верифицированные потребности и canonical CRM-атрибуты.",
  validator: NeedsVerifiedV3Schema,
  canonicalEnums: [...INTEREST_VALUES, ...FUNDING_SOURCE_VALUES, ...PURCHASE_TERM_VALUES],
  fixtures: {
    valid,
    missing_required: {
      verified_business_needs: [],
      verified_property_requirements: [],
      verified_structured_crm_attributes: valid.verified_structured_crm_attributes,
      verified_communication_preferences: [],
      verified_client_questions: [],
      rejected_item_references: [],
      source_references: valid.source_references,
      technical_metadata: valid.technical_metadata,
    },
    extra_legacy_field: { ...valid, needs: [] },
    invalid_enum: {
      ...valid,
      verified_structured_crm_attributes: {
        ...valid.verified_structured_crm_attributes,
        funding_source: { ...base, value: "наличными" },
      },
    },
    invalid_nested_type: {
      ...valid,
      verified_structured_crm_attributes: {
        ...valid.verified_structured_crm_attributes,
        funding_source: { ...base, source_turn_ids: ["missing-turn"] },
      },
    },
  },
});

export type NeedsVerifiedV3 = z.infer<typeof NeedsVerifiedV3Schema>;

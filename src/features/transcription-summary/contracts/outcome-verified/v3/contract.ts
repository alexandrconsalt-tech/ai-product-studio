import { z } from "zod";
import { CALL_RESULT_VALUES, OUTCOME_STATUS_VALUES, PARTY_VALUES, RECIPIENT_VALUES } from "../../canonical-enums";
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

export const VerifiedAgreementSchema = z.object({
  id: IdentifierSchema,
  action: NonEmptyStringSchema,
  owner: z.enum(PARTY_VALUES),
  recipient: z.enum(RECIPIENT_VALUES),
  deadline: NonEmptyStringSchema.nullable(),
  channel: NonEmptyStringSchema.nullable(),
  status: z.enum(OUTCOME_STATUS_VALUES),
  source_turn_ids: SourceTurnIdsSchema,
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();
export const VerifiedCallResultSchema = z.object({
  id: z.literal("call-result"),
  status: z.enum(CALL_RESULT_VALUES),
  description: NonEmptyStringSchema,
  source_turn_ids: SourceTurnIdsSchema,
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();
export const VerifiedNextStepSchema = z.object({
  id: IdentifierSchema,
  action: NonEmptyStringSchema.nullable(),
  owner: z.enum(PARTY_VALUES),
  recipient: z.enum(RECIPIENT_VALUES),
  deadline: NonEmptyStringSchema.nullable(),
  channel: NonEmptyStringSchema.nullable(),
  status: z.enum(OUTCOME_STATUS_VALUES),
  source_turn_ids: z.array(IdentifierSchema),
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();
export const VerifiedOutcomeQuestionSchema = z.object({
  id: IdentifierSchema,
  question: NonEmptyStringSchema,
  asked_by: z.enum(PARTY_VALUES),
  assigned_to: z.enum(PARTY_VALUES),
  source_turn_ids: SourceTurnIdsSchema,
  verification_status: VerifiedStatusSchema,
}).strict();
export const VerifiedChannelSchema = z.object({
  id: z.literal("communication-channel"),
  channel: NonEmptyStringSchema.nullable(),
  source_turn_ids: z.array(IdentifierSchema),
  verification_status: VerifiedStatusSchema,
}).strict();

export const OutcomeVerifiedV3Schema = z.object({
  verified_call_result: VerifiedCallResultSchema,
  verified_agreements: z.array(VerifiedAgreementSchema),
  verified_primary_next_step: VerifiedNextStepSchema,
  verified_unresolved_questions: z.array(VerifiedOutcomeQuestionSchema),
  verified_communication_channel: VerifiedChannelSchema,
  rejected_item_references: z.array(RejectedItemReferenceSchema),
  source_references: z.array(SourceReferenceSchema),
  verdict_trail: z.array(VerdictTrailEntrySchema).min(1),
  technical_metadata: ReconciliationTechnicalMetadataSchema,
}).strict().superRefine((value, context) => {
  addVerifiedBoundaryChecks(value, context, [
    [value.verified_call_result],
    value.verified_agreements,
    [value.verified_primary_next_step],
    value.verified_unresolved_questions,
    [value.verified_communication_channel],
  ]);
});

const agreement = {
  id: "agreement-1",
  action: "Отправить планировки",
  owner: "agent",
  recipient: "client",
  deadline: null,
  channel: "email",
  status: "agreed",
  source_turn_ids: ["turn-4"],
  confidence: 0.97,
  verification_status: "verified",
} as const;
const trailFor = (itemId: string) => ({
  item_id: itemId,
  agent_value: { id: itemId },
  judge_verdict: "verified" as const,
  applied_correction: null,
  invariant_result: "passed" as const,
  final_verdict: "verified" as const,
  rule_id: "reconcile.verified.v1",
});
const valid = {
  verified_call_result: {
    id: "call-result",
    status: "follow_up_required",
    description: "Согласована отправка планировок.",
    source_turn_ids: ["turn-4"],
    confidence: 0.97,
    verification_status: "verified",
  },
  verified_agreements: [agreement],
  verified_primary_next_step: { ...agreement, id: "next-step-1" },
  verified_unresolved_questions: [],
  verified_communication_channel: {
    id: "communication-channel",
    channel: "email",
    source_turn_ids: ["turn-4"],
    verification_status: "verified",
  },
  rejected_item_references: [],
  source_references: [{ turn_id: "turn-4", speaker: "agent", text: "Отправлю планировки на email." }],
  verdict_trail: ["call-result", "agreement-1", "next-step-1", "communication-channel"].map(trailFor),
  technical_metadata: {
    reconciliation_status: "completed",
    reconciled_at: "2026-07-30T00:00:00.000Z",
    source_contract_id: "outcome.agent.output.v3",
    judge_contract_id: "outcome.judge.verdict.v3",
  },
} as const;

export const OutcomeVerifiedV3Contract = defineContract({
  id: "outcome.verified.v3",
  stageId: "outcome_verified",
  description: "Детерминированно верифицированные результат, договорённости и следующий шаг.",
  validator: OutcomeVerifiedV3Schema,
  canonicalEnums: [...CALL_RESULT_VALUES, ...OUTCOME_STATUS_VALUES, ...PARTY_VALUES, ...RECIPIENT_VALUES],
  fixtures: {
    valid,
    missing_required: {
      verified_agreements: valid.verified_agreements,
      verified_primary_next_step: valid.verified_primary_next_step,
      verified_unresolved_questions: [],
      verified_communication_channel: valid.verified_communication_channel,
      rejected_item_references: [],
      source_references: valid.source_references,
      verdict_trail: valid.verdict_trail,
      technical_metadata: valid.technical_metadata,
    },
    extra_legacy_field: { ...valid, call_results: ["ok"] },
    invalid_enum: { ...valid, verified_call_result: { ...valid.verified_call_result, status: "success" } },
    invalid_nested_type: { ...valid, verified_agreements: [{ ...agreement, source_turn_ids: ["missing-turn"] }] },
  },
});

export type OutcomeVerifiedV3 = z.infer<typeof OutcomeVerifiedV3Schema>;

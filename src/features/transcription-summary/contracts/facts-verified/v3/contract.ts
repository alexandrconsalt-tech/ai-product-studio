import { z } from "zod";
import { SPEAKER_ROLES } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
  ReconciliationTechnicalMetadataSchema,
  RejectedItemReferenceSchema,
  SourceReferenceSchema,
  SourceTurnIdsSchema,
  SpeakerRoleSchema,
  VerdictTrailEntrySchema,
  VerifiedStatusSchema,
  addVerifiedBoundaryChecks,
} from "../../shared-schemas";

export const VerifiedFactSchema = z.object({
  id: IdentifierSchema,
  kind: z.enum(["client_fact", "property_fact", "requirement_signal"]),
  subject: z.enum(["client", "property", "conversation"]),
  predicate: NonEmptyStringSchema,
  value: NonEmptyStringSchema,
  source_turn_ids: SourceTurnIdsSchema,
  evidence: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();

export const VerifiedFactQuestionSchema = z.object({
  id: IdentifierSchema,
  question: NonEmptyStringSchema,
  source_turn_ids: SourceTurnIdsSchema,
  evidence: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();

export const VerifiedQuoteSchema = z.object({
  id: IdentifierSchema,
  speaker: SpeakerRoleSchema,
  text: NonEmptyStringSchema,
  source_turn_id: IdentifierSchema,
  supports_fact_ids: z.array(IdentifierSchema),
  confidence: ConfidenceSchema,
  verification_status: VerifiedStatusSchema,
}).strict();

export const FactsVerifiedV3Schema = z.object({
  verified_facts: z.array(VerifiedFactSchema),
  verified_quotes: z.array(VerifiedQuoteSchema),
  verified_client_questions: z.array(VerifiedFactQuestionSchema),
  rejected_item_references: z.array(RejectedItemReferenceSchema),
  source_references: z.array(SourceReferenceSchema),
  verdict_trail: z.array(VerdictTrailEntrySchema).min(1),
  technical_metadata: ReconciliationTechnicalMetadataSchema,
}).strict().superRefine((value, context) => {
  addVerifiedBoundaryChecks(value, context, [
    value.verified_facts,
    value.verified_quotes,
    value.verified_client_questions,
  ]);
  const factIds = new Set(value.verified_facts.map((fact) => fact.id));
  for (const quote of value.verified_quotes) {
    for (const factId of quote.supports_fact_ids) {
      if (!factIds.has(factId)) {
        context.addIssue({ code: "custom", message: `quote references unknown verified fact: ${factId}` });
      }
    }
  }
});

const source = { turn_id: "turn-1", speaker: "client", text: "Там переуступка?" } as const;
const trail = {
  item_id: "question-1",
  agent_value: { question: "Там переуступка?" },
  judge_verdict: "verified",
  applied_correction: null,
  invariant_result: "passed",
  final_verdict: "verified",
  rule_id: "reconcile.verified.v1",
} as const;
const valid = {
  verified_facts: [],
  verified_quotes: [],
  verified_client_questions: [{
    id: "question-1",
    question: "Там переуступка?",
    source_turn_ids: ["turn-1"],
    evidence: "Там переуступка?",
    confidence: 1,
    verification_status: "verified",
  }],
  rejected_item_references: [],
  source_references: [source],
  verdict_trail: [trail],
  technical_metadata: {
    reconciliation_status: "completed",
    reconciled_at: "2026-07-30T00:00:00.000Z",
    source_contract_id: "facts.agent.output.v3",
    judge_contract_id: "facts.judge.verdict.v3",
  },
} as const;

export const FactsVerifiedV3Contract = defineContract({
  id: "facts.verified.v3",
  stageId: "facts_verified",
  description: "Детерминированно верифицированные факты, цитаты и вопросы клиента.",
  validator: FactsVerifiedV3Schema,
  canonicalEnums: SPEAKER_ROLES,
  fixtures: {
    valid,
    missing_required: {
      verified_facts: [],
      verified_quotes: [],
      verified_client_questions: valid.verified_client_questions,
      rejected_item_references: [],
      source_references: [source],
      technical_metadata: valid.technical_metadata,
    },
    extra_legacy_field: { ...valid, facts: [] },
    invalid_enum: {
      ...valid,
      verified_client_questions: [{ ...valid.verified_client_questions[0], verification_status: "pending" }],
    },
    invalid_nested_type: {
      ...valid,
      verified_client_questions: [{ ...valid.verified_client_questions[0], source_turn_ids: ["missing-turn"] }],
    },
  },
});

export type FactsVerifiedV3 = z.infer<typeof FactsVerifiedV3Schema>;

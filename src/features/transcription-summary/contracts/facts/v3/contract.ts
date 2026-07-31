import { z } from "zod";
import { SPEAKER_ROLES } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
  PendingCandidateBaseSchema,
  SourceTurnIdsSchema,
  SpeakerRoleSchema,
} from "../../shared-schemas";
import { transportStringValuesForField } from "../../../normalization/registry";
import {
  TransportConfidenceSchema,
  TransportIdentifierSchema,
  TransportNonEmptyStringSchema,
  TransportPendingCandidateBaseSchema,
  TransportSourceTurnIdsSchema,
} from "../../../normalization/transport-schemas";

const ConfirmedFactSchema = PendingCandidateBaseSchema.extend({
  kind: z.enum(["client_fact", "property_fact", "requirement_signal"]),
  subject: z.enum(["client", "property", "conversation"]),
  predicate: NonEmptyStringSchema,
  value: NonEmptyStringSchema,
}).strict();

const ClientQuestionSchema = z
  .object({
    id: IdentifierSchema,
    question: NonEmptyStringSchema,
    source_turn_ids: SourceTurnIdsSchema,
    evidence: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    verification_status: z.literal("extracted"),
  })
  .strict();

const QuoteSchema = z
  .object({
    id: IdentifierSchema,
    speaker: SpeakerRoleSchema,
    text: NonEmptyStringSchema,
    source_turn_id: IdentifierSchema,
    supports_fact_ids: z.array(IdentifierSchema),
    confidence: ConfidenceSchema,
    verification_status: z.literal("extracted"),
  })
  .strict();

const StatementSchema = PendingCandidateBaseSchema.extend({ statement: NonEmptyStringSchema }).strict();

export const FactsV3Schema = z
  .object({
    confirmed_facts: z.array(ConfirmedFactSchema),
    client_questions: z.array(ClientQuestionSchema),
    quotes: z.array(QuoteSchema),
    contextual_statements: z.array(StatementSchema),
    rejected_assumptions: z.array(StatementSchema),
  })
  .strict();

const FactsTransportConfirmedFactSchema = TransportPendingCandidateBaseSchema.extend({
  kind: z.enum(["client_fact", "property_fact", "requirement_signal"]),
  subject: z.enum(["client", "property", "conversation"]),
  predicate: TransportNonEmptyStringSchema,
  value: TransportNonEmptyStringSchema,
}).strict();

const FactsTransportStatementSchema = TransportPendingCandidateBaseSchema.extend({
  statement: TransportNonEmptyStringSchema,
}).strict();

export const FactsV3TransportSchema = z
  .object({
    confirmed_facts: z.array(FactsTransportConfirmedFactSchema),
    client_questions: z.array(z.object({
      id: TransportIdentifierSchema,
      question: TransportNonEmptyStringSchema,
      source_turn_ids: TransportSourceTurnIdsSchema,
      evidence: TransportNonEmptyStringSchema,
      confidence: TransportConfidenceSchema,
      verification_status: z.literal("extracted"),
    }).strict()),
    quotes: z.array(z.object({
      id: TransportIdentifierSchema,
      speaker: z.enum(transportStringValuesForField("facts.agent.output.v3", "quotes.*.speaker")),
      text: TransportNonEmptyStringSchema,
      source_turn_id: TransportIdentifierSchema,
      supports_fact_ids: z.array(TransportIdentifierSchema),
      confidence: TransportConfidenceSchema,
      verification_status: z.literal("extracted"),
    }).strict()),
    contextual_statements: z.array(FactsTransportStatementSchema),
    rejected_assumptions: z.array(FactsTransportStatementSchema),
  })
  .strict();

const question = "Там переуступка?";
const valid = {
  confirmed_facts: [],
  client_questions: [{ id: "question-1", question, source_turn_ids: ["turn-1"], evidence: question, confidence: 1, verification_status: "extracted" }],
  quotes: [{ id: "quote-1", speaker: "client", text: question, source_turn_id: "turn-1", supports_fact_ids: [], confidence: 1, verification_status: "extracted" }],
  contextual_statements: [],
  rejected_assumptions: [],
} as const;

export const FactsV3Contract = defineContract({
  id: "facts.agent.output.v3",
  stageId: "facts_extract",
  description: "Кандидаты фактов, вопросов, цитат, контекста и предположений.",
  validator: FactsV3Schema,
  transportValidator: FactsV3TransportSchema,
  canonicalEnums: [...SPEAKER_ROLES, "client_fact", "property_fact", "requirement_signal"],
  normalizationPolicyId: "normalization.facts.v3",
  fixtures: {
    valid,
    missing_required: {
      confirmed_facts: valid.confirmed_facts,
      quotes: valid.quotes,
      contextual_statements: valid.contextual_statements,
      rejected_assumptions: valid.rejected_assumptions,
    },
    extra_legacy_field: { ...valid, extraction_meta: {} },
    invalid_enum: {
      ...valid,
      confirmed_facts: [{
        id: "fact-1",
        kind: "client_question",
        subject: "property",
        predicate: "deal_type",
        value: "переуступка",
        source_turn_ids: ["turn-1"],
        evidence: question,
        confidence: 1,
        verification_status: "extracted",
      }],
    },
    invalid_nested_type: { ...valid, client_questions: [{ ...valid.client_questions[0], source_turn_ids: "turn-1" }] },
  },
});

export type FactsV3 = z.infer<typeof FactsV3Schema>;

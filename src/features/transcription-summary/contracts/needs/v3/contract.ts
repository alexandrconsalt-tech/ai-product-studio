import { z } from "zod";
import {
  COMMUNICATION_CHANNEL_VALUES,
  FUNDING_SOURCE_VALUES,
  INTEREST_VALUES,
  PURCHASE_TERM_VALUES,
} from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
  PendingCandidateBaseSchema,
  SourceTurnIdsSchema,
} from "../../shared-schemas";
import { transportStringValuesForField } from "../../../normalization/registry";
import {
  TransportConfidenceSchema,
  TransportIdentifierSchema,
  TransportNonEmptyStringSchema,
  TransportPendingCandidateBaseSchema,
  TransportSourceTurnIdsSchema,
} from "../../../normalization/transport-schemas";

const NeedCandidateSchema = PendingCandidateBaseSchema.extend({
  need_type: NonEmptyStringSchema,
  value: NonEmptyStringSchema,
}).strict();

const InterestCandidateSchema = PendingCandidateBaseSchema.extend({
  value: z.enum(INTEREST_VALUES),
}).strict();

const FundingCandidateSchema = PendingCandidateBaseSchema.extend({
  value: z.enum(FUNDING_SOURCE_VALUES),
}).strict();

const PurchaseTermCandidateSchema = PendingCandidateBaseSchema.extend({
  value: z.enum(PURCHASE_TERM_VALUES),
}).strict();

const CommunicationPreferenceSchema = PendingCandidateBaseSchema.extend({
  channel: z.enum(COMMUNICATION_CHANNEL_VALUES),
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

export const NeedsV3Schema = z
  .object({
    business_needs: z.array(NeedCandidateSchema),
    property_requirements: z.array(NeedCandidateSchema),
    structured_crm_attributes: z
      .object({
        interested_in: z.array(InterestCandidateSchema),
        funding_source: FundingCandidateSchema,
        purchase_term: PurchaseTermCandidateSchema,
      })
      .strict(),
    communication_preferences: z.array(CommunicationPreferenceSchema),
    client_questions: z.array(ClientQuestionSchema),
  })
  .strict();

const NeedsTransportCandidateSchema = TransportPendingCandidateBaseSchema.extend({
  need_type: TransportNonEmptyStringSchema,
  value: TransportNonEmptyStringSchema,
}).strict();

const NeedsTransportInterestSchema = TransportPendingCandidateBaseSchema.extend({
  value: z.enum(transportStringValuesForField(
    "needs.agent.output.v3",
    "structured_crm_attributes.interested_in.*.value",
  )),
}).strict();

const NeedsTransportFundingSchema = TransportPendingCandidateBaseSchema.extend({
  value: z.enum(transportStringValuesForField(
    "needs.agent.output.v3",
    "structured_crm_attributes.funding_source.value",
  )),
}).strict();

const NeedsTransportPurchaseTermSchema = TransportPendingCandidateBaseSchema.extend({
  value: z.enum(transportStringValuesForField(
    "needs.agent.output.v3",
    "structured_crm_attributes.purchase_term.value",
  )),
}).strict();

export const NeedsV3TransportSchema = z
  .object({
    business_needs: z.array(NeedsTransportCandidateSchema),
    property_requirements: z.array(NeedsTransportCandidateSchema),
    structured_crm_attributes: z.object({
      interested_in: z.array(NeedsTransportInterestSchema),
      funding_source: NeedsTransportFundingSchema,
      purchase_term: NeedsTransportPurchaseTermSchema,
    }).strict(),
    communication_preferences: z.array(TransportPendingCandidateBaseSchema.extend({
      channel: z.enum(transportStringValuesForField(
        "needs.agent.output.v3",
        "communication_preferences.*.channel",
      )),
    }).strict()),
    client_questions: z.array(z.object({
      id: TransportIdentifierSchema,
      question: TransportNonEmptyStringSchema,
      source_turn_ids: TransportSourceTurnIdsSchema,
      evidence: TransportNonEmptyStringSchema,
      confidence: TransportConfidenceSchema,
      verification_status: z.literal("extracted"),
    }).strict()),
  })
  .strict();

const baseCandidate = {
  source_turn_ids: ["turn-1"],
  evidence: "Оплачу наличными.",
  confidence: 0.96,
  verification_status: "extracted",
} as const;

const valid = {
  business_needs: [],
  property_requirements: [],
  structured_crm_attributes: {
    interested_in: [],
    funding_source: { id: "funding-1", value: "наличные / депозит", ...baseCandidate },
    purchase_term: { id: "term-1", value: "не определено", ...baseCandidate, evidence: "Срок не обсуждали." },
  },
  communication_preferences: [],
  client_questions: [],
} as const;

export const NeedsV3Contract = defineContract({
  id: "needs.agent.output.v3",
  stageId: "needs_extract",
  description: "Потребности, требования, CRM-атрибуты, предпочтения связи и вопросы.",
  validator: NeedsV3Schema,
  transportValidator: NeedsV3TransportSchema,
  canonicalEnums: [...INTEREST_VALUES, ...FUNDING_SOURCE_VALUES, ...PURCHASE_TERM_VALUES, ...COMMUNICATION_CHANNEL_VALUES],
  normalizationPolicyId: "normalization.needs.v3",
  fixtures: {
    valid,
    missing_required: {
      business_needs: valid.business_needs,
      property_requirements: valid.property_requirements,
      structured_crm_attributes: valid.structured_crm_attributes,
      client_questions: valid.client_questions,
    },
    extra_legacy_field: { ...valid, need_meta: {} },
    invalid_enum: {
      ...valid,
      structured_crm_attributes: {
        ...valid.structured_crm_attributes,
        funding_source: { ...valid.structured_crm_attributes.funding_source, value: "наличными" },
      },
    },
    invalid_nested_type: {
      ...valid,
      structured_crm_attributes: {
        ...valid.structured_crm_attributes,
        interested_in: "Новостройки",
      },
    },
  },
});

export type NeedsV3 = z.infer<typeof NeedsV3Schema>;

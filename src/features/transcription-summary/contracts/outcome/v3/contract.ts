import { z } from "zod";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
} from "../../shared-schemas";

const StringFieldSchema = z.string();
const SourceIdsSchema = z.array(IdentifierSchema);

export const CallResultV3Schema = z.object({
  id: IdentifierSchema,
  value: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
  source_fact_ids: SourceIdsSchema,
  source_turn_ids: SourceIdsSchema,
}).strict();

export const AgreementV3Schema = z.object({
  id: IdentifierSchema,
  action: NonEmptyStringSchema,
  owner: StringFieldSchema,
  recipient: StringFieldSchema,
  deadline: StringFieldSchema,
  channel: StringFieldSchema,
  status: z.enum(["confirmed", "not_defined"]),
  confidence: ConfidenceSchema,
  source_fact_ids: SourceIdsSchema,
  source_turn_ids: SourceIdsSchema,
}).strict();

export const PrimaryNextStepV3Schema = z.object({
  agreement_ids: SourceIdsSchema,
  action: StringFieldSchema,
  owner: StringFieldSchema,
  recipient: StringFieldSchema,
  deadline: StringFieldSchema,
  channel: StringFieldSchema,
  status: z.enum(["confirmed", "not_defined"]),
  confidence: ConfidenceSchema,
}).strict();

export const OutcomeV3Schema = z.object({
  call_results: z.array(CallResultV3Schema),
  agreements: z.array(AgreementV3Schema),
  primary_next_step: PrimaryNextStepV3Schema,
  outcome_meta: z.object({
    result_count: z.number().int().nonnegative(),
    agreement_count: z.number().int().nonnegative(),
    decision: z.enum(["EXTRACTED", "NO_OUTCOME"]),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.outcome_meta.result_count !== value.call_results.length) {
    context.addIssue({
      code: "custom",
      path: ["outcome_meta", "result_count"],
      message: "result_count must equal call_results.length",
    });
  }
  if (value.outcome_meta.agreement_count !== value.agreements.length) {
    context.addIssue({
      code: "custom",
      path: ["outcome_meta", "agreement_count"],
      message: "agreement_count must equal agreements.length",
    });
  }
});

export const OutcomeV3TransportSchema = OutcomeV3Schema;

const valid = {
  call_results: [{
    id: "result_1",
    value: "назначен повторный звонок",
    confidence: 0.95,
    source_fact_ids: ["fact_1"],
    source_turn_ids: ["turn_1"],
  }],
  agreements: [{
    id: "agreement_1",
    action: "агент перезвонит клиенту",
    owner: "Агент",
    recipient: "Клиент",
    deadline: "сегодня вечером",
    channel: "",
    status: "confirmed",
    confidence: 0.95,
    source_fact_ids: ["fact_1"],
    source_turn_ids: ["turn_1"],
  }],
  primary_next_step: {
    agreement_ids: ["agreement_1"],
    action: "агент перезвонит клиенту",
    owner: "Агент",
    recipient: "Клиент",
    deadline: "сегодня вечером",
    channel: "",
    status: "confirmed",
    confidence: 0.95,
  },
  outcome_meta: {
    result_count: 1,
    agreement_count: 1,
    decision: "EXTRACTED",
  },
} as const;

export const EMPTY_OUTCOME_V3 = {
  call_results: [],
  agreements: [],
  primary_next_step: {
    agreement_ids: [],
    action: "",
    owner: "",
    recipient: "",
    deadline: "",
    channel: "",
    status: "not_defined",
    confidence: 0,
  },
  outcome_meta: {
    result_count: 0,
    agreement_count: 0,
    decision: "NO_OUTCOME",
  },
} as const;

export const OUTCOME_CALL_RESULTS_STRING_ARRAY_FIXTURE = {
  ...valid,
  call_results: ["агент уточнит информацию"],
} as const;

export const OutcomeV3Contract = defineContract({
  id: "outcome.agent.output.v3",
  stageId: "outcome_extract",
  description: "Результаты звонка, договорённости и один следующий шаг.",
  validator: OutcomeV3Schema,
  transportValidator: OutcomeV3TransportSchema,
  canonicalEnums: ["confirmed", "not_defined", "EXTRACTED", "NO_OUTCOME"],
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: {
      agreements: valid.agreements,
      primary_next_step: valid.primary_next_step,
      outcome_meta: valid.outcome_meta,
    },
    extra_legacy_field: {
      ...valid,
      call_result: "назначен повторный звонок",
    },
    invalid_enum: {
      ...valid,
      primary_next_step: { ...valid.primary_next_step, status: "agreed" },
    },
    invalid_nested_type: OUTCOME_CALL_RESULTS_STRING_ARRAY_FIXTURE,
  },
});

export type OutcomeV3 = z.infer<typeof OutcomeV3Schema>;

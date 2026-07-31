import { z } from "zod";
import { defineContract } from "../../schema-utils";
import { IdentifierSchema, NonEmptyStringSchema } from "../../shared-schemas";

export const AgreementV3Schema = z.object({
  id: IdentifierSchema,
  action: NonEmptyStringSchema,
  owner: NonEmptyStringSchema,
  deadline: z.string(),
  channel: z.string(),
  status: z.enum(["confirmed", "not_defined"]),
  evidence: NonEmptyStringSchema,
}).strict();

export const PrimaryNextStepV3Schema = z.object({
  action: z.string(),
  owner: z.string(),
  deadline: z.string(),
  channel: z.string(),
  status: z.enum(["confirmed", "not_defined"]),
}).strict();

export const OutcomeV3Schema = z.object({
  call_result: z.string(),
  agreements: z.array(AgreementV3Schema),
  primary_next_step: PrimaryNextStepV3Schema,
}).strict();

export const OutcomeV3TransportSchema = OutcomeV3Schema;

const valid = {
  call_result: "назначен повторный звонок",
  agreements: [{
    id: "agreement_1",
    action: "агент перезвонит клиенту",
    owner: "Агент",
    deadline: "сегодня вечером",
    channel: "",
    status: "confirmed",
    evidence: "буду ждать звонка",
  }],
  primary_next_step: {
    action: "агент перезвонит клиенту",
    owner: "Агент",
    deadline: "сегодня вечером",
    channel: "",
    status: "confirmed",
  },
} as const;

export const EMPTY_OUTCOME_V3 = {
  call_result: "",
  agreements: [],
  primary_next_step: {
    action: "",
    owner: "",
    deadline: "",
    channel: "",
    status: "not_defined",
  },
} as const;

export const OUTCOME_CALL_RESULTS_STRING_ARRAY_FIXTURE = {
  ...valid,
  call_results: ["агент уточнит информацию"],
} as const;

export const OutcomeV3Contract = defineContract({
  id: "outcome.agent.output.v3",
  version: "3.0.0",
  stageId: "outcome_extract",
  description: "Единый результат звонка, договорённости и следующий шаг.",
  validator: OutcomeV3Schema,
  transportValidator: OutcomeV3TransportSchema,
  canonicalEnums: ["confirmed", "not_defined"],
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: {
      agreements: valid.agreements,
      primary_next_step: valid.primary_next_step,
    },
    extra_legacy_field: {
      ...valid,
      call_results: [],
    },
    invalid_enum: {
      ...valid,
      primary_next_step: { ...valid.primary_next_step, status: "agreed" },
    },
    invalid_nested_type: {
      ...valid,
      call_result: ["назначен звонок"],
    },
  },
});

export type OutcomeV3 = z.infer<typeof OutcomeV3Schema>;

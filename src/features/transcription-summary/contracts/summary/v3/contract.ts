import { z } from "zod";
import { defineContract } from "../../schema-utils";
import { NonEmptyStringSchema } from "../../shared-schemas";

export const SummaryV3Schema = z.object({
  conversation_result: NonEmptyStringSchema,
  key_facts: z.array(z.object({
    label: NonEmptyStringSchema,
    value: NonEmptyStringSchema,
  }).strict()).max(4),
  quotes: z.array(z.object({
    text: NonEmptyStringSchema,
  }).strict()).max(2),
  next_step: NonEmptyStringSchema,
}).strict();

const valid = {
  conversation_result: "Клиент рассматривает покупку квартиры. Согласована отправка планировок.",
  key_facts: [
    { label: "Интерес", value: "Клиент рассматривает новостройку." },
    { label: "Оплата", value: "Покупка планируется за наличные." },
  ],
  quotes: [{ text: "Покупаю за наличные." }],
  next_step: "Агент отправит клиенту планировки по электронной почте.",
} as const;

export const SummaryV3Contract = defineContract({
  id: "summary.content.v3",
  version: "3.1.0",
  stageId: "summary_generate",
  description: "Краткое пользовательское Summary без технических полей и CRM-дублей.",
  validator: SummaryV3Schema,
  backwardCompatibility: {
    reads: ["summary.content.v3@3.1.0"],
    writes: "summary.content.v3@3.1.0",
  },
  migration: {
    acceptsLegacyVersions: [],
    migrationPolicyId: "migration.summary-content-v3.0-to-v3.1.unsupported",
  },
  fixtures: {
    valid,
    missing_required: {
      key_facts: valid.key_facts,
      quotes: valid.quotes,
      next_step: valid.next_step,
    },
    extra_legacy_field: { ...valid, metadata: {} },
    invalid_enum: { ...valid, next_step: "" },
    invalid_nested_type: { ...valid, key_facts: ["Оплата наличными."] },
  },
});

export type SummaryV3 = z.infer<typeof SummaryV3Schema>;

const DeprecatedSummaryV3_0Schema = z.object({
  summary_text: z.object({
    conversation_result: NonEmptyStringSchema,
    key_facts: z.array(NonEmptyStringSchema).max(4),
    important_quotes: z.array(NonEmptyStringSchema).max(2),
    agreement_and_next_step: NonEmptyStringSchema.nullable(),
  }).strict(),
  structured_attributes: z.record(z.string(), z.unknown()),
}).strict();

const legacyValid = {
  summary_text: {
    conversation_result: "Клиент ищет новостройку.",
    key_facts: ["Оплата наличными."],
    important_quotes: ["Ищу новостройку."],
    agreement_and_next_step: "Агент отправит планировки.",
  },
  structured_attributes: {},
} as const;

export const DeprecatedSummaryV3_0Contract = defineContract({
  id: "summary.content.v3",
  version: "3.0.0",
  stageId: "summary_generate",
  description: "Deprecated Summary shape.",
  validator: DeprecatedSummaryV3_0Schema,
  status: "deprecated",
  fixtures: {
    valid: legacyValid,
    missing_required: { structured_attributes: {} },
    extra_legacy_field: { ...legacyValid, markdown: "# Summary" },
    invalid_enum: { ...legacyValid, summary_text: null },
    invalid_nested_type: { ...legacyValid, summary_text: "Summary" },
  },
});

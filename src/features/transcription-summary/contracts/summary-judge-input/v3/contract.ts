import { z } from "zod";
import { SUMMARY_CRITERIA } from "../../canonical-enums";
import {
  ConversationStoreV3Contract,
  ConversationStoreV3Schema,
} from "../../conversation-store/v3/contract";
import { defineContract } from "../../schema-utils";
import {
  IdentifierSchema,
  NonEmptyStringSchema,
  SpeakerRoleSchema,
} from "../../shared-schemas";
import { SummaryV3Schema } from "../../summary/v3/contract";
import type { JsonValue } from "../../contract-types";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const SummaryCriterionV3Schema = z.enum(SUMMARY_CRITERIA);

export const SummaryJudgeInputV3Schema = z.object({
  meta: z.object({
    runId: IdentifierSchema,
    manifestHash: Sha256Schema,
    storeId: IdentifierSchema,
    storeContentHash: Sha256Schema,
    transcriptHash: Sha256Schema,
    summaryHash: Sha256Schema,
    summaryContractVersion: z.literal("3.1.0"),
    judgeCriterion: SummaryCriterionV3Schema,
    judgePromptVersion: NonEmptyStringSchema,
  }).strict(),
  conversationStore: ConversationStoreV3Schema,
  summary: SummaryV3Schema,
  transcriptContext: z.object({
    turns: z.array(z.object({
      turnId: IdentifierSchema,
      speakerRole: SpeakerRoleSchema,
      text: NonEmptyStringSchema,
    }).strict()).min(1),
  }).strict(),
  evaluationPolicy: z.object({
    criterion: SummaryCriterionV3Schema,
    weight: z.literal(0.2),
  }).strict(),
}).strict().superRefine((input, context) => {
  const store = input.conversationStore;
  const summary = input.summary;
  if (
    input.meta.runId !== store.meta.run_id
    || input.meta.manifestHash !== store.meta.manifest_hash
    || input.meta.storeId !== store.meta.store_id
    || input.meta.storeContentHash !== store.content_hash
    || input.meta.transcriptHash !== store.meta.transcript_ref.sha256
  ) {
    context.addIssue({
      code: "custom",
      path: ["meta"],
      message: "Judge input metadata must match Conversation Store provenance",
    });
  }
  if (input.meta.judgeCriterion !== input.evaluationPolicy.criterion) {
    context.addIssue({
      code: "custom",
      message: "Judge criterion and Summary provenance must match typed input metadata",
    });
  }
  const sources = new Map(store.sources.map((source) => [source.turn_id, source]));
  if (
    sources.size !== input.transcriptContext.turns.length
    || input.transcriptContext.turns.some((turn) => {
      const source = sources.get(turn.turnId);
      return source?.speaker !== turn.speakerRole || source.text !== turn.text;
    })
  ) {
    context.addIssue({
      code: "custom",
      path: ["transcriptContext"],
      message: "Transcript context must exactly match Store sources",
    });
  }
});

const storeFixture = {
  ...(ConversationStoreV3Contract.fixtures.valid as Record<string, unknown>),
  sources: [{ turn_id: "turn-1", speaker: "client", text: "Спасибо." }],
} as unknown as z.infer<typeof ConversationStoreV3Schema>;

const summaryFixture = {
  conversation_result: "Разговор завершён без зафиксированной договорённости.",
  key_facts: [],
  quotes: [],
  next_step: "Следующий шаг не согласован.",
} as const;

const valid = {
  meta: {
    runId: "run-1",
    manifestHash: "a".repeat(64),
    storeId: storeFixture.meta.store_id,
    storeContentHash: storeFixture.content_hash,
    transcriptHash: "b".repeat(64),
    summaryHash: "d".repeat(64),
    summaryContractVersion: "3.1.0",
    judgeCriterion: "faithfulness",
    judgePromptVersion: "summary-judge-faithfulness-v3.0.0",
  },
  conversationStore: storeFixture,
  summary: summaryFixture,
  transcriptContext: {
    turns: [{ turnId: "turn-1", speakerRole: "client", text: "Спасибо." }],
  },
  evaluationPolicy: { criterion: "faithfulness", weight: 0.2 },
} as const;

export const SummaryJudgeInputV3Contract = defineContract({
  id: "summary.judge.input.v3",
  version: "3.0.0",
  stageId: "summary_judge_input_build",
  description: "Typed immutable input for one criterion-specific Summary Judge v3.",
  validator: SummaryJudgeInputV3Schema,
  canonicalEnums: SUMMARY_CRITERIA,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid: valid as unknown as JsonValue,
    missing_required: { ...valid, summary: null } as unknown as JsonValue,
    extra_legacy_field: { ...valid, otherJudgeScores: [] } as unknown as JsonValue,
    invalid_enum: {
      ...valid,
      meta: { ...valid.meta, judgeCriterion: "truth" },
    } as unknown as JsonValue,
    invalid_nested_type: {
      ...valid,
      evaluationPolicy: { criterion: "completeness", weight: 0.2 },
    } as unknown as JsonValue,
  },
});

export type SummaryCriterionV3 = z.infer<typeof SummaryCriterionV3Schema>;
export type SummaryJudgeInputV3 = z.infer<typeof SummaryJudgeInputV3Schema>;

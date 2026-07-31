import { z } from "zod";
import { JUDGE_VERDICTS } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { JudgeItemSchema } from "../../shared-schemas";

export const OutcomeJudgeV3Schema = z
  .object({
    items: z.array(JudgeItemSchema),
  })
  .strict();

const valid = {
  items: [{
    item_id: "agreement-1",
    verdict: "verified",
    reason_code: "agreement_supported",
    evidence_turn_ids: ["turn-4"],
    confidence: 0.97,
    corrections: [{ wording: "Отправить планировки клиенту" }],
  }],
} as const;

export const OutcomeJudgeV3Contract = defineContract({
  id: "outcome.judge.verdict.v3",
  stageId: "outcome_judge",
  description: "Outcome Judge с corrections только evidence/confidence/source IDs/wording.",
  validator: OutcomeJudgeV3Schema,
  canonicalEnums: JUDGE_VERDICTS,
  fixtures: {
    valid,
    missing_required: { items: [{ item_id: "agreement-1", verdict: "verified" }] },
    extra_legacy_field: { ...valid, agreement_id: "agreement-1" },
    invalid_enum: { items: [{ ...valid.items[0], verdict: "accepted" }] },
    invalid_nested_type: { items: [{ ...valid.items[0], corrections: [{ status: "completed" }] }] },
  },
});

export type OutcomeJudgeV3 = z.infer<typeof OutcomeJudgeV3Schema>;

import { z } from "zod";
import { JUDGE_VERDICTS } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { JudgeItemSchema } from "../../shared-schemas";

export const FactJudgeV3Schema = z
  .object({
    items: z.array(JudgeItemSchema),
  })
  .strict();

const valid = {
  items: [{
    item_id: "question-1",
    verdict: "verified",
    reason_code: "question_exactly_supported",
    evidence_turn_ids: ["turn-1"],
    confidence: 1,
    corrections: [],
  }],
} as const;

export const FactJudgeV3Contract = defineContract({
  id: "facts.judge.verdict.v3",
  stageId: "facts_judge",
  description: "Verdict Fact Judge с закрытым списком correction fields.",
  validator: FactJudgeV3Schema,
  canonicalEnums: JUDGE_VERDICTS,
  fixtures: {
    valid,
    missing_required: {
      items: [{
        item_id: valid.items[0].item_id,
        reason_code: valid.items[0].reason_code,
        evidence_turn_ids: valid.items[0].evidence_turn_ids,
        confidence: valid.items[0].confidence,
        corrections: valid.items[0].corrections,
      }],
    },
    extra_legacy_field: { ...valid, reconciliation: {} },
    invalid_enum: { items: [{ ...valid.items[0], verdict: "approved" }] },
    invalid_nested_type: { items: [{ ...valid.items[0], confidence: "high" }] },
  },
});

export type FactJudgeV3 = z.infer<typeof FactJudgeV3Schema>;

import { z } from "zod";
import { JUDGE_VERDICTS } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { JudgeItemSchema } from "../../shared-schemas";

export const NeedJudgeV3Schema = z
  .object({
    items: z.array(JudgeItemSchema),
  })
  .strict();

const valid = {
  items: [{
    item_id: "funding-1",
    verdict: "verified",
    reason_code: "canonical_value_supported",
    evidence_turn_ids: ["turn-1"],
    confidence: 0.96,
    corrections: [{ confidence: 0.98, source_turn_ids: ["turn-1"], evidence: "Оплачу наличными." }],
  }],
} as const;

export const NEED_JUDGE_CANONICAL_VALUE_CORRECTION_FIXTURE = {
  items: [{
    ...valid.items[0],
    corrections: [{ value: "наличными" }],
  }],
} as const;

export const NeedJudgeV3Contract = defineContract({
  id: "needs.judge.verdict.v3",
  stageId: "needs_judge",
  description: "Need Judge без права менять canonical business value.",
  validator: NeedJudgeV3Schema,
  canonicalEnums: JUDGE_VERDICTS,
  fixtures: {
    valid,
    missing_required: {
      items: [{
        item_id: valid.items[0].item_id,
        verdict: valid.items[0].verdict,
        evidence_turn_ids: valid.items[0].evidence_turn_ids,
        confidence: valid.items[0].confidence,
        corrections: valid.items[0].corrections,
      }],
    },
    extra_legacy_field: { ...valid, continue_pipeline: true },
    invalid_enum: { items: [{ ...valid.items[0], verdict: "corrected" }] },
    invalid_nested_type: {
      items: [{
        ...valid.items[0],
        corrections: [{ confidence: "high" }],
      }],
    },
  },
});

export type NeedJudgeV3 = z.infer<typeof NeedJudgeV3Schema>;

import { z } from "zod";
import { JUDGE_VERDICTS, SPEAKER_ROLES } from "./canonical-enums";

export const NonEmptyStringSchema = z.string().trim().min(1);
export const IdentifierSchema = z.string().trim().min(1);
export const ConfidenceSchema = z.number().min(0).max(1);
export const SourceTurnIdsSchema = z.array(IdentifierSchema).min(1);
export const SpeakerRoleSchema = z.enum(SPEAKER_ROLES);

export const EvidenceSchema = z
  .object({
    text: NonEmptyStringSchema,
    source_turn_ids: SourceTurnIdsSchema,
  })
  .strict();

export const PendingCandidateBaseSchema = z
  .object({
    id: IdentifierSchema,
    source_turn_ids: SourceTurnIdsSchema,
    evidence: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    verification_status: z.literal("extracted"),
  })
  .strict();

export const JudgeVerdictValueSchema = z.enum(JUDGE_VERDICTS);

export const AllowedCorrectionSchema = z
  .object({
    confidence: ConfidenceSchema.optional(),
    source_turn_ids: SourceTurnIdsSchema.optional(),
    evidence: NonEmptyStringSchema.optional(),
    wording: NonEmptyStringSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "correction must contain an allowed field");

export const JudgeItemSchema = z
  .object({
    item_id: IdentifierSchema,
    verdict: JudgeVerdictValueSchema,
    reason_code: NonEmptyStringSchema,
    evidence_turn_ids: z.array(IdentifierSchema),
    confidence: ConfidenceSchema,
    corrections: z.array(AllowedCorrectionSchema),
  })
  .strict();

export const SourceReferenceSchema = z
  .object({
    turn_id: IdentifierSchema,
    speaker: SpeakerRoleSchema,
    text: NonEmptyStringSchema,
  })
  .strict();

export const VerifiedStatusSchema = z.literal("verified");

export const RejectedItemReferenceSchema = z
  .object({
    item_id: IdentifierSchema,
    reason: z.enum([
      "rejected",
      "not_enough_evidence",
      "technical_error",
      "invariant_violation",
      "deduplicated",
    ]),
  })
  .strict();

export const VerdictTrailEntrySchema = z
  .object({
    item_id: IdentifierSchema,
    agent_value: z.json(),
    judge_verdict: z.enum([...JUDGE_VERDICTS, "technical_error"]),
    applied_correction: AllowedCorrectionSchema.nullable(),
    invariant_result: z.enum(["passed", "failed"]),
    final_verdict: z.enum([
      "verified",
      "rejected",
      "not_enough_evidence",
      "technical_error",
      "invariant_violation",
      "deduplicated",
    ]),
    rule_id: NonEmptyStringSchema,
  })
  .strict();

export const ReconciliationTechnicalMetadataSchema = z
  .object({
    reconciliation_status: z.literal("completed"),
    reconciled_at: z.string().datetime(),
    source_contract_id: NonEmptyStringSchema,
    judge_contract_id: NonEmptyStringSchema,
  })
  .strict();

export function addVerifiedBoundaryChecks(
  value: {
    source_references: readonly z.infer<typeof SourceReferenceSchema>[];
    rejected_item_references: readonly z.infer<typeof RejectedItemReferenceSchema>[];
    verdict_trail: readonly z.infer<typeof VerdictTrailEntrySchema>[];
  },
  context: z.RefinementCtx,
  collections: ReadonlyArray<readonly {
    id: string;
    source_turn_ids?: readonly string[];
    source_turn_id?: string;
  }[]>,
): void {
  const sourceIds = new Set(value.source_references.map((source) => source.turn_id));
  const verifiedIds = new Set<string>();

  for (const collection of collections) {
    for (const item of collection) {
      if (verifiedIds.has(item.id)) {
        context.addIssue({ code: "custom", message: `duplicate verified item ID: ${item.id}` });
      }
      verifiedIds.add(item.id);
      const itemSourceIds = item.source_turn_ids ?? (item.source_turn_id ? [item.source_turn_id] : []);
      for (const sourceId of itemSourceIds) {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({ code: "custom", message: `unknown source turn ID: ${sourceId}` });
        }
      }
    }
  }

  for (const rejected of value.rejected_item_references) {
    if (verifiedIds.has(rejected.item_id)) {
      context.addIssue({ code: "custom", message: `rejected item is present in verified collection: ${rejected.item_id}` });
    }
  }

  const trailIds = new Set(value.verdict_trail.map((entry) => entry.item_id));
  for (const verifiedId of verifiedIds) {
    if (!trailIds.has(verifiedId)) {
      context.addIssue({ code: "custom", message: `missing verdict trail: ${verifiedId}` });
    }
  }
  for (const entry of value.verdict_trail) {
    if (["technical_error", "rejected", "not_enough_evidence"].includes(entry.final_verdict) && verifiedIds.has(entry.item_id)) {
      context.addIssue({ code: "custom", message: `non-verified trail item is present in verified collection: ${entry.item_id}` });
    }
  }
}

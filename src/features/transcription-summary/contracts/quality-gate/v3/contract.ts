import { z } from "zod";
import { QUALITY_GATE_DECISIONS, SUMMARY_CRITERIA } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { NonEmptyStringSchema } from "../../shared-schemas";
import { SUMMARY_QUALITY_GATE_POLICY_VERSION } from "../../quality-gate-input/v3/contract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const SummaryCriterionSchema = z.enum(SUMMARY_CRITERIA);

const CriterionResultSchema = z.object({
  criterion: SummaryCriterionSchema,
  score: z.number().min(0).max(100).nullable(),
  verdict: z.enum(["pass", "warning", "fail", "technical_error"]),
  weight: z.literal(0.2),
  evaluated: z.boolean(),
}).strict();

const FindingSchema = z.object({
  code: NonEmptyStringSchema,
  criterion: SummaryCriterionSchema.optional(),
  message: NonEmptyStringSchema,
}).strict();

export const SummaryQualityGateResultV3Schema = z.object({
  decision: z.literal("QUALITY_RECORDED"),
  blocking: z.literal(false),
  qualityScore: z.number().min(0).max(100).nullable(),
  qualityStatus: z.enum(["EXCELLENT", "GOOD", "NEEDS_ATTENTION", "LOW_QUALITY", "NOT_EVALUATED"]),
  evaluationStatus: z.enum(["complete", "partial", "technical_error"]),
  evaluatedChecks: z.number().int().min(0).max(5),
  failedChecks: z.number().int().min(0).max(5),
  technicalErrors: z.number().int().min(0).max(5),
  partialEvaluation: z.boolean(),
  criterionResults: z.array(CriterionResultSchema).length(5),
  issues: z.array(FindingSchema),
  criticalIssues: z.array(FindingSchema),
  metadata: z.object({
    runId: NonEmptyStringSchema,
    sourceStoreId: NonEmptyStringSchema,
    sourceStoreHash: Sha256Schema,
    sourceSummaryHash: Sha256Schema,
    manifestHash: Sha256Schema,
    contractVersion: z.literal("3.2.0"),
    policyVersion: z.literal(SUMMARY_QUALITY_GATE_POLICY_VERSION),
  }).strict(),
}).strict().superRefine((result, context) => {
  const criteria = result.criterionResults.map((entry) => entry.criterion);
  if (
    criteria.some((criterion, index) => criterion !== SUMMARY_CRITERIA[index])
    || new Set(criteria).size !== SUMMARY_CRITERIA.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["criterionResults"],
      message: "Criterion results must use canonical order",
    });
  }
  const evaluated = result.criterionResults.filter((entry) => entry.evaluated);
  if (result.evaluatedChecks !== evaluated.length) {
    context.addIssue({ code: "custom", path: ["evaluatedChecks"], message: "evaluatedChecks mismatch" });
  }
  if ((evaluated.length === 0) !== (result.qualityScore === null)) {
    context.addIssue({ code: "custom", path: ["qualityScore"], message: "qualityScore availability mismatch" });
  }
});

const hash = "a".repeat(64);
const valid = {
  decision: "QUALITY_RECORDED",
  blocking: false,
  qualityScore: 100,
  qualityStatus: "EXCELLENT",
  evaluationStatus: "complete",
  evaluatedChecks: 5,
  failedChecks: 0,
  technicalErrors: 0,
  partialEvaluation: false,
  criterionResults: SUMMARY_CRITERIA.map((criterion) => ({
    criterion,
    score: 100,
    verdict: "pass",
    weight: 0.2,
    evaluated: true,
  })),
  issues: [],
  criticalIssues: [],
  metadata: {
    runId: "run-1",
    sourceStoreId: "store-0123456789abcdef01234567",
    sourceStoreHash: hash,
    sourceSummaryHash: "b".repeat(64),
    manifestHash: "c".repeat(64),
    contractVersion: "3.2.0",
    policyVersion: SUMMARY_QUALITY_GATE_POLICY_VERSION,
  },
} as const;

export const QualityGateV3Contract = defineContract({
  id: "summary.quality-gate.v3",
  version: "3.2.0",
  stageId: "summary_quality_gate_v3",
  description: "Неблокирующая аналитическая оценка пяти Summary Judge.",
  validator: SummaryQualityGateResultV3Schema,
  canonicalEnums: [...QUALITY_GATE_DECISIONS, ...SUMMARY_CRITERIA],
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: { decision: valid.decision },
    extra_legacy_field: { ...valid, blockers: [] },
    invalid_enum: { ...valid, decision: "AUTO_SAVE" },
    invalid_nested_type: { ...valid, blocking: true },
  },
  backwardCompatibility: {
    reads: ["summary.quality-gate.v3@3.1.0", "summary.quality-gate.v3@3.2.0"],
    writes: "summary.quality-gate.v3@3.2.0",
  },
});

export type SummaryQualityGateResultV3 = z.infer<typeof SummaryQualityGateResultV3Schema>;
export type QualityGateV3 = SummaryQualityGateResultV3;

export const DeprecatedQualityGateV3_0Schema = z.object({ decision: z.string() }).passthrough();
export const DeprecatedQualityGateV3_0Contract = defineContract({
  id: "summary.quality-gate.v3",
  version: "3.0.0",
  stageId: "summary_quality_gate",
  description: "Deprecated blocking Quality Gate.",
  validator: DeprecatedQualityGateV3_0Schema,
  status: "deprecated",
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid: { decision: "AUTO_SAVE" },
    missing_required: {},
    extra_legacy_field: { decision: "AUTO_SAVE", score: 100 },
    invalid_enum: { decision: null },
    invalid_nested_type: { decision: 1 },
  },
});

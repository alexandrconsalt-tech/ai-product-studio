import { z } from "zod";
import { SUMMARY_CRITERIA } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import { IdentifierSchema } from "../../shared-schemas";
import { SummaryJudgeV3Schema } from "../../summary-judges/v3/contract";
import { SummaryV3Schema } from "../../summary/v3/contract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const SUMMARY_QUALITY_GATE_POLICY_ID = "quality-gate-policy-v3.0.0";
export const SUMMARY_QUALITY_GATE_POLICY_VERSION = "3.0.0";
export const SUMMARY_QUALITY_GATE_WEIGHTS = Object.freeze({
  faithfulness: 0.2,
  completeness: 0.2,
  usefulness: 0.2,
  agreements_next_step: 0.2,
  format: 0.2,
} as const);
export const SUMMARY_QUALITY_GATE_THRESHOLDS = Object.freeze({
  autoSaveMinScore: 95,
  warningMinScore: 80,
  reviewMinScore: 0,
} as const);

export const SummaryQualityGatePolicyV3Schema = z.object({
  weights: z.object({
    faithfulness: z.literal(0.2),
    completeness: z.literal(0.2),
    usefulness: z.literal(0.2),
    agreements_next_step: z.literal(0.2),
    format: z.literal(0.2),
  }).strict(),
  thresholds: z.object({
    autoSaveMinScore: z.literal(95),
    warningMinScore: z.literal(80),
    reviewMinScore: z.literal(0),
  }).strict(),
}).strict().superRefine((policy, context) => {
  const weightSum = Object.values(policy.weights).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(weightSum - 1) > Number.EPSILON) {
    context.addIssue({
      code: "custom",
      path: ["weights"],
      message: "Quality Gate weights must sum to 1",
    });
  }
});

export const SummaryQualityGateInputV3Schema = z.object({
  meta: z.object({
    runId: IdentifierSchema,
    manifestHash: Sha256Schema,
    storeId: IdentifierSchema,
    storeContentHash: Sha256Schema,
    summaryHash: Sha256Schema,
    summaryContractVersion: z.literal("3.1.0"),
    judgeContractVersion: z.literal("3.1.0"),
    qualityGatePolicyVersion: z.literal(SUMMARY_QUALITY_GATE_POLICY_VERSION),
  }).strict(),
  summary: SummaryV3Schema,
  verdicts: z.array(SummaryJudgeV3Schema).length(5),
  policy: SummaryQualityGatePolicyV3Schema,
}).strict().superRefine((input, context) => {
  const criteria = input.verdicts.map((verdict) => verdict.criterion);
  if (
    new Set(criteria).size !== SUMMARY_CRITERIA.length
    || SUMMARY_CRITERIA.some((criterion) => !criteria.includes(criterion))
  ) {
    context.addIssue({
      code: "custom",
      path: ["verdicts"],
      message: "Quality Gate requires each of the five criteria exactly once",
    });
  }
  if (
    input.verdicts.some((verdict) =>
      verdict.metadata.sourceStoreId !== input.meta.storeId
      || verdict.metadata.sourceStoreHash !== input.meta.storeContentHash
      || verdict.metadata.sourceSummaryHash !== input.meta.summaryHash
      || verdict.metadata.contractVersion !== input.meta.judgeContractVersion
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["meta"],
      message: "Quality Gate Store, Summary and Judge provenance must match",
    });
  }
});

const hash = "a".repeat(64);
const summary = {
  conversation_result: "Клиент ищет новостройку; согласована отправка планировок.",
  key_facts: [{ label: "Оплата", value: "Покупка за наличные." }],
  quotes: [],
  next_step: "Агент отправит планировки.",
} as const;
const summaryHash = "c".repeat(64);
const payloads = {
  faithfulness: {
    criterion: "faithfulness",
    unsupportedClaims: [],
    distortedFacts: [],
    roleErrors: [],
    quoteErrors: [],
    attributeMismatches: [],
  },
  completeness: {
    criterion: "completeness",
    missingGoal: [],
    missingRequirements: [],
    missingConstraints: [],
    missingFinancialContext: [],
    missingOutcome: [],
    missingNextStep: [],
    missingCriticalQuestions: [],
  },
  usefulness: {
    criterion: "usefulness",
    agentBlockingOmissions: [],
    unclearStatements: [],
    missingOperationalContext: [],
    unnecessaryDetails: [],
    usabilityAssessment: "ready",
  },
  agreements_next_step: {
    criterion: "agreements_next_step",
    missingAction: [],
    incorrectOwner: [],
    incorrectRecipient: [],
    incorrectDeadline: [],
    incorrectChannel: [],
    incorrectStatus: [],
    missingNextStep: [],
    inventedDetails: [],
  },
  format: {
    criterion: "format",
    semanticRepetitions: [],
    crmCardDuplications: [],
    verbosityIssues: [],
    structureIssues: [],
    readabilityIssues: [],
    technicalFieldLeaks: [],
  },
} as const;
const verdicts = SUMMARY_CRITERIA.map((criterion) => ({
  criterion,
  verdict: "pass" as const,
  score: 100 as const,
  confidence: 1,
  issues: [],
  evidence: [],
  payload: payloads[criterion],
  metadata: {
    sourceStoreId: "store-0123456789abcdef01234567",
    sourceStoreHash: "b".repeat(64),
    sourceSummaryHash: summaryHash,
    contractVersion: "3.1.0" as const,
    promptVersion: `summary-judge-${criterion}-v3.0.0`,
  },
}));
const valid = {
  meta: {
    runId: "run-1",
    manifestHash: hash,
    storeId: "store-0123456789abcdef01234567",
    storeContentHash: "b".repeat(64),
    summaryHash,
    summaryContractVersion: "3.1.0",
    judgeContractVersion: "3.1.0",
    qualityGatePolicyVersion: SUMMARY_QUALITY_GATE_POLICY_VERSION,
  },
  summary,
  verdicts,
  policy: {
    weights: SUMMARY_QUALITY_GATE_WEIGHTS,
    thresholds: SUMMARY_QUALITY_GATE_THRESHOLDS,
  },
} as const;

export const SummaryQualityGateInputV3Contract = defineContract({
  id: "summary.quality-gate.input.v3",
  version: "3.0.0",
  stageId: "summary_quality_gate_input_build",
  description: "Typed immutable input for deterministic Summary Quality Gate v3.",
  validator: SummaryQualityGateInputV3Schema,
  canonicalEnums: SUMMARY_CRITERIA,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid,
    missing_required: { ...valid, verdicts: valid.verdicts.slice(0, 4) },
    extra_legacy_field: { ...valid, confidenceWeight: 0.5 },
    invalid_enum: {
      ...valid,
      verdicts: valid.verdicts.map((verdict, index) =>
        index === 0 ? { ...verdict, criterion: "truth" } : verdict
      ),
    },
    invalid_nested_type: {
      ...valid,
      policy: {
        ...valid.policy,
        weights: { ...valid.policy.weights, format: 0.3 },
      },
    },
  },
});

export type SummaryQualityGatePolicyV3 = z.infer<typeof SummaryQualityGatePolicyV3Schema>;
export type SummaryQualityGateInputV3 = z.infer<typeof SummaryQualityGateInputV3Schema>;

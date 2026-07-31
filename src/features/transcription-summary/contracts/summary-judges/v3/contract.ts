import { z } from "zod";
import { SUMMARY_CRITERIA } from "../../canonical-enums";
import { defineContract } from "../../schema-utils";
import {
  ConfidenceSchema,
  IdentifierSchema,
  NonEmptyStringSchema,
} from "../../shared-schemas";

export const SUMMARY_JUDGE_SCORE_VALUES = [0, 25, 50, 75, 100] as const;
export const SUMMARY_JUDGE_VERDICTS = [
  "pass",
  "warning",
  "fail",
  "technical_error",
] as const;

export const SUMMARY_JUDGE_ISSUE_CODES = Object.freeze({
  faithfulness: [
    "unsupported_claim",
    "distorted_fact",
    "role_error",
    "quote_error",
    "attribute_mismatch",
    "invalid_outcome",
    "invented_detail",
  ],
  completeness: [
    "missing_goal",
    "missing_requirement",
    "missing_constraint",
    "missing_financial_context",
    "missing_outcome",
    "missing_next_step",
    "missing_critical_question",
  ],
  usefulness: [
    "agent_blocking_omission",
    "unclear_statement",
    "missing_operational_context",
    "unnecessary_detail",
  ],
  agreements_next_step: [
    "missing_action",
    "incorrect_owner",
    "incorrect_recipient",
    "incorrect_deadline",
    "incorrect_channel",
    "incorrect_status",
    "missing_next_step",
    "invented_detail",
  ],
  format: [
    "semantic_repetition",
    "crm_card_duplication",
    "verbosity",
    "structure",
    "readability",
    "technical_field_leak",
  ],
} as const) satisfies Readonly<
  Record<(typeof SUMMARY_CRITERIA)[number], readonly string[]>
>;

export const SummaryJudgeFindingV3Schema = z.object({
  code: NonEmptyStringSchema,
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: NonEmptyStringSchema,
  summaryFragment: NonEmptyStringSchema.optional(),
  sourceTurnIds: z.array(IdentifierSchema).min(1).optional(),
  storeItemIds: z.array(IdentifierSchema).min(1).optional(),
}).strict();

const SummaryJudgeEvidenceV3Schema = z.object({
  statement: NonEmptyStringSchema,
  sourceTurnIds: z.array(IdentifierSchema).min(1).optional(),
  storeItemIds: z.array(IdentifierSchema).min(1).optional(),
}).strict();

const SummaryJudgeMetadataV3Schema = z.object({
  sourceStoreId: IdentifierSchema,
  sourceStoreHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceSummaryHash: z.string().regex(/^[a-f0-9]{64}$/),
  contractVersion: z.literal("3.1.0"),
  promptVersion: NonEmptyStringSchema,
}).strict();

const FaithfulnessPayloadSchema = z.object({
  criterion: z.literal("faithfulness"),
  unsupportedClaims: z.array(SummaryJudgeFindingV3Schema),
  distortedFacts: z.array(SummaryJudgeFindingV3Schema),
  roleErrors: z.array(SummaryJudgeFindingV3Schema),
  quoteErrors: z.array(SummaryJudgeFindingV3Schema),
  attributeMismatches: z.array(SummaryJudgeFindingV3Schema),
}).strict();

const CompletenessPayloadSchema = z.object({
  criterion: z.literal("completeness"),
  missingGoal: z.array(SummaryJudgeFindingV3Schema),
  missingRequirements: z.array(SummaryJudgeFindingV3Schema),
  missingConstraints: z.array(SummaryJudgeFindingV3Schema),
  missingFinancialContext: z.array(SummaryJudgeFindingV3Schema),
  missingOutcome: z.array(SummaryJudgeFindingV3Schema),
  missingNextStep: z.array(SummaryJudgeFindingV3Schema),
  missingCriticalQuestions: z.array(SummaryJudgeFindingV3Schema),
}).strict();

const UsefulnessPayloadSchema = z.object({
  criterion: z.literal("usefulness"),
  agentBlockingOmissions: z.array(SummaryJudgeFindingV3Schema),
  unclearStatements: z.array(SummaryJudgeFindingV3Schema),
  missingOperationalContext: z.array(SummaryJudgeFindingV3Schema),
  unnecessaryDetails: z.array(SummaryJudgeFindingV3Schema),
  usabilityAssessment: z.enum(["ready", "partially_ready", "not_ready"]),
}).strict();

const AgreementsPayloadSchema = z.object({
  criterion: z.literal("agreements_next_step"),
  missingAction: z.array(SummaryJudgeFindingV3Schema),
  incorrectOwner: z.array(SummaryJudgeFindingV3Schema),
  incorrectRecipient: z.array(SummaryJudgeFindingV3Schema),
  incorrectDeadline: z.array(SummaryJudgeFindingV3Schema),
  incorrectChannel: z.array(SummaryJudgeFindingV3Schema),
  incorrectStatus: z.array(SummaryJudgeFindingV3Schema),
  missingNextStep: z.array(SummaryJudgeFindingV3Schema),
  inventedDetails: z.array(SummaryJudgeFindingV3Schema),
}).strict();

const FormatPayloadSchema = z.object({
  criterion: z.literal("format"),
  semanticRepetitions: z.array(SummaryJudgeFindingV3Schema),
  crmCardDuplications: z.array(SummaryJudgeFindingV3Schema),
  verbosityIssues: z.array(SummaryJudgeFindingV3Schema),
  structureIssues: z.array(SummaryJudgeFindingV3Schema),
  readabilityIssues: z.array(SummaryJudgeFindingV3Schema),
  technicalFieldLeaks: z.array(SummaryJudgeFindingV3Schema),
}).strict();

export const SummaryJudgePayloadV3Schema = z.discriminatedUnion("criterion", [
  FaithfulnessPayloadSchema,
  CompletenessPayloadSchema,
  UsefulnessPayloadSchema,
  AgreementsPayloadSchema,
  FormatPayloadSchema,
]);

const scoreSchema = z.union([
  z.literal(0),
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(100),
]).nullable();

const commonFields = {
  verdict: z.enum(SUMMARY_JUDGE_VERDICTS),
  score: scoreSchema,
  confidence: ConfidenceSchema.nullable(),
  issues: z.array(SummaryJudgeFindingV3Schema),
  evidence: z.array(SummaryJudgeEvidenceV3Schema),
  metadata: SummaryJudgeMetadataV3Schema,
} as const;

export const SummaryJudgeV3TransportSchema = z.object({
  criterion: z.enum(SUMMARY_CRITERIA),
  ...commonFields,
  payload: z.union([
    FaithfulnessPayloadSchema,
    CompletenessPayloadSchema,
    UsefulnessPayloadSchema,
    AgreementsPayloadSchema,
    FormatPayloadSchema,
  ]),
}).strict().superRefine((value, context) => {
  if (value.criterion !== value.payload.criterion) {
    context.addIssue({
      code: "custom",
      path: ["payload", "criterion"],
      message: `payload criterion must match root criterion "${value.criterion}"`,
    });
  }
});

export const SummaryJudgeV3Schema = z.discriminatedUnion("criterion", [
  z.object({
    criterion: z.literal("faithfulness"),
    ...commonFields,
    payload: FaithfulnessPayloadSchema,
  }).strict(),
  z.object({
    criterion: z.literal("completeness"),
    ...commonFields,
    payload: CompletenessPayloadSchema,
  }).strict(),
  z.object({
    criterion: z.literal("usefulness"),
    ...commonFields,
    payload: UsefulnessPayloadSchema,
  }).strict(),
  z.object({
    criterion: z.literal("agreements_next_step"),
    ...commonFields,
    payload: AgreementsPayloadSchema,
  }).strict(),
  z.object({
    criterion: z.literal("format"),
    ...commonFields,
    payload: FormatPayloadSchema,
  }).strict(),
]).superRefine((value, context) => {
  const expectedVerdict = value.score === 100
    ? "pass"
    : value.score === 75
      ? "warning"
      : value.score === null
        ? "technical_error"
        : "fail";
  if (value.verdict !== expectedVerdict) {
    context.addIssue({
      code: "custom",
      path: ["verdict"],
      message: `verdict must be ${expectedVerdict} for score ${String(value.score)}`,
    });
  }
  if (
    (value.verdict === "technical_error" && value.confidence !== null)
    || (value.verdict !== "technical_error" && value.confidence === null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["confidence"],
      message: "technical_error requires null confidence; quality verdict requires confidence",
    });
  }
});

const emptyFindingArrays = {
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

export const SUMMARY_JUDGE_PAYLOAD_FIXTURES = Object.freeze(emptyFindingArrays);

const metadata = {
  sourceStoreId: "store-0123456789abcdef01234567",
  sourceStoreHash: "a".repeat(64),
  sourceSummaryHash: "b".repeat(64),
  contractVersion: "3.1.0",
  promptVersion: "summary-judge-faithfulness-v3.0.0",
} as const;

const valid = {
  criterion: "faithfulness",
  verdict: "pass",
  score: 100,
  confidence: 1,
  issues: [],
  evidence: [],
  payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES.faithfulness,
  metadata,
} as const;

export const SummaryJudgeV3Contract = defineContract({
  id: "summary.judge.verdict.v3",
  version: "3.1.0",
  stageId: "summary_judges",
  description: "Five independent Summary Judges with a criterion-discriminated payload and source provenance.",
  validator: SummaryJudgeV3Schema,
  transportValidator: SummaryJudgeV3TransportSchema,
  canonicalEnums: [
    ...SUMMARY_CRITERIA,
    ...SUMMARY_JUDGE_VERDICTS,
    ...SUMMARY_JUDGE_SCORE_VALUES.map(String),
  ],
  fixtures: {
    valid,
    missing_required: {
      criterion: valid.criterion,
      verdict: valid.verdict,
      score: valid.score,
      confidence: valid.confidence,
      issues: valid.issues,
      evidence: valid.evidence,
      payload: valid.payload,
    },
    extra_legacy_field: { ...valid, weight: 20 },
    invalid_enum: { ...valid, score: 87 },
    invalid_nested_type: {
      ...valid,
      payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES.format,
    },
  },
  backwardCompatibility: {
    reads: ["summary.judge.verdict.v3@3.1.0"],
    writes: "summary.judge.verdict.v3@3.1.0",
  },
  migration: {
    acceptsLegacyVersions: [],
    migrationPolicyId: null,
  },
});

const DeprecatedSummaryJudgeIssueSchema = z.object({
  code: NonEmptyStringSchema,
  severity: z.enum(["warning", "critical"]),
  summary_path: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
}).strict();

const DeprecatedSummaryJudgeEvidenceSchema = z.object({
  summary_path: NonEmptyStringSchema,
  source_ids: z.array(IdentifierSchema),
  explanation: NonEmptyStringSchema,
}).strict();

const DeprecatedFaithfulnessPayloadSchema = z.object({
  criterion: z.literal("faithfulness"),
  unsupported_claims: z.array(NonEmptyStringSchema),
  distorted_facts: z.array(NonEmptyStringSchema),
  role_errors: z.array(NonEmptyStringSchema),
  quote_errors: z.array(NonEmptyStringSchema),
}).strict();

const DeprecatedCompletenessPayloadSchema = z.object({
  criterion: z.literal("completeness"),
  missing_critical_items: z.array(NonEmptyStringSchema),
  omitted_goal: z.boolean(),
  omitted_requirements: z.array(NonEmptyStringSchema),
  omitted_objections: z.array(NonEmptyStringSchema),
  omitted_outcome: z.boolean(),
  omitted_next_step: z.boolean(),
}).strict();

const DeprecatedUsefulnessPayloadSchema = z.object({
  criterion: z.literal("usefulness"),
  agent_blocking_omissions: z.array(NonEmptyStringSchema),
  unclear_statements: z.array(NonEmptyStringSchema),
  unnecessary_details: z.array(NonEmptyStringSchema),
  usability_assessment: NonEmptyStringSchema,
}).strict();

const DeprecatedAgreementsPayloadSchema = z.object({
  criterion: z.literal("agreements_next_step"),
  incorrect_owner: z.array(NonEmptyStringSchema),
  incorrect_action: z.array(NonEmptyStringSchema),
  incorrect_deadline: z.array(NonEmptyStringSchema),
  incorrect_channel: z.array(NonEmptyStringSchema),
  missing_next_step_components: z.array(NonEmptyStringSchema),
}).strict();

const DeprecatedFormatPayloadSchema = z.object({
  criterion: z.literal("format"),
  semantic_repetitions: z.array(NonEmptyStringSchema),
  verbosity_issues: z.array(NonEmptyStringSchema),
  structure_issues: z.array(NonEmptyStringSchema),
  crm_card_duplication: z.array(NonEmptyStringSchema),
  readability_issues: z.array(NonEmptyStringSchema),
}).strict();

export const DeprecatedSummaryJudgePayloadV3_0Schema = z.discriminatedUnion("criterion", [
  DeprecatedFaithfulnessPayloadSchema,
  DeprecatedCompletenessPayloadSchema,
  DeprecatedUsefulnessPayloadSchema,
  DeprecatedAgreementsPayloadSchema,
  DeprecatedFormatPayloadSchema,
]);

export const DeprecatedSummaryJudgeV3_0Schema = z.object({
  criterion: z.enum(SUMMARY_CRITERIA),
  verdict: z.enum(SUMMARY_JUDGE_VERDICTS),
  score: z.number().min(0).max(100).nullable(),
  confidence: ConfidenceSchema.nullable(),
  issues: z.array(DeprecatedSummaryJudgeIssueSchema),
  evidence: z.array(DeprecatedSummaryJudgeEvidenceSchema),
  payload: DeprecatedSummaryJudgePayloadV3_0Schema,
}).strict().superRefine((value, context) => {
  if (value.criterion !== value.payload.criterion) {
    context.addIssue({
      code: "custom",
      path: ["payload", "criterion"],
      message: "payload criterion must match envelope criterion",
    });
  }
  if (value.verdict === "technical_error" && (value.score !== null || value.confidence !== null)) {
    context.addIssue({ code: "custom", message: "technical_error cannot contain score or confidence" });
  }
  if (value.verdict !== "technical_error" && (value.score === null || value.confidence === null)) {
    context.addIssue({ code: "custom", message: "quality verdict requires score and confidence" });
  }
});

export const DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES = Object.freeze({
  faithfulness: {
    criterion: "faithfulness",
    unsupported_claims: [],
    distorted_facts: [],
    role_errors: [],
    quote_errors: [],
  },
  completeness: {
    criterion: "completeness",
    missing_critical_items: [],
    omitted_goal: false,
    omitted_requirements: [],
    omitted_objections: [],
    omitted_outcome: false,
    omitted_next_step: false,
  },
  usefulness: {
    criterion: "usefulness",
    agent_blocking_omissions: [],
    unclear_statements: [],
    unnecessary_details: [],
    usability_assessment: "Саммари пригодно для работы агента.",
  },
  agreements_next_step: {
    criterion: "agreements_next_step",
    incorrect_owner: [],
    incorrect_action: [],
    incorrect_deadline: [],
    incorrect_channel: [],
    missing_next_step_components: [],
  },
  format: {
    criterion: "format",
    semantic_repetitions: [],
    verbosity_issues: [],
    structure_issues: [],
    crm_card_duplication: [],
    readability_issues: [],
  },
} as const);

const deprecatedValid = {
  criterion: "faithfulness",
  verdict: "pass",
  score: 100,
  confidence: 1,
  issues: [],
  evidence: [],
  payload: DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES.faithfulness,
} as const;

export const DeprecatedSummaryJudgeV3_0Contract = defineContract({
  id: "summary.judge.verdict.v3",
  version: "3.0.0",
  stageId: "summary_judges_deprecated_v3_0",
  description: "Deprecated Phase 1 Summary Judge draft without source metadata.",
  validator: DeprecatedSummaryJudgeV3_0Schema,
  canonicalEnums: [...SUMMARY_CRITERIA, ...SUMMARY_JUDGE_VERDICTS],
  status: "deprecated",
  fixtures: {
    valid: deprecatedValid,
    missing_required: {
      criterion: deprecatedValid.criterion,
      verdict: deprecatedValid.verdict,
      confidence: deprecatedValid.confidence,
      issues: deprecatedValid.issues,
      evidence: deprecatedValid.evidence,
      payload: deprecatedValid.payload,
    },
    extra_legacy_field: { ...deprecatedValid, weight: 20 },
    invalid_enum: { ...deprecatedValid, criterion: "truth" },
    invalid_nested_type: {
      ...deprecatedValid,
      payload: DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES.format,
    },
  },
  backwardCompatibility: {
    reads: ["summary.judge.verdict.v3@3.0.0"],
    writes: "summary.judge.verdict.v3@3.0.0",
  },
  migration: {
    acceptsLegacyVersions: [],
    migrationPolicyId: null,
  },
});

export type SummaryJudgeFindingV3 = z.infer<typeof SummaryJudgeFindingV3Schema>;
export type SummaryJudgeV3 = z.infer<typeof SummaryJudgeV3Schema>;
export type DeprecatedSummaryJudgeV3_0 = z.infer<typeof DeprecatedSummaryJudgeV3_0Schema>;

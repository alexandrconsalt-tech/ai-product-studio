import { z } from "zod";

export const SUMMARY_V2_PROJECT_ID = "project_summary_pipeline_v2";
export const SUMMARY_V2_PRODUCT_ID = "product_summary_pipeline_v2";
export const SUMMARY_V2_PIPELINE_VERSION = "summary-pipeline-v2";

export const StageStatusSchema = z.enum(["SUCCESS", "TECHNICAL_ERROR", "SKIPPED"]);
export const StageDecisionSchema = z.enum(["PASS", "FAIL", "REVIEW_REQUIRED", "TECHNICAL_ERROR", "NOT_APPLICABLE"]);

export const EvidenceSchema = z.object({
  speaker: z.enum(["client", "agent", "operator", "unknown"]),
  quote: z.string().min(1),
  turn_id: z.string().min(1),
});

export const EvidenceValueSchema = z.object({
  value: z.string().nullable(),
  evidence: z.array(EvidenceSchema),
});

export const FactSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  value: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
});

export const NextStepSchema = z.object({
  status: z.enum(["CONFIRMED", "CONDITIONAL", "PROPOSED", "NOT_DEFINED"]),
  action: z.string().nullable(),
  responsible: z.enum(["AGENT", "CLIENT", "BOTH", "NOT_DEFINED"]),
  deadline: z.string().nullable(),
  channel: z.string().nullable(),
  evidence: z.array(EvidenceSchema),
});

export const CallOutcomeSchema = z.object({
  type: z.enum(["VIEWING_SCHEDULED", "FOLLOW_UP_REQUIRED", "INFORMATION_PROVIDED", "CLIENT_DECLINED", "NO_CONNECTION", "OTHER"]),
  description: z.string().nullable(),
  evidence: z.array(EvidenceSchema),
});

export const FundingSourceSchema = z.enum(["наличные / депозит", "ипотека одобрена", "ипотека в процессе", "продажа своей квартиры", "не определено"]);
export const PurchaseTimelineSchema = z.enum(["до 1 месяца", "2–3 месяца", "3–6 месяцев", "более 6 месяцев", "не определено"]);
export const InterestedInSchema = z.enum(["Новостройки", "Ипотека", "Строительство"]);

export const FinancialDataSchema = z.object({
  budget: z.object({
    amount_min: z.number().nonnegative().nullable(),
    amount_max: z.number().nonnegative().nullable(),
    currency: z.literal("RUB"),
    evidence: z.array(EvidenceSchema),
  }),
  funding_source: z.object({ value: FundingSourceSchema, evidence: z.array(EvidenceSchema) }),
  mortgage_status: z.object({
    value: z.enum(["NOT_MENTIONED", "NOT_NEEDED", "INTERESTED", "IN_PROCESS", "APPROVED"]),
    evidence: z.array(EvidenceSchema),
  }),
  down_payment: z.object({ amount: z.number().nonnegative().nullable(), currency: z.literal("RUB"), evidence: z.array(EvidenceSchema) }),
  sale_of_existing_property: z.object({ value: z.enum(["YES", "NO", "NOT_DEFINED"]), evidence: z.array(EvidenceSchema) }),
});

export const ExtractorOutputSchema = z.object({
  call_type: z.enum(["OBJECT_INQUIRY", "CONSULTATION", "VIEWING", "MORTGAGE", "SELLING", "RENTAL", "OTHER"]),
  client_intent: EvidenceValueSchema,
  facts: z.array(FactSchema),
  requirements: z.array(FactSchema),
  objections: z.array(FactSchema),
  open_questions: z.array(FactSchema),
  agreements: z.array(FactSchema),
  next_step: NextStepSchema,
  call_outcome: CallOutcomeSchema,
  structured_attributes: z.object({
    interested_in: z.array(InterestedInSchema),
    funding_source: FundingSourceSchema,
    purchase_timeline: PurchaseTimelineSchema,
  }),
  financial_data: FinancialDataSchema,
  critical_information: z.array(z.string()),
  summary_inputs: z.object({
    primary_goal: z.string().nullable(),
    main_result: z.string().nullable(),
    key_requirements: z.array(z.string()),
    main_objection: z.string().nullable(),
    agreement_and_next_step: z.string().nullable(),
  }),
});

export type ExtractorOutput = z.infer<typeof ExtractorOutputSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Fact = z.infer<typeof FactSchema>;

export const VerificationItemSchema = z.object({
  id: z.string().min(1),
  verdict: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
  reason: z.string().min(1),
});

export const VerifierOutputSchema = z.object({
  items: z.array(VerificationItemSchema),
  next_step: z.object({ verdict: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]), reason: z.string().min(1) }),
  outcome: z.object({ verdict: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]), reason: z.string().min(1) }),
  structured_attributes: z.object({
    interested_in: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
    funding_source: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
    purchase_timeline: z.enum(["VERIFIED", "REJECTED", "UNCERTAIN"]),
  }),
  issues: z.array(z.string()),
});

export type VerifierOutput = z.infer<typeof VerifierOutputSchema>;

export const ConversationStoreSchema = z.object({
  schema_version: z.literal("summary-store-v2"),
  call_id: z.string().min(1),
  verified: z.object({
    client_intent: EvidenceValueSchema.nullable(),
    facts: z.array(FactSchema),
    requirements: z.array(FactSchema),
    objections: z.array(FactSchema),
    open_questions: z.array(FactSchema),
    agreements: z.array(FactSchema),
    next_step: NextStepSchema,
    call_outcome: CallOutcomeSchema.nullable(),
    structured_attributes: z.object({
      interested_in: z.array(InterestedInSchema),
      funding_source: FundingSourceSchema,
      purchase_timeline: PurchaseTimelineSchema,
    }),
    financial_data: FinancialDataSchema,
  }),
  uncertain: z.array(z.object({ id: z.string(), reason: z.string() })),
  rejected: z.array(z.object({ id: z.string(), reason: z.string() })),
  critical_information: z.array(z.string()),
  evidence_index: z.record(z.string(), z.array(EvidenceSchema)),
  created_at: z.string().datetime(),
});

export type ConversationStoreV2 = z.infer<typeof ConversationStoreSchema>;

export const SummaryOutputSchema = z.object({
  overview: z.string().min(1),
  key_facts: z.array(z.string()).max(4),
  quotes: z.array(z.string()).max(2),
  agreement_next_step: z.string().nullable(),
});

export type SummaryOutput = z.infer<typeof SummaryOutputSchema>;

export const JudgeCriterionSchema = z.enum(["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"]);
export const JudgeOutputSchema = z.object({
  criterion: JudgeCriterionSchema,
  status: z.literal("SUCCESS"),
  decision: z.enum(["PASS", "FAIL", "REVIEW_REQUIRED"]),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).nullable(),
  critical_error: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]),
    type: z.string(),
    summary_fragment: z.string(),
    explanation: z.string(),
    evidence: z.array(EvidenceSchema),
  })),
  passed_checks: z.array(z.string()),
  failed_checks: z.array(z.string()),
  recommendation: z.string().nullable(),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
export type JudgeCriterion = z.infer<typeof JudgeCriterionSchema>;

export type TechnicalEnvelope<T> = Readonly<{
  stage_id: string;
  stage_version: string;
  execution_id: string;
  status: z.infer<typeof StageStatusSchema>;
  decision: z.infer<typeof StageDecisionSchema>;
  score: number | null;
  confidence: number | null;
  input_hash: string;
  output: T | null;
  issues: readonly string[];
  technical_error: { code: string; message: string } | null;
  duration_ms: number;
  model: string | null;
  prompt_version: string | null;
  input_contract_version: string;
  output_contract_version: string;
  created_at: string;
}>;

export type SummaryV2Config = Readonly<{
  extractorModel: string;
  verifierModel: string;
  generatorModel: string;
  judgeModel: string;
}>;

export type SummaryV2Run = Readonly<{
  run_id: string;
  product_id: typeof SUMMARY_V2_PRODUCT_ID;
  pipeline_version: typeof SUMMARY_V2_PIPELINE_VERSION;
  transcript_hash: string;
  config_hash: string;
  started_at: string;
  finished_at: string;
  stages: readonly TechnicalEnvelope<unknown>[];
  summary: string | null;
  attributes: {
    interested_in: readonly string[];
    funding_source: string;
    purchase_timeline: string;
  } | null;
  quality: {
    score: number | null;
    decision: "AUTO_SAVE" | "SAVE_WITH_WARNING" | "REVIEW_REQUIRED" | "TECHNICAL_ERROR";
    criterion_scores: Readonly<Record<string, number | null>>;
    critical_errors: readonly string[];
    warnings: readonly string[];
  };
  crm_publish: {
    status: "PUBLISHED" | "PUBLISHED_WITH_WARNING" | "BLOCKED";
    payload: unknown | null;
    reason: string | null;
  };
}>;

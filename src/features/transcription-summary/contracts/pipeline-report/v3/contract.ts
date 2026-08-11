import { z } from "zod";
import { defineContract } from "../../schema-utils";
import { ConfidenceSchema, IdentifierSchema, NonEmptyStringSchema } from "../../shared-schemas";

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const PIPELINE_STAGE_STATUSES = [
  "SUCCESS",
  "SUCCESS_WITH_WARNING",
  "BUSINESS_REJECTION",
  "TECHNICAL_ERROR",
  "NOT_RUN",
] as const;

const ValidationResultSchema = z.object({
  status: z.enum(["valid", "invalid", "not_run"]),
  issues: z.array(z.object({
    path: z.string(),
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  }).strict()),
}).strict();

const ProviderDiagnosticSchema = z.object({
  request_dispatched: z.boolean(),
  provider: z.enum(["AITUNNEL", "OPENAI_COMPATIBLE"]),
  base_url: NonEmptyStringSchema,
  endpoint: NonEmptyStringSchema,
  model: NonEmptyStringSchema,
  schema_id: NonEmptyStringSchema,
  schema_hash: HashSchema,
  response_format_type: z.literal("json_schema"),
  http_status: z.number().int().min(100).max(599).nullable(),
  provider_error_type: z.string().nullable(),
  provider_error_code: z.string().nullable(),
  provider_error_param: z.string().nullable(),
  provider_error_message: z.string().max(500).nullable(),
  provider_request_id: z.string().nullable(),
  error_category: z.enum([
    "auth",
    "schema",
    "model",
    "quota",
    "rate_limit",
    "network",
    "timeout",
    "request_validation",
    "unknown",
  ]).nullable(),
  api_key_present: z.boolean(),
  environment_scope: z.enum([
    "preview",
    "development",
    "production",
    "test",
    "unknown",
  ]),
  request_serialization_status: z.enum(["not_started", "success", "failed"]),
  timeout_network_classification: z.enum(["timeout", "network"]).nullable(),
  structured_output_not_applied_reason: z.string().nullable(),
  attempt_started_at: z.iso.datetime(),
  request_dispatched_at: z.iso.datetime().nullable(),
  response_received_at: z.iso.datetime().nullable(),
  attempt_finished_at: z.iso.datetime(),
  duration_ms: z.number().int().nonnegative(),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }).strict().nullable(),
}).strict();

const FactsInputDiagnosticSchema = z.object({
  input_tokens_estimate: z.number().int().nonnegative(),
  transcript_tokens: z.number().int().nonnegative(),
  instruction_tokens: z.number().int().nonnegative(),
  duplicated_context_tokens_removed: z.number().int().nonnegative(),
  input_turns_count: z.number().int().nonnegative(),
  payload_bytes: z.number().int().nonnegative(),
  attempt_timeouts_ms: z.array(z.number().int().positive()).max(2),
  provider_latencies_ms: z.array(z.number().int().nonnegative()).max(2),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  retry_reason: z.enum(["timeout", "network"]).nullable(),
  final_source_quality: z.enum(["valid", "technical_error"]),
}).strict();

const TransformationSchema = z.object({
  operation_id: IdentifierSchema,
  operation_type: z.enum([
    "llm_generated",
    "normalized",
    "corrected_by_judge",
    "rejected_by_judge",
    "rejected_by_invariant",
    "deduplicated",
    "migrated",
  ]),
  field_path: NonEmptyStringSchema,
  old_value: z.json(),
  new_value: z.json(),
  rule_id: NonEmptyStringSchema,
  reason: NonEmptyStringSchema,
  source_refs: z.array(IdentifierSchema),
  timestamp: z.iso.datetime(),
}).strict();

export const PipelineStageReportV3Schema = z.object({
  stage_id: IdentifierSchema,
  stage_version: NonEmptyStringSchema,
  status: z.enum(PIPELINE_STAGE_STATUSES),
  contract_id: NonEmptyStringSchema,
  contract_version: NonEmptyStringSchema,
  manifest_hash: HashSchema,
  prompt_id: NonEmptyStringSchema.nullable(),
  prompt_version: NonEmptyStringSchema.nullable(),
  prompt_hash: HashSchema.nullable(),
  base_prompt: z.string().nullable(),
  resolved_prompt: z.string().nullable(),
  schema_hash: HashSchema,
  model: NonEmptyStringSchema.nullable(),
  provider: NonEmptyStringSchema.nullable(),
  structured_output: z.object({
    required: z.boolean(),
    requested: z.boolean(),
    applied: z.boolean(),
  }).strict(),
  provider_diagnostic: ProviderDiagnosticSchema.nullable(),
  input_diagnostic: FactsInputDiagnosticSchema.nullable(),
  attempts: z.number().int().nonnegative(),
  repair_attempted: z.boolean(),
  raw_provider_response: z.json().nullable(),
  timeout_stage: NonEmptyStringSchema.nullable(),
  validation_result: ValidationResultSchema,
  transformations: z.array(TransformationSchema),
  agent_output: z.json().nullable(),
  judge_verdict: z.json().nullable(),
  code_invariant_result: z.json().nullable(),
  final_verdict: z.json().nullable(),
  score: z.number().min(0).max(100).nullable(),
  confidence: ConfidenceSchema.nullable(),
  error_type: z.enum([
    "provider",
    "decode",
    "schema",
    "normalization",
    "invariant",
    "dependency",
    "crm",
  ]).nullable(),
  error_code: NonEmptyStringSchema.nullable(),
  blocking: z.boolean(),
  duration_ms: z.number().int().nonnegative(),
}).strict();

export const PipelineReportV3Schema = z.object({
  report_id: IdentifierSchema,
  run_id: IdentifierSchema,
  product_id: z.literal("product_transcription_summary_module"),
  pipeline_id: z.literal("pipeline.ai-summary.v3"),
  pipeline_version: z.literal("3.0.0"),
  manifest_hash: HashSchema,
  transcript_hash: HashSchema,
  flags: z.object({
    v3Enabled: z.boolean(),
    crmDryRun: z.literal(true),
  }).strict(),
  status: z.enum(["SUCCESS", "SUCCESS_WITH_WARNING", "BUSINESS_REJECTION", "TECHNICAL_ERROR"]),
  stages: z.array(PipelineStageReportV3Schema),
  quality_score: z.number().min(0).max(100).nullable(),
  quality_decision: z.enum(["QUALITY_RECORDED", "TECHNICAL_ERROR"]).nullable(),
  degraded_sources: z.array(z.enum(["facts", "needs", "outcome"])),
  semantic_evaluation_allowed: z.boolean(),
  quality_score_valid: z.boolean(),
  crm_status: z.enum([
    "PUBLISHED",
    "SKIPPED",
    "ALREADY_PUBLISHED",
    "DRY_RUN",
    "SAVED",
    "TECHNICAL_ERROR",
    "NOT_RUN",
  ]),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime(),
}).strict();

const hash = "a".repeat(64);
const validStage = {
  stage_id: "transcript_validate",
  stage_version: "3.0.0",
  status: "SUCCESS",
  contract_id: "transcript.validated.v3",
  contract_version: "3.0.0",
  manifest_hash: hash,
  prompt_id: null,
  prompt_version: null,
  prompt_hash: null,
  base_prompt: null,
  resolved_prompt: null,
  schema_hash: hash,
  model: null,
  provider: null,
  structured_output: { required: false, requested: false, applied: false },
  provider_diagnostic: null,
  input_diagnostic: null,
  attempts: 0,
  repair_attempted: false,
  raw_provider_response: null,
  timeout_stage: null,
  validation_result: { status: "valid", issues: [] },
  transformations: [],
  agent_output: null,
  judge_verdict: null,
  code_invariant_result: { status: "passed" },
  final_verdict: { status: "verified" },
  score: null,
  confidence: null,
  error_type: null,
  error_code: null,
  blocking: false,
  duration_ms: 5,
} as const;
const valid = {
  report_id: "report-1",
  run_id: "run-1",
  product_id: "product_transcription_summary_module",
  pipeline_id: "pipeline.ai-summary.v3",
  pipeline_version: "3.0.0",
  manifest_hash: hash,
  transcript_hash: "b".repeat(64),
  flags: { v3Enabled: true, crmDryRun: true },
  status: "SUCCESS",
  stages: [validStage],
  quality_score: 100,
  quality_decision: "QUALITY_RECORDED",
  degraded_sources: [],
  semantic_evaluation_allowed: true,
  quality_score_valid: true,
  crm_status: "DRY_RUN",
  started_at: "2026-07-30T00:00:00.000Z",
  finished_at: "2026-07-30T00:00:01.000Z",
} as const;

export const PipelineReportV3Contract = defineContract({
  id: "pipeline.report.v3",
  version: "3.2.0",
  stageId: "pipeline_report",
  description: "Typed complete v3 run report with unified statuses, prompts, flags, Quality Gate and CRM dry-run.",
  validator: PipelineReportV3Schema,
  canonicalEnums: PIPELINE_STAGE_STATUSES,
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  backwardCompatibility: {
    reads: ["pipeline.report.v3@3.1.0", "pipeline.report.v3@3.2.0"],
    writes: "pipeline.report.v3@3.2.0",
  },
  fixtures: {
    valid,
    missing_required: {
      report_id: valid.report_id,
      run_id: valid.run_id,
      product_id: valid.product_id,
      pipeline_id: valid.pipeline_id,
      pipeline_version: valid.pipeline_version,
      manifest_hash: valid.manifest_hash,
      transcript_hash: valid.transcript_hash,
      flags: valid.flags,
      status: valid.status,
      stages: valid.stages,
      started_at: valid.started_at,
      finished_at: valid.finished_at,
    },
    extra_legacy_field: { ...valid, stageReports: {} },
    invalid_enum: { ...valid, status: "FAILED" },
    invalid_nested_type: { ...valid, stages: [{ ...validStage, status: "FAILED" }] },
  },
});

const DeprecatedPipelineStageReportV3_1Schema = PipelineStageReportV3Schema.omit({
  provider_diagnostic: true,
});
const DeprecatedPipelineReportV3_1Schema = PipelineReportV3Schema.extend({
  stages: z.array(DeprecatedPipelineStageReportV3_1Schema),
}).strict();
const deprecatedV3_1Valid = {
  ...valid,
  stages: valid.stages.map(({ provider_diagnostic: _ignored, ...stage }) => stage),
};
const {
  stages: _deprecatedV3_1MissingStages,
  ...deprecatedV3_1MissingRequired
} = deprecatedV3_1Valid;

export const DeprecatedPipelineReportV3_1Contract = defineContract({
  id: "pipeline.report.v3",
  version: "3.1.0",
  stageId: "pipeline_report_v3_1",
  description: "Deprecated v3 pipeline report without safe provider diagnostics.",
  validator: DeprecatedPipelineReportV3_1Schema,
  status: "deprecated",
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid: deprecatedV3_1Valid,
    missing_required: deprecatedV3_1MissingRequired,
    extra_legacy_field: { ...deprecatedV3_1Valid, provider_error: "unsafe" },
    invalid_enum: { ...deprecatedV3_1Valid, status: "FAILED" },
    invalid_nested_type: { ...deprecatedV3_1Valid, stages: "invalid" },
  },
});

const DeprecatedPipelineReportV3_0Schema = z.object({
  report_id: IdentifierSchema,
  run_id: IdentifierSchema,
  product_id: z.literal("product_transcription_summary_module"),
  pipeline_id: z.literal("pipeline.ai-summary.v3"),
  pipeline_version: z.literal("3.0.0"),
  manifest_hash: HashSchema,
  status: z.enum(["SUCCESS", "SUCCESS_WITH_WARNING", "BUSINESS_REJECTION", "TECHNICAL_ERROR"]),
  stages: z.array(z.unknown()),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime(),
}).strict();

export const DeprecatedPipelineReportV3_0Contract = defineContract({
  id: "pipeline.report.v3",
  version: "3.0.0",
  stageId: "pipeline_report_v3_0",
  description: "Deprecated partial pipeline report without complete run, prompt and flag audit.",
  validator: DeprecatedPipelineReportV3_0Schema,
  status: "deprecated",
  structuredOutput: false,
  repairPolicyId: "repair.none.v1",
  fixtures: {
    valid: {
      report_id: valid.report_id,
      run_id: valid.run_id,
      product_id: valid.product_id,
      pipeline_id: valid.pipeline_id,
      pipeline_version: valid.pipeline_version,
      manifest_hash: valid.manifest_hash,
      status: valid.status,
      stages: [],
      started_at: valid.started_at,
      finished_at: valid.finished_at,
    },
    missing_required: {},
    extra_legacy_field: { extra: true },
    invalid_enum: { status: "FAILED" },
    invalid_nested_type: { stages: "invalid" },
  },
});

export type PipelineStageReportV3 = z.infer<typeof PipelineStageReportV3Schema>;
export type PipelineReportV3 = z.infer<typeof PipelineReportV3Schema>;

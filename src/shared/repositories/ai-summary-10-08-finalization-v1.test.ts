import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Runtime = {
  runSummaryQualityGate: (ctx: Record<string, unknown>) => any;
  runCrmResult: (ctx: Record<string, unknown>) => any;
  validateSummaryQualityGate: (value: unknown) => boolean;
  validateCrmResult: (value: unknown) => boolean;
  stages: ReadonlyArray<Record<string, unknown>>;
};

function runtime(): Runtime {
  const context = { window: {} as Record<string, unknown> };
  runInNewContext(readFileSync(resolve(process.cwd(), "public", "ai-summary-10-08-finalization-v1.js"), "utf8"), context);
  return context.window.__AI_SUMMARY_10_08_FINALIZATION_V1__ as Runtime;
}

const identity = { __run_id: "run-1", __transcript_hash: "transcript-1", __pipeline_configuration_hash: "pipeline-1" };
const provenance = { run_id: "run-1", transcript_hash: "transcript-1", pipeline_configuration_hash: "pipeline-1", execution_status: "SUCCESS", parse_status: "SUCCESS", schema_status: "VALID", structured_output_requested: true, structured_output_applied: true };
const scores = { faithfulness: 100, completeness: 100, usefulness: 100, agreements_next_step: 100, format: 75 };
const judge = { scores, quality_score: 95, confidence: 0.95, decision: "pass", issues: [] };
const summary = { conversation_result: "Результат", key_facts: ["Факт"], quotes: [], next_step: "" };

function gateContext(value: Record<string, unknown> = judge, source: Record<string, unknown> = provenance) {
  return { ...identity, summary_judge: value, __stage_provenance: { summary_judge: source } };
}
function crmContext(gate: Record<string, unknown>, value: unknown = summary) {
  return { ...identity, summary_generator: value, summary_quality_gate: gate, __stage_provenance: { summary_generator: { ...provenance }, summary_quality_gate: { ...provenance } } };
}

describe("AI Summary 10.08 deterministic finalization", () => {
  it("gate_pass", () => expect(runtime().runSummaryQualityGate(gateContext())).toMatchObject({ gate_status: "PASS", quality_score: 95, confidence: 0.95 }));
  it("gate_warning_quality", () => expect(runtime().runSummaryQualityGate(gateContext({ scores: { ...scores, usefulness: 50 }, quality_score: 85, confidence: 0.95, decision: "warning", issues: ["source issue"] }))).toMatchObject({ gate_status: "WARNING", warnings: ["LOW_QUALITY_SCORE", "LOW_USEFULNESS", "JUDGE_WARNING", "source issue"] }));
  it("gate_blocked_quality", () => expect(runtime().runSummaryQualityGate(gateContext({ scores: { faithfulness: 75, completeness: 75, usefulness: 75, agreements_next_step: 75, format: 50 }, quality_score: 70, confidence: 0.9, decision: "fail", issues: [] }))).toMatchObject({ gate_status: "BLOCKED", failed_criteria: ["quality_score", "decision"] }));
  it("gate_blocked_faithfulness", () => expect(runtime().runSummaryQualityGate(gateContext({ scores: { ...scores, faithfulness: 25, format: 100 }, quality_score: 95, confidence: 0.95, decision: "pass", issues: [] }))).toMatchObject({ gate_status: "BLOCKED", failed_criteria: ["faithfulness"] }));
  it("gate_blocked_agreements", () => expect(runtime().runSummaryQualityGate(gateContext({ scores: { ...scores, agreements_next_step: 25, format: 100 }, quality_score: 95, confidence: 0.95, decision: "pass", issues: [] }))).toMatchObject({ gate_status: "BLOCKED", failed_criteria: ["agreements_next_step"] }));
  it("gate_blocked_confidence", () => expect(runtime().runSummaryQualityGate(gateContext({ ...judge, confidence: 0.65 }))).toMatchObject({ gate_status: "BLOCKED", failed_criteria: ["confidence"] }));
  it("gate_warning_confidence", () => expect(runtime().runSummaryQualityGate(gateContext({ ...judge, confidence: 0.8, decision: "warning" }))).toMatchObject({ gate_status: "WARNING", warnings: ["LOW_CONFIDENCE", "JUDGE_WARNING"] }));
  it("gate_technical_missing_judge", () => expect(runtime().runSummaryQualityGate({ ...identity, __stage_provenance: {} })).toMatchObject({ gate_status: "TECHNICAL_ERROR", technical_errors: expect.arrayContaining(["SUMMARY_JUDGE_MISSING", "CURRENT_RUN_PROVENANCE_UNPROVEN"]) }));
  it("gate_technical_stale_judge", () => expect(runtime().runSummaryQualityGate(gateContext(judge, { ...provenance, run_id: "old" }))).toMatchObject({ gate_status: "TECHNICAL_ERROR", technical_errors: ["STALE_RUN_ID"] }));
  it("gate_score_mismatch", () => expect(runtime().runSummaryQualityGate(gateContext({ ...judge, quality_score: 96 }))).toMatchObject({ gate_status: "TECHNICAL_ERROR", technical_errors: ["SUMMARY_JUDGE_SCORE_MISMATCH"] }));

  it("crm_save", () => { const gate=runtime().runSummaryQualityGate(gateContext()); expect(runtime().runCrmResult(crmContext(gate))).toMatchObject({ crm_action: "SAVE", pipeline_status: "READY", summary }); });
  it("crm_save_with_warning", () => { const gate=runtime().runSummaryQualityGate(gateContext({ scores: { ...scores, usefulness: 50 }, quality_score: 85, confidence: 0.95, decision: "warning", issues: [] })); expect(runtime().runCrmResult(crmContext(gate))).toMatchObject({ crm_action: "SAVE_WITH_WARNING", pipeline_status: "PARTIAL_READY" }); });
  it("crm_review_required", () => { const gate=runtime().runSummaryQualityGate(gateContext({ scores: { faithfulness: 75, completeness: 75, usefulness: 75, agreements_next_step: 75, format: 50 }, quality_score: 70, confidence: 0.9, decision: "fail", issues: [] })); expect(runtime().runCrmResult(crmContext(gate))).toMatchObject({ crm_action: "REVIEW_REQUIRED", pipeline_status: "BLOCKED" }); });
  it("crm_error", () => { const gate=runtime().runSummaryQualityGate({ ...identity, __stage_provenance: {} }); expect(runtime().runCrmResult(crmContext(gate))).toMatchObject({ crm_action: "ERROR", pipeline_status: "TECHNICAL_ERROR", errors: expect.arrayContaining(["SUMMARY_JUDGE_MISSING"]) }); });
  it("crm_invalid_summary", () => { const gate=runtime().runSummaryQualityGate(gateContext()); expect(runtime().runCrmResult(crmContext(gate, { conversation_result: "x" }))).toMatchObject({ crm_action: "ERROR", pipeline_status: "TECHNICAL_ERROR", errors: ["SUMMARY_GENERATOR_SCHEMA_INVALID"] }); });
  it("current_run_provenance", () => { const gate=runtime().runSummaryQualityGate(gateContext()); const ctx=crmContext(gate); (ctx.__stage_provenance.summary_generator as any).transcript_hash="old"; expect(runtime().runCrmResult(ctx)).toMatchObject({ crm_action: "ERROR", errors: ["SUMMARY_GENERATOR_STALE_TRANSCRIPT_HASH"] }); });
  it("no_llm_calls_for_gate", () => expect(runtime().stages[0]).toMatchObject({ type: "code", codeFn: "aiSummaryQualityGate" }));
  it("no_llm_calls_for_crm", () => expect(runtime().stages[1]).toMatchObject({ type: "code", codeFn: "aiSummaryCrmResult" }));

  it("validates strict outputs with no additional properties", () => {
    const gate=runtime().runSummaryQualityGate(gateContext());
    expect(runtime().validateSummaryQualityGate(gate)).toBe(true);
    expect(runtime().validateSummaryQualityGate({ ...gate, extra: true })).toBe(false);
    const crm=runtime().runCrmResult(crmContext(gate));
    expect(runtime().validateCrmResult(crm)).toBe(true);
    expect(runtime().validateCrmResult({ ...crm, extra: true })).toBe(false);
  });
});

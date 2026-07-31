import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("13-stage direct production runtime regression", () => {
  const pipeline = readFileSync(
    new URL("../../../../public/pipeline-lab-v3.html", import.meta.url),
    "utf8",
  );
  const section = (start: string, end: string) =>
    pipeline.slice(pipeline.indexOf(start), pipeline.indexOf(end, pipeline.indexOf(start)));

  it("uses transcript + facts for Needs and makes Needs optional for Outcome", () => {
    const audit = section("function stageContextAudit", "function attachReviewerScores");
    const outcomeDependency = section("function outcomeDependencyError", "const OUTCOME_CHECK_QUALITY_KEYS");
    const runStage = section("async function runStage", "function buildPipelineExecutionSummary");

    expect(audit).toContain("needs:['transcript','facts']");
    expect(audit).toContain("outcome:['transcript','facts']");
    expect(audit).toContain("key==='outcome'?['needs']:[]");
    expect(outcomeDependency).not.toMatch(/fact_check|need_check|verified_/);
    expect(runStage).not.toContain("UPSTREAM_FACT_CHECK_FAILED");
  });

  it("builds Store from direct extractor outputs with stable attribute types", () => {
    const store = section(
      "// Active v2 Store: raw Extractor outputs",
      "const SUMMARY_QUALITY_GATE_VERSION",
    );
    expect(store).toContain("const factsSource=ctx&&ctx.facts");
    expect(store).toContain("const needsSource=ctx&&ctx.needs");
    expect(store).toContain("const outcomeSource=ctx&&ctx.outcome");
    expect(store).toContain("attributes:{interest:[...new Set(interest)],funding_source,purchase_term}");
    expect(store).toContain("'dependency_error'");
    expect(store).toContain("funding_source='наличные / депозит'");
    expect(store).not.toMatch(/ctx&&ctx\.(?:fact_check|need_check)/);
  });

  it("does not rewrite grounded Summary and always renders customer needs", () => {
    const policy = section(
      "function moduleSummaryApplyStorePolicy",
      "function moduleSummaryTechnicalOutput",
    );
    const renderer = section("function renderModuleSummaryResult", "function renderSummaryNewResult");
    expect(policy).toContain("return {value,count:0,changes:[]}");
    expect(renderer).toContain("Потребности клиента");
    expect(renderer).toContain("Источник средств:");
    expect(pipeline).toContain("customer_needs:customerNeedsValues(ctx)");
  });

  it("routes all five Judges through the shared minimal response contract", () => {
    expect(pipeline).toContain("MODULE_GENERIC_JUDGE_JSON_SCHEMA");
    expect(pipeline).toContain("required:['score','status','issues','explanation']");
    expect(pipeline).toContain("if(IS_TRANSCRIPTION_SUMMARY_MODULE&&MODULE_GENERIC_JUDGE_DEFINITIONS[stage.outKey])");
    expect(pipeline).toContain("prompt_chars:prompt.length");
  });

  it("reports honest top-level pipeline states", () => {
    const summary = section(
      "function buildPipelineExecutionSummary",
      "const V3_FULL_STAGE_UI",
    );
    for (const status of ["SUCCESS", "SUCCESS_WITH_WARNINGS", "PARTIAL_FAILURE", "FAILED"]) {
      expect(summary).toContain(`'${status}'`);
    }
    expect(summary).toContain("const extractorFailures=['facts','needs','outcome'].filter(failed)");
    expect(summary).toContain("const summaryOrCrmFailed=failed('summary')||failed('crm')");
  });
});

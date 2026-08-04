import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateResults,
  caseAcceptanceFailures,
  compareWithBaseline,
  evaluateCase,
  validateDataset,
} from "../../../../scripts/transcription-summary-v3-quality-regression.mjs";

const root = process.cwd();
const dataset = JSON.parse(readFileSync(join(
  root,
  "tests/golden/transcription-summary-v3/quality-regression/cases.json",
), "utf8"));

function acceptedCase(id: string) {
  return {
    id,
    http_status: 200,
    duration_ms: 1,
    complete_report: true,
    timeout_after_retry: false,
    schema_error: false,
    technical_residue: 0,
    crm_write: false,
    crm_status: "DRY_RUN",
    quality_score: 100,
    criteria: Object.fromEntries(["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"].map((criterion) => [criterion, { raw_score: 100, effective_score: 100 }])),
    critical_hits: ["critical"],
    critical_total: 1,
    forbidden_hits: [] as string[],
    output_meaning_total: 1,
    false_agreement: false,
    call_result_correct: true,
    summary_rubric_hits: ["summary"],
    summary_rubric_total: 1,
    next_step_correct: true,
    semantic_duplications: 0,
    visible_meanings: 1,
  };
}

describe("Summary v3 production quality regression", () => {
  it("подключён как fail-closed predeploy и имеет отдельную статическую валидацию", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts).toMatchObject({
      "quality:summary-v3:validate": expect.stringContaining("transcription-summary-v3-quality-regression.mjs"),
      "quality:summary-v3:production": expect.stringContaining("--live"),
      predeploy: "npm run quality:summary-v3:production",
      deploy: "vercel --prod",
    });
  });

  it("содержит 40 production-derived обезличенных сценариев и полное обязательное покрытие", () => {
    expect(validateDataset(dataset)).toEqual([]);
    expect(dataset.cases).toHaveLength(40);
    expect(new Set(dataset.cases.map((item: { provenance: { source_hash: string } }) => item.provenance.source_hash)).size).toBe(40);
    expect(dataset.cases.every((item: { critical_meanings: unknown[]; forbidden_meanings: unknown[]; summary_rubric: unknown }) =>
      item.critical_meanings.length > 0 && Array.isArray(item.forbidden_meanings) && Boolean(item.summary_rubric))).toBe(true);
  });

  it("считает все технические и семантические acceptance metrics", () => {
    const metrics = aggregateResults(dataset.cases.map((item: { id: string }) => acceptedCase(item.id)));
    expect(metrics).toMatchObject({
      case_count: 40,
      complete_report_rate: 1,
      timeout_after_retry_count: 0,
      schema_error_count: 0,
      technical_residue_count: 0,
      crm_write_count: 0,
      mean_quality_score: 100,
      p10_quality_score: 100,
      share_at_least_95: 1,
      critical_meaning_recall: 1,
      hallucination_rate: 0,
      false_agreement_rate: 0,
      call_result_accuracy: 1,
      summary_rubric_recall: 1,
      next_step_accuracy: 1,
      semantic_duplication_rate: 0,
    });
    expect(Object.values(metrics.criterion_means)).toEqual([100, 100, 100, 100, 100]);
  });

  it("извлекает rubric metrics из полного typed v3 report и не считает JSON-объект техническим мусором", () => {
    const golden = dataset.cases.find((item: { id: string }) => item.id === "prod_030_phone_after_1800");
    const stages: Array<{ stage_id: string; error_code: null; validation_result: { issues: Array<{ code: string; message: string }> } }> = Array.from({ length: 13 }, (_, index) => ({
      stage_id: index < 5 ? `stage_${index}` : index < 10 ? `summary_judge_${["faithfulness", "completeness", "usefulness", "agreements_next_step", "format"][index - 5]}` : `stage_${index}`,
      error_code: null,
      validation_result: { issues: index >= 5 && index < 10 ? [{ code: "JUDGE_SCORE_AUDIT", message: JSON.stringify({ raw_score: 100, effective_score: 100 }) }] : [] },
    }));
    stages[4].validation_result.issues.push({ code: "POST_FINAL_DIAGNOSTICS", message: JSON.stringify({ technicalResidue: [], semanticRepetitionCount: 0, nextStepDuplicationCount: 0 }) });
    const actual = evaluateCase(golden, {
      outputs: {
        facts_agent: { confirmed_facts: [{ value: "разговор перенесен" }] },
        needs_agent: { attributes: { funding_source: { value: "не определено" } } },
        outcome_agent: { call_result: "Разговор перенесен.", agreements: [{ action: "перезвонить", deadline: "после 18:00" }], primary_next_step: { action: "перезвонить", deadline: "после 18:00", status: "confirmed" } },
        conversation_store: { call_result: "Разговор перенесен.", primary_next_step: { action: "перезвонить", deadline: "после 18:00", status: "confirmed" } },
        summary_agent: { conversation_result: "Разговор перенесен.", key_facts: [], quotes: [], next_step: "Агент перезвонит сегодня после 18:00 по телефону." },
        quality_gate: { qualityScore: 100, decision: "QUALITY_RECORDED" },
      },
      report: { stages, crm_status: "DRY_RUN", quality_score: 100 },
    });
    expect(actual).toMatchObject({ complete_report: true, technical_residue: 0, schema_error: false, call_result_correct: true, next_step_correct: true, crm_write: false });
    expect(actual.critical_hits).toEqual(["result", "time", "channel"]);
  });

  it("не принимает рост среднего score при новом критическом дефекте или ослаблении policy", () => {
    const before = acceptedCase("case");
    before.quality_score = 95;
    const after = acceptedCase("case");
    after.quality_score = 99;
    after.forbidden_hits = ["invented_viewing"];
    const criticalComparison = compareWithBaseline([after], { policy_fingerprint: "same", cases: [before] }, "same");
    expect(criticalComparison.regressions).toEqual([expect.objectContaining({ id: "case", reasons: expect.arrayContaining(["NEW_FORBIDDEN_MEANING"]) })]);
    expect(compareWithBaseline([after], { policy_fingerprint: "before", cases: [before] }, "after").policy_changed).toBe(true);
  });

  it("блокирует любой отдельный Golden кейс ниже 90 даже при высоком среднем", () => {
    const cases = dataset.cases.map((item: { id: string }) => acceptedCase(item.id));
    cases[0].quality_score = 89;
    expect(aggregateResults(cases).mean_quality_score).toBeGreaterThan(95);
    expect(caseAcceptanceFailures(cases)).toContain(`${cases[0].id}:QUALITY_SCORE_BELOW_90`);
  });

  it("помечает падение любого отдельного критерия причиной регрессии", () => {
    const before = acceptedCase("case");
    const after = acceptedCase("case");
    after.criteria.format.effective_score = 94;
    const comparison = compareWithBaseline([after], { policy_fingerprint: "same", cases: [before] }, "same");
    expect(comparison.regressions[0]?.reasons).toContain("CRITERION_DECREASED:format:100->94");
  });
});

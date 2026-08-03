import { expect, test } from "@playwright/test";

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

type GoldenCase = {
  name: string;
  scores: Array<number | null>;
  expectedScore: number | null;
  expectedStatus: string;
  expectedEvaluation: string;
  expectedDecision: string;
  expectedBlocking: boolean;
};

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "excellent",
    scores: [100, 100, 100, 100, 75],
    expectedScore: 95,
    expectedStatus: "PASS",
    expectedEvaluation: "complete",
    expectedDecision: "REVIEW_REQUIRED",
    expectedBlocking: true,
  },
  {
    name: "good",
    scores: [95, 92, 94, 98, 91],
    expectedScore: 94,
    expectedStatus: "PASS",
    expectedEvaluation: "complete",
    expectedDecision: "AUTO_SAVE",
    expectedBlocking: false,
  },
  {
    name: "needs_attention",
    scores: [75, 75, 75, 75, 75],
    expectedScore: 75,
    expectedStatus: "WARNING",
    expectedEvaluation: "complete",
    expectedDecision: "REVIEW_REQUIRED",
    expectedBlocking: true,
  },
  {
    name: "low_quality",
    scores: [50, 75, 50, 75, 50],
    expectedScore: 60,
    expectedStatus: "FAIL",
    expectedEvaluation: "complete",
    expectedDecision: "REVIEW_REQUIRED",
    expectedBlocking: true,
  },
  {
    name: "partial_without_default_score",
    scores: [null, 100, 75, 100, 100],
    expectedScore: null,
    expectedStatus: "NOT_EVALUATED",
    expectedEvaluation: "partial",
    expectedDecision: "TECHNICAL_ERROR",
    expectedBlocking: true,
  },
  {
    name: "not_evaluated",
    scores: [null, null, null, null, null],
    expectedScore: null,
    expectedStatus: "NOT_EVALUATED",
    expectedEvaluation: "technical_error",
    expectedDecision: "TECHNICAL_ERROR",
    expectedBlocking: true,
  },
];

for (const goldenCase of GOLDEN_CASES) {
  test(`Quality Gate golden: ${goldenCase.name}`, async ({ page }) => {
    await page.goto(moduleUrl);
    const result = await page.evaluate((scores) => {
      const keys = [
        "truth_check",
        "critical_completeness_check",
        "agent_utility_check",
        "action_check",
        "presentation_check",
      ];
      const ctx = Object.fromEntries(keys.map((key, index) => [
        key,
        scores[index] === null
          ? { score: null, status: "technical_error", issues: [] }
          : { score: scores[index], status: scores[index] === 100 ? "pass" : "warning", issues: [] },
      ]));
      ctx.summary = { conversation_result: "Клиенту нужен тихий двор.", key_facts: [], quotes: [], next_step: "Клиент вернётся с решением." };
      ctx.conversation_store = { conversation: { partial: false, source_errors: [], attributes: {}, primary_next_step: { action: "вернуться с решением", status: "confirmed" } } };
      ctx.__canonical_summary_context = { ranking_diagnostics: { conversation_result_present: true, critical_meanings_lost: 0, primary_next_step_consistent: true, unverified_data_used: false, technical_error: false } };
      return CODE_FUNCS.summaryQualityGate({}, ctx).output;
    }, goldenCase.scores);
    expect(result).toMatchObject({
      summary_quality_score: goldenCase.expectedScore,
      quality_status: goldenCase.expectedStatus,
      evaluation_status: goldenCase.expectedEvaluation,
      blocking: goldenCase.expectedBlocking,
      decision: goldenCase.expectedDecision,
    });
  });
}

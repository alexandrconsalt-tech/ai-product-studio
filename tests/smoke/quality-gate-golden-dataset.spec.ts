import { expect, test } from "@playwright/test";

const moduleUrl = "/pipeline-lab-v3.html?projectId=project_transcription_summary_module&productName=" +
  encodeURIComponent("Модуль транскрибации и AI-саммари звонков");

type GoldenCase = {
  name: string;
  scores: Array<number | null>;
  expectedScore: number | null;
  expectedStatus: string;
  expectedEvaluation: string;
};

const GOLDEN_CASES: GoldenCase[] = [
  {
    name: "excellent",
    scores: [100, 100, 100, 100, 75],
    expectedScore: 95,
    expectedStatus: "PASS",
    expectedEvaluation: "complete",
  },
  {
    name: "good",
    scores: [95, 92, 94, 98, 91],
    expectedScore: 94,
    expectedStatus: "PASS",
    expectedEvaluation: "complete",
  },
  {
    name: "needs_attention",
    scores: [75, 75, 75, 75, 75],
    expectedScore: 75,
    expectedStatus: "WARNING",
    expectedEvaluation: "complete",
  },
  {
    name: "low_quality",
    scores: [50, 75, 50, 75, 50],
    expectedScore: 60,
    expectedStatus: "FAIL",
    expectedEvaluation: "complete",
  },
  {
    name: "partial_without_default_score",
    scores: [null, 100, 75, 100, 100],
    expectedScore: 93.8,
    expectedStatus: "PASS",
    expectedEvaluation: "partial",
  },
  {
    name: "not_evaluated",
    scores: [null, null, null, null, null],
    expectedScore: null,
    expectedStatus: "NOT_EVALUATED",
    expectedEvaluation: "technical_error",
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
      return CODE_FUNCS.summaryQualityGate({}, ctx).output;
    }, goldenCase.scores);
    expect(result).toMatchObject({
      summary_quality_score: goldenCase.expectedScore,
      quality_status: goldenCase.expectedStatus,
      evaluation_status: goldenCase.expectedEvaluation,
      blocking: false,
      decision: "QUALITY_RECORDED",
    });
  });
}

import { describe, expect, it } from "vitest";
import { executeSummaryQualityGateV3 } from "./evaluate";
import { createSummaryQualityGateFixture } from "./fixtures";

describe("Summary Quality Gate — только аналитика", () => {
  it("считает среднее пяти равновесных оценок", () => {
    const fixture = createSummaryQualityGateFixture({
      faithfulness: 100,
      completeness: 75,
      usefulness: 50,
      agreements_next_step: 100,
      format: 75,
    });
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.value).toMatchObject({
      qualityScore: 80,
      decision: "QUALITY_RECORDED",
      blocking: false,
      evaluatedChecks: 5,
      partialEvaluation: false,
    });
  });

  it("исключает техническую ошибку Judge из среднего", () => {
    const fixture = createSummaryQualityGateFixture({
      faithfulness: null,
      completeness: 75,
      usefulness: 75,
      agreements_next_step: 75,
      format: 75,
    });
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.value).toMatchObject({
      qualityScore: 75,
      qualityStatus: "NEEDS_ATTENTION",
      evaluationStatus: "partial",
      evaluatedChecks: 4,
      technicalErrors: 1,
      partialEvaluation: true,
      blocking: false,
    });
  });

  it("не подставляет фиксированную оценку, если все Judge недоступны", () => {
    const fixture = createSummaryQualityGateFixture({
      faithfulness: null,
      completeness: null,
      usefulness: null,
      agreements_next_step: null,
      format: null,
    });
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.value).toMatchObject({
      qualityScore: null,
      qualityStatus: "NOT_EVALUATED",
      evaluationStatus: "technical_error",
      evaluatedChecks: 0,
      technicalErrors: 5,
      decision: "QUALITY_RECORDED",
      blocking: false,
    });
  });

  it("не изменяет Summary", () => {
    const fixture = createSummaryQualityGateFixture();
    const before = structuredClone(fixture.summary);
    executeSummaryQualityGateV3(fixture);
    expect(fixture.summary).toEqual(before);
  });

  it("ограничивает отображаемый статус при critical issue, но не блокирует", () => {
    const fixture = createSummaryQualityGateFixture();
    fixture.verdicts = fixture.verdicts.map((verdict) =>
      verdict.criterion === "faithfulness"
        ? {
            ...verdict,
            issues: [{
              code: "unsupported_claim",
              severity: "critical" as const,
              message: "Критическая неподтверждённая формулировка.",
            }],
          }
        : verdict
    );
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.value).toMatchObject({
      qualityScore: 100,
      qualityStatus: "NEEDS_ATTENTION",
      blocking: false,
    });
    expect(result.value.criticalIssues).toHaveLength(1);
    expect(result.diagnostic.decisionReasons).toContain(
      "CRITICAL_ISSUE:faithfulness:unsupported_claim",
    );
  });

  it("reports criterion name when a Judge score is below 80", () => {
    const fixture = createSummaryQualityGateFixture({ format: 75 });
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.diagnostic.decisionReasons).toContain("JUDGE_SCORE_BELOW_80:format:75");
    expect(result.diagnostic.effectiveCriterionScores.format).toBe(75);
  });

  it("reports structured semantic blocker codes", () => {
    const fixture = createSummaryQualityGateFixture();
    fixture.conversationStore = {
      ...fixture.conversationStore,
      requirements: [{ id: "card", need_type: "property_detail", value: "Площадь: 37,8 м²" }],
      primary_next_step: {
        action: "Провести просмотр",
        owner: "Агент",
        deadline: "сегодня вечером",
        channel: "телефон",
        status: "confirmed",
      },
    };
    const result = executeSummaryQualityGateV3(fixture);
    expect(result.diagnostic.decisionReasons).toEqual(expect.arrayContaining([
      "OUTCOME_ACTION_MISMATCH",
      "NEXT_STEP_CHANNEL_CONFLICT",
      "CRM_DATA_IN_REQUIREMENTS",
    ]));
  });

  it("запрещает Quality Score при недоступном источнике Facts", () => {
    const fixture = createSummaryQualityGateFixture();
    fixture.conversationStore = {
      ...fixture.conversationStore,
      source_quality: { ...fixture.conversationStore.source_quality, facts: "technical_error" },
      partial: true,
      source_errors: ["facts"],
    };

    const result = executeSummaryQualityGateV3(fixture);

    expect(result.value).toMatchObject({
      decision: "TECHNICAL_ERROR",
      blocking: true,
      qualityScore: null,
      qualityStatus: "NOT_EVALUATED",
      evaluationStatus: "partial",
      evaluatedChecks: 0,
      technicalErrors: 5,
      partialEvaluation: true,
    });
    expect(result.diagnostic.decisionReasons).toEqual(["FACTS_SOURCE_UNAVAILABLE"]);
  });
});

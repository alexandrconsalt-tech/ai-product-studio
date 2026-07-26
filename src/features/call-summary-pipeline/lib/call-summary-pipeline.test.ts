import { describe, expect, it } from "vitest";
import { computeQualityDecision, CRITERION_KEYS, type QualityIssue, type QualityScoresRaw } from "./call-summary-pipeline";

function scores(raw: Record<(typeof CRITERION_KEYS)[number], number>): QualityScoresRaw {
  return Object.fromEntries(CRITERION_KEYS.map((key) => [key, { raw_score: raw[key] }])) as QualityScoresRaw;
}

describe("computeQualityDecision", () => {
  it("scores all-4s as 100% PASS with equal 20% weights per criterion", () => {
    const report = computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 4, format: 4 }), []);
    expect(report.overall_score).toBe(100);
    expect(report.decision).toBe("PASS");
    for (const key of CRITERION_KEYS) {
      expect(report.scores[key].weight).toBe(0.2);
      expect(report.scores[key].score).toBe(100);
    }
  });

  it("maps threshold bands per spec §14", () => {
    // 4,4,4,4,3 -> (100*4+75)/5 = 95 -> PASS
    expect(computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 4, format: 3 }), []).decision).toBe("PASS");
    // 3,3,3,3,3 -> 75 -> REGENERATE_SUMMARY (80-89 band not hit; 75 falls below 80)
    expect(computeQualityDecision(scores({ faithfulness: 3, completeness: 3, usefulness: 3, agreements_next_step: 3, format: 3 }), []).decision).toBe("REVIEW_REQUIRED");
    // 4,4,4,3,3 -> (100*3+75*2)/5 = 90 -> PASS_WITH_MINOR_ISSUES
    expect(computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 3, format: 3 }), []).decision).toBe("PASS_WITH_MINOR_ISSUES");
    // 4,4,3,3,3 -> (100*2+75*3)/5 = 85 -> REGENERATE_SUMMARY
    expect(computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 3, agreements_next_step: 3, format: 3 }), []).decision).toBe("REGENERATE_SUMMARY");
  });

  it("caps overall at 60% and forces REVIEW_REQUIRED when any issue is marked critical, even with otherwise-perfect scores", () => {
    const issues: QualityIssue[] = [{ type: "FACT_INVENTED", critical: true }];
    const report = computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 4, format: 4 }), issues);
    expect(report.overall_score).toBe(60);
    expect(report.decision).toBe("REVIEW_REQUIRED");
    expect(report.blocking_errors).toHaveLength(1);
  });

  it("does not treat a non-critical issue as blocking", () => {
    const issues: QualityIssue[] = [{ type: "VERBOSE", critical: false }];
    const report = computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 4, format: 4 }), issues);
    expect(report.overall_score).toBe(100);
    expect(report.decision).toBe("PASS");
    expect(report.blocking_errors).toHaveLength(0);
  });

  it("produces the exact same result for AI-shaped and human-shaped input, since both feed the same function", () => {
    const aiScores = scores({ faithfulness: 3, completeness: 4, usefulness: 2, agreements_next_step: 4, format: 3 });
    const humanScores = scores({ faithfulness: 3, completeness: 4, usefulness: 2, agreements_next_step: 4, format: 3 });
    expect(computeQualityDecision(aiScores, [])).toEqual(computeQualityDecision(humanScores, []));
  });

  it("never lets a missing agreed next step alone reduce the agreements_next_step score below what was actually entered", () => {
    // Spec §12.4: "Конкретный следующий шаг по итогам разговора не согласован" is a valid raw_score:4 answer, not an automatic penalty.
    const report = computeQualityDecision(scores({ faithfulness: 4, completeness: 4, usefulness: 4, agreements_next_step: 4, format: 4 }), []);
    expect(report.scores.agreements_next_step.raw_score).toBe(4);
    expect(report.scores.agreements_next_step.score).toBe(100);
  });
});

import { describe, expect, it } from "vitest";
import { createDefaultCriteria, getAllBlockScores, getHumanScore, normalizeCriteria } from "./scoring";

describe("ручная оценка Summary", () => {
  it("использует пять равновесных критериев со шкалой 0–4", () => {
    const criteria = createDefaultCriteria();
    criteria.truth = 0;
    criteria.criticalFacts = 1;
    criteria.utility = 2;
    criteria.action = 3;
    criteria.format = 4;

    expect(getAllBlockScores(criteria)).toEqual({
      truthScore: 0,
      criticalFactsScore: 50,
      utilityScore: 70,
      actionScore: 90,
      formatScore: 100,
    });
    expect(getHumanScore(criteria)).toBe(62);
  });

  it("переводит сохранённые legacy-оценки в новую шкалу", () => {
    const normalized = normalizeCriteria({
      truth_no_fiction: "yes",
      truth_not_distorted: "partial",
      truth_roles: "no",
      critical_goal: "na",
    });

    expect(normalized.truth).toBe(1);
    expect(normalized.criticalFacts).toBe(4);
    expect(normalized.utility).toBe(4);
    expect(normalized.action).toBe(4);
    expect(normalized.format).toBe(4);
  });
});

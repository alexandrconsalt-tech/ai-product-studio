import { describe, expect, it } from "vitest";
import {
  computeQualityDecision,
  CRITERION_KEYS,
  defaultCallSummaryStages,
  FactsQuotesSchema,
  NeedsSchema,
  OutcomeSchema,
  QualityJudgeRawSchema,
  stageStatChips,
  SummarySchema,
  type QualityIssue,
  type QualityScoresRaw,
} from "./call-summary-pipeline";

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

describe("defaultCallSummaryStages", () => {
  it("gives every stage a generous maxTokens budget so structured extraction output isn't silently truncated", () => {
    for (const stage of defaultCallSummaryStages()) {
      expect(stage.maxTokens).toBeGreaterThanOrEqual(2000);
    }
  });

  it("gives every stage a bounded timeout so a hung request fails well under a minute", () => {
    for (const stage of defaultCallSummaryStages()) {
      expect(stage.timeoutMs).toBeGreaterThan(0);
      expect(stage.timeoutMs).toBeLessThanOrEqual(60000);
    }
  });

  it("defaults to models this app's own catalog labels as AI Tunnel-verified, not the ambiguous OpenAI/Anthropic-labeled ones", () => {
    // Regression guard for the real-world failure this defaulting fixed:
    // "gpt-5-mini"/"claude-sonnet-4.5" are labeled "(OpenAI)"/"(Anthropic)"
    // in MODEL_OPTIONS, not "(AI Tunnel)" -- a user on the AI Tunnel
    // provider got a 48s hang then an unparseable empty response from
    // "gpt-5-mini" specifically.
    for (const stage of defaultCallSummaryStages()) {
      expect(stage.model).not.toBe("gpt-5-mini");
      expect(stage.model).not.toBe("claude-sonnet-4.5");
    }
  });
});

describe("stageStatChips", () => {
  it("returns nothing for a stage with no output yet", () => {
    expect(stageStatChips("facts", undefined)).toEqual([]);
  });

  it("summarizes facts/quotes/conflicts counts for the facts stage", () => {
    const chips = stageStatChips("facts", { facts: [{}, {}], quotes: [{}], conflicts: [], missing_critical_facts: ["purchase_timeline"] });
    expect(chips).toEqual([
      { label: "Фактов", value: "2" },
      { label: "Цитат", value: "1" },
      { label: "Конфликтов", value: "0" },
      { label: "Не найдено", value: "1" },
    ]);
  });

  it("summarizes the quality gate stage by running the same computeQualityDecision as the rest of the app", () => {
    const chips = stageStatChips("quality_gate", {
      scores: {
        faithfulness: { raw_score: 4 },
        completeness: { raw_score: 4 },
        usefulness: { raw_score: 4 },
        agreements_next_step: { raw_score: 4 },
        format: { raw_score: 4 },
      },
      issues: [],
    });
    expect(chips).toEqual([
      { label: "Итог", value: "100%" },
      { label: "Решение", value: "PASS" },
      { label: "Блокеров", value: "0" },
    ]);
  });

  it("flags an incomplete summary instead of reading fields that don't exist on it", () => {
    const chips = stageStatChips("summary", { summary_status: "input_data_incomplete", missing_fact: { description: "срок покупки не подтверждён в JSON" } });
    expect(chips).toEqual([{ label: "Статус", value: "неполные данные" }]);
  });
});

// Regression coverage for the second real-world TECHNICAL_ERROR a user hit
// live: a well-formed, non-truncated response that was merely "almost
// right" (a stray string where a number/boolean was expected, an enum
// value not exactly matching the prompt's list) used to invalidate the
// *entire* stage. Every schema below must accept these instead of
// throwing -- see the `loose*` helpers in call-summary-pipeline.ts.
describe("schema tolerance against real-world model output variance", () => {
  it("FactsQuotesSchema accepts a string confidence, a translated status, and a malformed evidence item without failing the whole facts array", () => {
    const result = FactsQuotesSchema.safeParse({
      facts: [
        { id: "fact_001", category: "budget", normalized_text: "Бюджет до 5 млн", confidence: "0.95", status: "подтверждено", evidence: [{ turn_id: "not-a-number", quote: 12345 }] },
      ],
      quotes: [{ id: "quote_001", category: "objection", text: "дороговато", importance: "СРЕДНЯЯ" }],
      conflicts: [],
      missing_critical_facts: [],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.facts[0].confidence).toBe(0.95);
    expect(result.data.facts[0].status).toBe("подтверждено");
  });

  it("NeedsSchema accepts a budget with numeric strings, an unrecognized priority label, and an out-of-range confidence", () => {
    const result = NeedsSchema.safeParse({
      primary_need: { summary: "Клиент рассматривает покупку" },
      requirements: {
        budget: { min: "1000000", max: "5500000", currency: "RUB" },
        object_parameters: [{ parameter: "площадь", priority: "важно" }],
      },
      decision_context: {},
      canonical_attributes: {},
      confidence: 95, // model sent a percentage instead of a 0-1 fraction
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.requirements.budget?.min).toBe(1000000);
    expect(result.data.confidence).toBe(1); // clamped, not rejected
  });

  it("NeedsSchema still accepts a fully missing requirements/decision_context/canonical_attributes block", () => {
    const result = NeedsSchema.safeParse({ primary_need: {}, confidence: 0.5 });
    expect(result.success).toBe(true);
  });

  it("OutcomeSchema accepts a non-catalog outcome type, a translated agreement owner, and string booleans in next_step", () => {
    const result = OutcomeSchema.safeParse({
      conversation_outcome: { type: "viewing scheduled", summary: "Просмотр назначен" },
      agreements: [{ id: "agreement_001", owner: "клиент", action: "приедет на просмотр", status: "согласовано" }],
      next_step: { primary: { owner: "agent", action: "провести показ" }, is_specific: "true", is_agreed: "true" },
      confidence: 0.9,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.next_step.is_specific).toBe(true);
    expect(result.data.next_step.is_agreed).toBe(true);
    expect(result.data.conversation_outcome.type).toBe("viewing scheduled");
  });

  it("SummarySchema treats a missing summary_status discriminator as the 'ok' branch instead of failing the union", () => {
    const result = SummarySchema.safeParse({ conversation_result: "Итог разговора.", key_facts: ["Факт 1"], important_quotes: [], agreements_next_step: "Согласован просмотр." });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary_status).toBe("ok");
  });

  it("SummarySchema still recognizes the genuine input_data_incomplete escape hatch", () => {
    const result = SummarySchema.safeParse({ summary_status: "input_data_incomplete", missing_fact: { description: "срок не подтверждён" } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary_status).toBe("input_data_incomplete");
  });

  it("SummarySchema caps key_facts/important_quotes at their limits instead of failing when the model returns too many", () => {
    const result = SummarySchema.safeParse({
      summary_status: "ok",
      conversation_result: "Итог.",
      key_facts: ["1", "2", "3", "4", "5", "6"],
      important_quotes: ["a", "b", "c"],
      agreements_next_step: "Шаг.",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.key_facts).toHaveLength(4);
    expect(result.data.important_quotes).toHaveLength(2);
  });

  it("QualityJudgeRawSchema clamps a string/out-of-range raw_score and an unrecognized issue type instead of failing the whole judge output", () => {
    const result = QualityJudgeRawSchema.safeParse({
      scores: {
        faithfulness: { raw_score: "4" },
        completeness: { raw_score: 7 },
        usefulness: { raw_score: 3 },
        agreements_next_step: { raw_score: 4 },
        format: { raw_score: 4 },
      },
      issues: [{ type: "СЛИШКОМ_МНОГОСЛОВНО", critical: "false" }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scores.faithfulness.raw_score).toBe(4);
    expect(result.data.scores.completeness.raw_score).toBe(4); // clamped from 7
    expect(result.data.issues[0].type).toBe("FORMAT_VIOLATION");
    expect(result.data.issues[0].critical).toBe(false);
  });

  it("QualityJudgeRawSchema never lets a missing criterion silently score as a passing 4", () => {
    const result = QualityJudgeRawSchema.safeParse({ scores: { faithfulness: {}, completeness: {}, usefulness: {}, agreements_next_step: {}, format: {} }, issues: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const key of CRITERION_KEYS) expect(result.data.scores[key].raw_score).toBe(2);
  });
});

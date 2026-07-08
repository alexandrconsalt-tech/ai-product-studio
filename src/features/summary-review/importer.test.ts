import { describe, expect, it } from "vitest";
import { normalizePlaygroundRun } from "./importer";

// Shape mirrors public/pipeline-lab-v3.html's own "Скачать полный отчёт
// (JSON)" download and reportRunToParent()'s `report` field:
// {pipeline, result: ctx, stageReports, usage}. `result` (aliased `ctx`
// below) is what actually carries every stage's output -- facts/needs/
// outcome/conversation_store/summary/summary_quality_gate/the 5 judges are
// all top-level keys on it, per the stages-1-9 rework (2026-07-08).
function realPipelineReport() {
  return {
    pipeline: [],
    result: {
      __transcript: "Оператор: ...\nКлиент: ...",
      facts: {
        client_name: { value: "Дмитрий", confidence: 0.95, evidence: "меня Дмитрий зовут", verification_status: "pending" },
      },
      conversation_store: {
        facts: {
          client_name: { value: "Дмитрий", confidence: 0.95, evidence: "меня Дмитрий зовут", verified: true, source: "fact_check" },
        },
        needs: {},
        property_requirements: {},
        outcome: {},
        quality: { fact_check_score: 0.95, need_check_score: 0.9, outcome_check_score: 0.92, store_score: 0.93 },
        debug: {},
      },
      summary: { summary: "Дмитрий ищет квартиру в Москве в ипотеку." },
      summary_quality_gate: {
        summary_quality_score: 92.9,
        decision: "AUTO_SAVE",
        scores: { truth_check: 96, critical_facts_check: 90, context_utility_check: 88, action_check: 90, presentation_check: 100 },
      },
      truth_check: { score: 96, status: "pass", has_hallucinations: false, explanation: "ок" },
      critical_facts_check: { score: 90, status: "pass", missed_critical_facts: [], explanation: "ок" },
      context_utility_check: { score: 88, status: "pass", explanation: "ок" },
      action_check: { score: 90, status: "pass", explanation: "ок" },
      presentation_check: { score: 100, status: "pass", explanation: "ок" },
      crm: { card: { client_name: "Дмитрий" }, saved: true },
    },
    stageReports: [],
    usage: { totalTokens: 5000, totalCost: 0.02 },
  };
}

describe("normalizePlaygroundRun", () => {
  it("reads clientName from the nested Conversation Store, not a flat top-level field", () => {
    const run = normalizePlaygroundRun(realPipelineReport());
    expect(run.clientName).toBe("Дмитрий");
  });

  it("reads the Summary Agent's {summary: string} object as plain text", () => {
    const run = normalizePlaygroundRun(realPipelineReport());
    expect(run.summary).toBe("Дмитрий ищет квартиру в Москве в ипотеку.");
  });

  it("reads aiScore/aiDecision from ctx.summary_quality_gate, not a flat top-level field", () => {
    const run = normalizePlaygroundRun(realPipelineReport());
    expect(run.aiScore).toBe(92.9);
    expect(run.aiDecision).toBe("AUTO_SAVE");
  });

  it("bundles the 5 separate judge keys into one aiJudgesJson bag", () => {
    const run = normalizePlaygroundRun(realPipelineReport());
    const judges = run.aiJudgesJson as Record<string, unknown>;
    expect(Object.keys(judges).sort()).toEqual(
      ["action_check", "context_utility_check", "critical_facts_check", "presentation_check", "truth_check"].sort(),
    );
    expect((judges.truth_check as { score: number }).score).toBe(96);
  });

  it("reads the transcript from ctx.__transcript (double underscore)", () => {
    const run = normalizePlaygroundRun(realPipelineReport());
    expect(run.transcript).toContain("Оператор");
  });

  it("still supports a legacy flat-shape report (pre stages-1-9 rework)", () => {
    const legacy = {
      client_name: "Андрей",
      transcript: "Оператор: ...",
      summary: "Плоское саммари строкой.",
      ai_score: 88,
      ai_decision: "MANUAL_REVIEW",
      judges: { truth: { score: 80 } },
    };
    const run = normalizePlaygroundRun(legacy);
    expect(run.clientName).toBe("Андрей");
    expect(run.summary).toBe("Плоское саммари строкой.");
    expect(run.aiScore).toBe(88);
    expect(run.aiDecision).toBe("MANUAL_REVIEW");
    expect(run.aiJudgesJson).toEqual({ truth: { score: 80 } });
  });

  it("falls back to defaults for a genuinely empty input without throwing", () => {
    const run = normalizePlaygroundRun({});
    expect(run.clientName).toBe("Клиент не указан");
    expect(run.summary).toBe("");
    expect(run.aiScore).toBe(0);
    expect(run.aiDecision).toBe("MANUAL_REVIEW");
    expect(run.aiJudgesJson).toEqual({});
  });
});

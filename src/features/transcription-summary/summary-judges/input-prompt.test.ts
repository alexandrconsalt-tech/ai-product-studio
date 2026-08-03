import { describe, expect, it } from "vitest";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import { createSummaryFixtureContext } from "../summary/fixtures";
import {
  buildSummaryJudgeInput,
  calculateSummaryContentHash,
} from "./input-builder";
import {
  buildSummaryJudgePrompt,
  SUMMARY_JUDGE_PROMPTS,
} from "./prompt-builders";

describe("Summary Judge v3 input builder", () => {
  it("builds one typed immutable source context for each criterion", () => {
    const fixture = createSummaryFixtureContext();
    const beforeStore = JSON.stringify(fixture.store);
    const beforeSummary = JSON.stringify(fixture.output);
    for (const criterion of SUMMARY_CRITERIA) {
      const result = buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary: fixture.output,
        transcript: fixture.transcript,
        criterion,
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS[criterion].version,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.meta.judgeCriterion).toBe(criterion);
      expect(result.value.evaluationPolicy).toEqual({ criterion, weight: 0.2 });
      expect(result.value.meta.summaryHash).toBe(calculateSummaryContentHash(fixture.output));
      expect(result.value.meta.storeContentHash).toBe(fixture.store.content_hash);
      expect(result.value).not.toHaveProperty("otherJudgeScores");
      expect(result.value).not.toHaveProperty("qualityGate");
    }
    expect(JSON.stringify(fixture.store)).toBe(beforeStore);
    expect(JSON.stringify(fixture.output)).toBe(beforeSummary);
  });

  it("returns NOT_RUN when Summary is missing or technical", () => {
    const fixture = createSummaryFixtureContext();
    for (const summary of [null, { status: "technical_error" }]) {
      const result = buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary,
        transcript: fixture.transcript,
        criterion: "faithfulness",
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS.faithfulness.version,
      });
      expect(result).toMatchObject({ ok: false, disposition: "NOT_RUN" });
    }
  });

  it("rejects Store, Summary, transcript and manifest provenance mismatches", () => {
    const fixture = createSummaryFixtureContext();
    const inputs = [
      { conversationStore: { ...fixture.store, content_hash: "0".repeat(64) } },
      {
        summary: {
          ...fixture.output,
          metadata: { ...fixture.output.metadata, sourceStoreHash: "0".repeat(64) },
        },
      },
      {
        transcript: {
          ...fixture.transcript,
          turns: fixture.transcript.turns.map((turn, index) => index === 0
            ? { ...turn, text: `${turn.text} changed` }
            : turn),
        },
      },
      {
        manifest: {
          ...fixture.manifest,
          manifestHash: "0".repeat(64),
        },
      },
    ];
    for (const override of inputs) {
      const result = buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary: fixture.output,
        transcript: fixture.transcript,
        criterion: "faithfulness",
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS.faithfulness.version,
        ...override,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.disposition).toBe("TECHNICAL_ERROR");
    }
  });

  it("blocks format-limit violations before any Judge call", () => {
    const fixture = createSummaryFixtureContext();
    const invalidSummaries = [
      {
        ...fixture.output,
        key_facts: ["1", "2", "3", "4", "5"].map((value) => ({ label: value, value })),
      },
      {
        ...fixture.output,
        quotes: [
          ...fixture.output.quotes,
          { text: "Там переуступка?" },
          { text: "Агент ответил." },
        ],
      },
    ];
    for (const summary of invalidSummaries) {
      expect(buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary,
        transcript: fixture.transcript,
        criterion: "format",
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS.format.version,
      })).toMatchObject({
        ok: false,
        disposition: "TECHNICAL_ERROR",
        error: { errorCode: "SUMMARY_JUDGE_INPUT_INVALID" },
      });
    }
  });
});

describe("five isolated Summary Judge prompts", () => {
  it("uses five distinct prompt IDs and versions", () => {
    expect(new Set(Object.values(SUMMARY_JUDGE_PROMPTS).map((item) => item.id)).size).toBe(5);
    expect(new Set(Object.values(SUMMARY_JUDGE_PROMPTS).map((item) => item.version)).size).toBe(5);
  });

  it("is deterministic and fully visible for every criterion", () => {
    const fixture = createSummaryFixtureContext();
    for (const criterion of SUMMARY_CRITERIA) {
      const built = buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary: fixture.output,
        transcript: fixture.transcript,
        criterion,
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS[criterion].version,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) continue;
      const first = buildSummaryJudgePrompt(built.value);
      const second = buildSummaryJudgePrompt(built.value);
      expect(first).toEqual(second);
      expect(first.promptHash).toHaveLength(64);
      expect(first.promptId).toBe(SUMMARY_JUDGE_PROMPTS[criterion].id);
      expect(first.resolvedPrompt).toContain(`ONLY CRITERION: ${criterion}`);
      expect(first.resolvedPrompt).toContain("INPUT STORE");
      expect(first.resolvedPrompt).toContain("INPUT SUMMARY");
      expect(first.resolvedPrompt).toContain("TRANSCRIPT CONTEXT");
      expect(first.resolvedPrompt).toContain("OUTPUT CONTRACT");
      expect(first.resolvedPrompt).toContain("score — целое число от 0 до 100");
      expect(first.resolvedPrompt).not.toContain("otherJudgeScores");
      expect(first.resolvedPrompt).not.toContain("QUALITY GATE INPUT");
    }
  });

  it("keeps criterion instructions isolated", () => {
    const fixture = createSummaryFixtureContext();
    const prompts = Object.fromEntries(SUMMARY_CRITERIA.map((criterion) => {
      const built = buildSummaryJudgeInput({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary: fixture.output,
        transcript: fixture.transcript,
        criterion,
        judgePromptVersion: SUMMARY_JUDGE_PROMPTS[criterion].version,
      });
      if (!built.ok) throw new Error(built.error.message);
      return [criterion, buildSummaryJudgePrompt(built.value).basePrompt];
    }));
    expect(prompts.faithfulness).toContain("не считай omission");
    expect(prompts.completeness).toContain("критически важные пропуски");
    expect(prompts.usefulness).toContain("без записи");
    expect(prompts.agreements_next_step).toContain("deadline или channel");
    expect(prompts.format).toContain("умеренное тематическое пересечение");
  });
});

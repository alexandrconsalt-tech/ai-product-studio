import { describe, expect, it } from "vitest";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import { SummaryJudgeV3Schema } from "../contracts/summary-judges/v3/contract";
import {
  createJudgeFinding,
  createSummaryJudgeFixture,
  withJudgeFinding,
} from "./fixtures";
import { validateSummaryJudgeVerdict } from "./post-validation";

describe("Summary Judge v3 discriminated output and formal post-validation", () => {
  it("accepts the criterion-specific payload for all five Judges", () => {
    for (const criterion of SUMMARY_CRITERIA) {
      const fixture = createSummaryJudgeFixture(criterion);
      const result = validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        fixture.verdict,
      );
      expect(result).toMatchObject({ ok: true, value: { criterion, score: 100, verdict: "pass" } });
    }
  });

  it("covers warning, substantial, critical, unusable, technical and invalid outputs for every Judge", () => {
    for (const criterion of SUMMARY_CRITERIA) {
      const fixture = createSummaryJudgeFixture(criterion);
      const finding = createJudgeFinding(criterion, {
        sourceTurnIds: [fixture.input.transcriptContext.turns[0].turnId],
      });
      for (const score of [75, 50, 25, 0] as const) {
        expect(validateSummaryJudgeVerdict(
          fixture.input,
          criterion,
          withJudgeFinding(fixture.verdict, score, finding),
        ).ok).toBe(true);
      }
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        {
          ...fixture.verdict,
          verdict: "technical_error",
          score: null,
          confidence: null,
        },
      ).ok).toBe(true);
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        { ...fixture.verdict, score: 87 },
      ).ok).toBe(false);
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        { ...fixture.verdict, verdict: "warning" },
      ).ok).toBe(false);
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        {
          ...withJudgeFinding(fixture.verdict, 50, finding),
          issues: [{ ...finding, sourceTurnIds: ["turn-invalid"] }],
        },
      ).ok).toBe(false);
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        criterion,
        { ...fixture.verdict, payload: { criterion } },
      ).ok).toBe(false);
    }
  });

  it.each([
    [100, "pass"],
    [75, "warning"],
    [50, "fail"],
    [25, "fail"],
    [0, "fail"],
  ] as const)("enforces score %s → verdict %s", (score, verdict) => {
    const fixture = createSummaryJudgeFixture("format");
    const candidate = score === 100
      ? fixture.verdict
      : withJudgeFinding(
        fixture.verdict,
        score,
        createJudgeFinding("format"),
      );
    expect(SummaryJudgeV3Schema.safeParse(candidate).success).toBe(true);
    expect(candidate.verdict).toBe(verdict);
  });

  it("accepts technical_error only with null score and confidence", () => {
    const fixture = createSummaryJudgeFixture("faithfulness");
    const technical = {
      ...fixture.verdict,
      verdict: "technical_error",
      score: null,
      confidence: null,
    };
    expect(validateSummaryJudgeVerdict(
      fixture.input,
      "faithfulness",
      technical,
    )).toMatchObject({ ok: true, value: { verdict: "technical_error", score: null } });
    expect(SummaryJudgeV3Schema.safeParse({ ...technical, score: 0 }).success).toBe(false);
    expect(SummaryJudgeV3Schema.safeParse({
      ...fixture.verdict,
      score: 75,
      verdict: "pass",
    }).success).toBe(false);
  });

  it("rejects arbitrary score, criterion mismatch and invalid payload", () => {
    const fixture = createSummaryJudgeFixture("faithfulness");
    expect(SummaryJudgeV3Schema.safeParse({ ...fixture.verdict, score: 87 }).success).toBe(false);
    expect(validateSummaryJudgeVerdict(
      fixture.input,
      "faithfulness",
      { ...fixture.verdict, criterion: "format" },
    )).toMatchObject({ ok: false, error: { errorCode: "SUMMARY_JUDGE_CONTRACT_INVARIANT_FAILED" } });
    expect(validateSummaryJudgeVerdict(
      fixture.input,
      "faithfulness",
      {
        ...fixture.verdict,
        payload: { criterion: "faithfulness", unsupportedClaims: [] },
      },
    )).toMatchObject({ ok: false });
  });

  it("rejects Store/Summary metadata mismatch", () => {
    const fixture = createSummaryJudgeFixture("completeness");
    for (const metadata of [
      { ...fixture.verdict.metadata, sourceStoreId: "store-other" },
      { ...fixture.verdict.metadata, sourceStoreHash: "0".repeat(64) },
      { ...fixture.verdict.metadata, sourceSummaryHash: "0".repeat(64) },
      { ...fixture.verdict.metadata, promptVersion: "wrong" },
    ]) {
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        "completeness",
        { ...fixture.verdict, metadata },
      )).toMatchObject({ ok: false });
    }
  });

  it("rejects invalid issue codes and unknown source references", () => {
    const fixture = createSummaryJudgeFixture("agreements_next_step");
    const invalidCode = withJudgeFinding(
      fixture.verdict,
      50,
      createJudgeFinding("agreements_next_step", { code: "semantic_repetition" }),
    );
    const invalidTurn = withJudgeFinding(
      fixture.verdict,
      50,
      createJudgeFinding("agreements_next_step", {
        sourceTurnIds: ["turn-does-not-exist"],
      }),
    );
    const invalidStoreItem = withJudgeFinding(
      fixture.verdict,
      50,
      createJudgeFinding("agreements_next_step", {
        storeItemIds: ["item-does-not-exist"],
      }),
    );
    for (const candidate of [invalidCode, invalidTurn, invalidStoreItem]) {
      expect(validateSummaryJudgeVerdict(
        fixture.input,
        "agreements_next_step",
        candidate,
      )).toMatchObject({ ok: false, error: { errorCode: "SUMMARY_JUDGE_CONTRACT_INVARIANT_FAILED" } });
    }
  });

  it("does not mutate Summary or verdict during validation", () => {
    const fixture = createSummaryJudgeFixture("usefulness");
    const beforeSummary = JSON.stringify(fixture.input.summary);
    const beforeVerdict = JSON.stringify(fixture.verdict);
    validateSummaryJudgeVerdict(fixture.input, "usefulness", fixture.verdict);
    expect(JSON.stringify(fixture.input.summary)).toBe(beforeSummary);
    expect(JSON.stringify(fixture.verdict)).toBe(beforeVerdict);
  });

  it("counts a visible CRM funding attribute as Completeness coverage", () => {
    const fixture = createSummaryJudgeFixture("completeness");
    const finding = createJudgeFinding("completeness", {
      code: "missing_financial_context",
      message: "В Summary отсутствует источник средств клиента.",
    });
    const candidate = {
      ...withJudgeFinding(fixture.verdict, 50, finding),
      payload: {
        ...fixture.verdict.payload,
        missingFinancialContext: [finding],
      },
    };
    expect(validateSummaryJudgeVerdict(
      fixture.input,
      "completeness",
      candidate,
    )).toMatchObject({ ok: true, value: { score: 100, verdict: "pass", issues: [] } });
  });
});

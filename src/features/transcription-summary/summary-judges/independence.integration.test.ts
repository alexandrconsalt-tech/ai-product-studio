import { describe, expect, it } from "vitest";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import type { SummaryCriterionV3 } from "../contracts/summary-judge-input/v3/contract";
import {
  SUMMARY_JUDGE_PAYLOAD_FIXTURES,
  SummaryJudgeV3Schema,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import {
  createSummaryFixtureContext,
  createSummaryWithoutAgreementFixture,
} from "../summary/fixtures";
import { executeFiveSummaryJudgesV3, executeSummaryJudgeV3 } from "./execute";
import {
  createJudgeFinding,
  createSummaryJudgeFixture,
  withJudgeFinding,
} from "./fixtures";
import { buildSummaryJudgeInput } from "./input-builder";
import { SUMMARY_JUDGE_PROMPTS } from "./prompt-builders";

function transport(value: unknown): StructuredProviderTransport {
  const candidate = value && typeof value === "object" && "criterion" in value && "score" in value
    ? value as unknown as { score: number | null; verdict: string; issues?: { code: string; severity: string; message: string }[] }
    : null;
  const providerValue = candidate ? {
    score: candidate.score ?? 0,
    decision: candidate.verdict === "pass" ? "PASS"
      : candidate.verdict === "warning" ? "NEEDS_REWORK"
        : candidate.verdict === "technical_error" ? "TECHNICAL_ERROR" : "FAIL",
    summary: "Controlled Judge result.",
    violations: (candidate.issues ?? []).map((item) => ({ code: item.code, severity: item.severity, description: item.message })),
  } : value;
  return async () => ({
    ok: true,
    rawResponse: {},
    structuredValue: providerValue,
    attestation: {
      requested: true,
      forwarded: true,
      accepted: true,
      structuredResponseReturned: true,
    },
  });
}

function transports(
  values: Readonly<Record<SummaryCriterionV3, unknown>>,
): Readonly<Record<SummaryCriterionV3, StructuredProviderTransport>> {
  return Object.fromEntries(
    SUMMARY_CRITERIA.map((criterion) => [criterion, transport(values[criterion])]),
  ) as Record<SummaryCriterionV3, StructuredProviderTransport>;
}

function perfectVerdicts(): Record<SummaryCriterionV3, SummaryJudgeV3> {
  return Object.fromEntries(
    SUMMARY_CRITERIA.map((criterion) => [
      criterion,
      createSummaryJudgeFixture(criterion).verdict,
    ]),
  ) as Record<SummaryCriterionV3, SummaryJudgeV3>;
}

describe("five-Judge independent mocked flow", () => {
  it("returns five independent 100 verdicts without an aggregate score", async () => {
    const context = createSummaryFixtureContext();
    const results = await executeFiveSummaryJudgesV3({
      manifest: context.manifest,
      conversationStore: context.store,
      summary: context.output,
      transcript: context.transcript,
      provider: "mock",
      model: "mock-summary-judge",
      transports: transports(perfectVerdicts()),
    });
    expect(Object.keys(results)).toEqual(SUMMARY_CRITERIA);
    expect(Object.values(results).every((result) => result.ok && result.value.score === 100)).toBe(true);
    expect(results).not.toHaveProperty("quality_score");
    expect(results).not.toHaveProperty("qualityGate");
  });

  it("preserves one warning and one fail without influencing other Judges", async () => {
    const context = createSummaryFixtureContext();
    const values = perfectVerdicts();
    values.format = withJudgeFinding(
      values.format,
      75,
      createJudgeFinding("format"),
    );
    values.completeness = withJudgeFinding(
      values.completeness,
      50,
      createJudgeFinding("completeness"),
    );
    const results = await executeFiveSummaryJudgesV3({
      manifest: context.manifest,
      conversationStore: context.store,
      summary: context.output,
      transcript: context.transcript,
      provider: "mock",
      model: "mock-summary-judge",
      transports: transports(values),
    });
    expect(results.format).toMatchObject({ ok: true, value: { score: 75, verdict: "warning" } });
    expect(results.completeness).toMatchObject({ ok: true, value: { score: 50, verdict: "fail" } });
    expect(results.faithfulness).toMatchObject({ ok: true, value: { score: 100 } });
    expect(results.usefulness).toMatchObject({ ok: true, value: { score: 100 } });
    expect(results.agreements_next_step).toMatchObject({ ok: true, value: { score: 100 } });
  });

  it("continues after Faithfulness or Format technical error", async () => {
    const context = createSummaryFixtureContext();
    for (const failingCriterion of ["faithfulness", "format"] as const) {
      const values = perfectVerdicts();
      const judgeTransports = transports(values) as Record<SummaryCriterionV3, StructuredProviderTransport>;
      judgeTransports[failingCriterion] = async () => ({
        ok: false,
        errorCode: "PROVIDER_ERROR",
        message: "controlled technical error",
        attestation: {
          requested: true,
          forwarded: true,
          accepted: false,
          structuredResponseReturned: false,
        },
      });
      const results = await executeFiveSummaryJudgesV3({
        manifest: context.manifest,
        conversationStore: context.store,
        summary: context.output,
        transcript: context.transcript,
        provider: "mock",
        model: "mock-summary-judge",
        transports: judgeTransports,
      });
      expect(results[failingCriterion]).toMatchObject({ ok: false, disposition: "TECHNICAL_ERROR" });
      for (const criterion of SUMMARY_CRITERIA.filter((item) => item !== failingCriterion)) {
        expect(results[criterion]).toMatchObject({ ok: true, value: { score: 100 } });
      }
    }
  });

  it("represents special semantic cases in only the responsible Judge payload", async () => {
    const cases = [
      ["faithfulness", 25, createJudgeFinding("faithfulness", {
        code: "invented_detail",
        severity: "critical",
        message: "Summary invents a deadline.",
      })],
      ["completeness", 50, createJudgeFinding("completeness", {
        code: "missing_constraint",
        severity: "high",
        message: "Important objection is omitted.",
      })],
      ["usefulness", 50, createJudgeFinding("usefulness", {
        code: "agent_blocking_omission",
        severity: "high",
        message: "Summary is accurate but not operationally useful.",
      })],
      ["format", 75, createJudgeFinding("format", {
        code: "semantic_repetition",
        message: "One key fact repeats the result without new detail.",
      })],
      ["format", 50, createJudgeFinding("format", {
        code: "technical_field_leak",
        severity: "high",
        message: "Technical metadata appears in user text.",
      })],
    ] as const;
    for (const [criterion, score, finding] of cases) {
      const fixture = createSummaryJudgeFixture(criterion);
      const result = await executeSummaryJudgeV3({
        manifest: fixture.context.manifest,
        conversationStore: fixture.context.store,
        summary: fixture.context.output,
        transcript: fixture.context.transcript,
        criterion,
        provider: "mock",
        model: "mock-summary-judge",
        transport: transport(withJudgeFinding(fixture.verdict, score, finding)),
      });
      expect(result).toMatchObject({ ok: true, value: { criterion, score } });
    }
  });

  it("keeps criterion-specific role, quote, attribute, agreement and format findings isolated", async () => {
    const cases = [
      {
        criterion: "faithfulness" as const,
        issues: [
          createJudgeFinding("faithfulness", { code: "role_error", message: "Client and agent are swapped." }),
          createJudgeFinding("faithfulness", { code: "quote_error", message: "Quote is not exact." }),
          createJudgeFinding("faithfulness", { code: "attribute_mismatch", message: "Attribute differs from Store." }),
        ],
      },
      {
        criterion: "completeness" as const,
        issues: [
          createJudgeFinding("completeness", { code: "missing_constraint", message: "Objection is omitted." }),
          createJudgeFinding("completeness", { code: "missing_next_step", message: "Verified next step is omitted." }),
        ],
      },
      {
        criterion: "usefulness" as const,
        issues: [
          createJudgeFinding("usefulness", { code: "unclear_statement", message: "Operational result is ambiguous." }),
          createJudgeFinding("usefulness", { code: "unnecessary_detail", message: "Frame-by-frame retelling hides the result." }),
        ],
      },
      {
        criterion: "agreements_next_step" as const,
        issues: [
          createJudgeFinding("agreements_next_step", { code: "incorrect_owner", message: "Owner differs from Store." }),
          createJudgeFinding("agreements_next_step", { code: "incorrect_channel", message: "Channel is invented." }),
          createJudgeFinding("agreements_next_step", { code: "invented_detail", message: "Deadline is invented." }),
        ],
      },
      {
        criterion: "format" as const,
        issues: [
          createJudgeFinding("format", { code: "crm_card_duplication", message: "CRM card fields are repeated." }),
          createJudgeFinding("format", { code: "verbosity", message: "Summary is excessively verbose." }),
          createJudgeFinding("format", { code: "readability", message: "Sentences are difficult to scan." }),
        ],
      },
    ];
    for (const item of cases) {
      const fixture = createSummaryJudgeFixture(item.criterion);
      const verdict = SummaryJudgeV3Schema.parse({
        ...fixture.verdict,
        verdict: "fail",
        score: 25,
        issues: item.issues,
      });
      const result = await executeSummaryJudgeV3({
        manifest: fixture.context.manifest,
        conversationStore: fixture.context.store,
        summary: fixture.context.output,
        transcript: fixture.context.transcript,
        criterion: item.criterion,
        provider: "mock",
        model: "mock-summary-judge",
        transport: transport(verdict),
      });
      expect(result).toMatchObject({
        ok: true,
        value: { criterion: item.criterion, score: 25, issues: item.issues },
      });
    }
  });

  it("does not penalize absent agreement or acceptable thematic overlap", async () => {
    const context = createSummaryWithoutAgreementFixture();
    const criterion = "agreements_next_step" as const;
    const built = buildSummaryJudgeInput({
      manifest: context.manifest,
      conversationStore: context.store,
      summary: context.output,
      transcript: context.transcript,
      criterion,
      judgePromptVersion: SUMMARY_JUDGE_PROMPTS[criterion].version,
    });
    if (!built.ok) throw new Error(built.error.message);
    const verdict = SummaryJudgeV3Schema.parse({
      criterion,
      verdict: "pass",
      score: 100,
      confidence: 1,
      issues: [],
      evidence: [],
      payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES.agreements_next_step,
      metadata: {
        sourceStoreId: built.value.meta.storeId,
        sourceStoreHash: built.value.meta.storeContentHash,
        sourceSummaryHash: built.value.meta.summaryHash,
        contractVersion: "3.1.0",
        promptVersion: built.value.meta.judgePromptVersion,
      },
    });
    expect(await executeSummaryJudgeV3({
      manifest: context.manifest,
      conversationStore: context.store,
      summary: context.output,
      transcript: context.transcript,
      criterion,
      provider: "mock",
      model: "mock-summary-judge",
      transport: transport(verdict),
    })).toMatchObject({ ok: true, value: { score: 100 } });

    const format = createSummaryJudgeFixture("format");
    expect(await executeSummaryJudgeV3({
      manifest: format.context.manifest,
      conversationStore: format.context.store,
      summary: format.context.output,
      transcript: format.context.transcript,
      criterion: "format",
      provider: "mock",
      model: "mock-summary-judge",
      transport: transport(format.verdict),
    })).toMatchObject({ ok: true, value: { score: 100, issues: [] } });
  });
});

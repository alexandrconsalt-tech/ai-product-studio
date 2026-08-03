import { describe, expect, it, vi } from "vitest";
import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import { createSummaryFixtureContext } from "../summary/fixtures";
import { executeSummaryJudgeV3 } from "./execute";
import {
  createJudgeFinding,
  createSummaryJudgeFixture,
  withJudgeFinding,
} from "./fixtures";

function successTransport(
  value: unknown | ((attempt: number) => unknown),
  requests: Parameters<StructuredProviderTransport>[0][] = [],
): StructuredProviderTransport {
  let attempt = 0;
  return async (request) => {
    attempt += 1;
    requests.push(request);
    const raw = typeof value === "function" ? value(attempt) : value;
    const candidate = raw && typeof raw === "object" && "criterion" in raw && "score" in raw
      ? raw as { score: number | null; verdict: string; issues?: { code: string; severity: string; message: string }[] }
      : null;
    const structuredValue = candidate ? {
      score: candidate.score ?? 0,
      decision: candidate.verdict === "pass" ? "PASS"
        : candidate.verdict === "warning" ? "NEEDS_REWORK"
          : candidate.verdict === "technical_error" ? "TECHNICAL_ERROR" : "FAIL",
      summary: "Controlled Judge result.",
      violations: (candidate.issues ?? []).map((item) => ({ code: item.code, severity: item.severity, description: item.message })),
    } : raw;
    return {
      ok: true,
      rawResponse: { request_id: `mock-${attempt}` },
      structuredValue,
      attestation: {
        requested: true,
        forwarded: true,
        accepted: true,
        structuredResponseReturned: true,
      },
    };
  };
}

async function executeFixture(
  criterion: (typeof SUMMARY_CRITERIA)[number],
  transport: StructuredProviderTransport,
  summary?: unknown,
) {
  const fixture = createSummaryJudgeFixture(criterion);
  return executeSummaryJudgeV3({
    manifest: fixture.context.manifest,
    conversationStore: fixture.context.store,
    summary: summary ?? fixture.context.output,
    transcript: fixture.context.transcript,
    criterion,
    provider: "mock",
    model: "mock-summary-judge",
    transport,
  });
}

describe("criterion-specific Structured Output execution", () => {
  it("executes all five contracts separately with their own visible prompt", async () => {
    for (const criterion of SUMMARY_CRITERIA) {
      const fixture = createSummaryJudgeFixture(criterion);
      const requests: Parameters<StructuredProviderTransport>[0][] = [];
      const result = await executeFixture(
        criterion,
        successTransport(fixture.verdict, requests),
      );
      expect(result).toMatchObject({
        ok: true,
        value: { criterion, score: 100, verdict: "pass" },
        diagnostic: {
          criterion,
          outputContractVersion: "3.1.0",
          structuredOutputRequested: true,
          structuredOutputApplied: true,
          attemptCount: 1,
          repairAttempted: false,
          validationStatus: "valid",
        },
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].prompt).toContain(`ONLY CRITERION: ${criterion}`);
      expect(requests[0].responseFormat.type).toBe("json_schema");
      expect(requests[0].responseFormat.json_schema.schema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["score", "decision", "summary", "violations"],
      });
    }
  });

  it("preserves warning, fail and technical_error as typed verdicts", async () => {
    const warningFixture = createSummaryJudgeFixture("format");
    const warning = withJudgeFinding(
      warningFixture.verdict,
      75,
      createJudgeFinding("format"),
    );
    expect(await executeFixture("format", successTransport(warning))).toMatchObject({
      ok: true,
      value: { score: 75, verdict: "warning" },
    });

    const failFixture = createSummaryJudgeFixture("completeness");
    const failed = withJudgeFinding(
      failFixture.verdict,
      50,
      createJudgeFinding("completeness"),
    );
    expect(await executeFixture("completeness", successTransport(failed))).toMatchObject({
      ok: true,
      value: { score: 50, verdict: "fail" },
    });

    const technicalFixture = createSummaryJudgeFixture("faithfulness");
    const technical = {
      ...technicalFixture.verdict,
      verdict: "technical_error",
      score: null,
      confidence: null,
    };
    expect(await executeFixture("faithfulness", successTransport(technical))).toMatchObject({
      ok: true,
      value: { score: null, confidence: null, verdict: "technical_error" },
      diagnostic: {
        errorType: "judge_technical_error",
        errorCode: "SUMMARY_JUDGE_TECHNICAL_ERROR",
      },
    });
  });

  it("allows one repair with the same schema and rejects the second invalid output", async () => {
    const fixture = createSummaryJudgeFixture("usefulness");
    const requests: Parameters<StructuredProviderTransport>[0][] = [];
    const repaired = await executeFixture(
      "usefulness",
      successTransport(
        (attempt: number) => attempt === 1 ? { criterion: "usefulness" } : fixture.verdict,
        requests,
      ),
    );
    expect(repaired).toMatchObject({
      ok: true,
      diagnostic: { attemptCount: 2, repairAttempted: true },
    });
    expect(requests[1].responseFormat).toEqual(requests[0].responseFormat);

    const failedRequests: Parameters<StructuredProviderTransport>[0][] = [];
    const failed = await executeFixture(
      "usefulness",
      successTransport({ criterion: "usefulness" }, failedRequests),
    );
    expect(failed).toMatchObject({
      ok: false,
      error: { errorCode: "SUMMARY_JUDGE_SCHEMA_MISMATCH" },
      diagnostic: {
        attemptCount: 2,
        repairAttempted: true,
        rawProviderResponse: { request_id: "mock-2" },
      },
    });
    expect(failedRequests).toHaveLength(2);
  });

  it("rejects legacy markdown and never enables text fallback", async () => {
    let calls = 0;
    const result = await executeFixture("format", async () => {
      calls += 1;
      return {
        ok: true,
        rawResponse: {},
        rawText: "```json\n{\"criterion\":\"format\"}\n```",
        attestation: {
          requested: true,
          forwarded: true,
          accepted: true,
          structuredResponseReturned: true,
        },
      };
    });
    expect(result).toMatchObject({
      ok: false,
      error: { errorCode: "SUMMARY_JUDGE_SCHEMA_MISMATCH" },
    });
    expect(calls).toBe(2);
  });

  it("maps provider failure and thrown transport to technical errors", async () => {
    const providerFailure = await executeFixture("faithfulness", async () => ({
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message: "controlled failure",
      attestation: {
        requested: true,
        forwarded: true,
        accepted: false,
        structuredResponseReturned: false,
      },
    }));
    expect(providerFailure).toMatchObject({
      ok: false,
      disposition: "TECHNICAL_ERROR",
      error: { errorCode: "PROVIDER_ERROR" },
    });

    const thrown = await executeFixture("faithfulness", async () => {
      throw new Error("transport exception");
    });
    expect(thrown).toMatchObject({
      ok: false,
      error: { errorCode: "SUMMARY_JUDGE_PROVIDER_ERROR" },
    });
  });

  it("does not call a provider when Summary is missing or technical", async () => {
    const fixture = createSummaryFixtureContext();
    const transport = vi.fn<StructuredProviderTransport>();
    for (const summary of [null, { status: "technical_error" }]) {
      const result = await executeSummaryJudgeV3({
        manifest: fixture.manifest,
        conversationStore: fixture.store,
        summary,
        transcript: fixture.transcript,
        criterion: "faithfulness",
        provider: "mock",
        model: "mock-summary-judge",
        transport,
      });
      expect(result).toMatchObject({ ok: false, disposition: "NOT_RUN" });
    }
    expect(transport).not.toHaveBeenCalled();
  });
});

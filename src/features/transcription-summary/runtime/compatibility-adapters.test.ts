import { describe, expect, it } from "vitest";
import {
  DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES,
  DeprecatedSummaryJudgeV3_0Schema,
} from "../contracts/summary-judges/v3/contract";
import {
  adaptSummaryJudgeToQualityGateV1,
} from "./compatibility-adapters";

describe("temporary compatibility adapters", () => {
  it("maps all five Summary Judge envelopes without a parser", () => {
    for (const criterion of Object.keys(DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES) as Array<keyof typeof DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES>) {
      const judge = DeprecatedSummaryJudgeV3_0Schema.parse({
        criterion,
        verdict: "pass",
        score: 100,
        confidence: 1,
        issues: [],
        evidence: [],
        payload: DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES[criterion],
      });
      expect(adaptSummaryJudgeToQualityGateV1(judge)).toMatchObject({ ok: true, log: { lossy: false } });
    }
  });
});

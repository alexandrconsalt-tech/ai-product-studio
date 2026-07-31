import { SUMMARY_CRITERIA } from "../contracts/canonical-enums";
import {
  SUMMARY_JUDGE_PAYLOAD_FIXTURES,
  SummaryJudgeV3Schema,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";
import { createSummaryFixtureContext } from "../summary/fixtures";
import { calculateSummaryContentHash } from "../summary-judges/input-builder";

export function createSummaryQualityGateFixture(
  scores: Partial<Record<(typeof SUMMARY_CRITERIA)[number], 0 | 25 | 50 | 75 | 100 | null>> = {},
) {
  const context = createSummaryFixtureContext();
  const summaryHash = calculateSummaryContentHash(context.output);
  const verdicts = SUMMARY_CRITERIA.map((criterion) => {
    const score = scores[criterion] === undefined ? 100 : scores[criterion];
    const verdict = score === null
      ? "technical_error"
      : score === 100
        ? "pass"
        : score === 75
          ? "warning"
          : "fail";
    return SummaryJudgeV3Schema.parse({
      criterion,
      verdict,
      score,
      confidence: score === null ? null : 0.9,
      issues: [],
      evidence: [],
      payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES[criterion],
      metadata: {
        sourceStoreId: context.store.meta.store_id,
        sourceStoreHash: context.store.content_hash,
        sourceSummaryHash: summaryHash,
        contractVersion: "3.1.0",
        promptVersion: `summary-judge-${criterion}-v3.0.0`,
      },
    });
  });
  return {
    manifest: context.manifest,
    conversationStore: context.store,
    summary: context.output,
    verdicts,
  };
}

export function replaceVerdict(
  verdicts: readonly SummaryJudgeV3[],
  criterion: (typeof SUMMARY_CRITERIA)[number],
  update: (verdict: SummaryJudgeV3) => unknown,
): unknown[] {
  return verdicts.map((verdict) =>
    verdict.criterion === criterion ? update(verdict) : verdict
  );
}

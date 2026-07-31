import type { SummaryCriterionV3 } from "../contracts/summary-judge-input/v3/contract";
import {
  SUMMARY_JUDGE_PAYLOAD_FIXTURES,
  SummaryJudgeV3Schema,
  type SummaryJudgeFindingV3,
  type SummaryJudgeV3,
} from "../contracts/summary-judges/v3/contract";
import { createSummaryFixtureContext } from "../summary/fixtures";
import { buildSummaryJudgeInput } from "./input-builder";
import { SUMMARY_JUDGE_PROMPTS } from "./prompt-builders";

export function createJudgeFinding(
  criterion: SummaryCriterionV3,
  overrides: Partial<SummaryJudgeFindingV3> = {},
): SummaryJudgeFindingV3 {
  const codes = {
    faithfulness: "unsupported_claim",
    completeness: "missing_goal",
    usefulness: "agent_blocking_omission",
    agreements_next_step: "incorrect_owner",
    format: "semantic_repetition",
  } as const;
  return {
    code: codes[criterion],
    severity: "medium",
    message: "Controlled Judge finding.",
    ...overrides,
  };
}

export function createSummaryJudgeFixture(criterion: SummaryCriterionV3): {
  context: ReturnType<typeof createSummaryFixtureContext>;
  input: Extract<ReturnType<typeof buildSummaryJudgeInput>, { ok: true }>["value"];
  verdict: SummaryJudgeV3;
} {
  const context = createSummaryFixtureContext();
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
    payload: SUMMARY_JUDGE_PAYLOAD_FIXTURES[criterion],
    metadata: {
      sourceStoreId: built.value.meta.storeId,
      sourceStoreHash: built.value.meta.storeContentHash,
      sourceSummaryHash: built.value.meta.summaryHash,
      contractVersion: "3.1.0",
      promptVersion: built.value.meta.judgePromptVersion,
    },
  });
  return { context, input: built.value, verdict };
}

export function withJudgeFinding(
  verdict: SummaryJudgeV3,
  score: 75 | 50 | 25 | 0,
  finding: SummaryJudgeFindingV3,
): SummaryJudgeV3 {
  return {
    ...verdict,
    verdict: score === 75 ? "warning" : "fail",
    score,
    issues: [finding],
  } as SummaryJudgeV3;
}

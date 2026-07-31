import { writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { FactsV3Contract, type FactsV3 } from "../contracts/facts/v3/contract";
import { NeedsV3Contract, type NeedsV3 } from "../contracts/needs/v3/contract";
import { OutcomeV3Contract, type OutcomeV3 } from "../contracts/outcome/v3/contract";
import {
  DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES,
  DeprecatedSummaryJudgeV3_0Contract,
  type DeprecatedSummaryJudgeV3_0,
} from "../contracts/summary-judges/v3/contract";
import {
  PHASE_2A_DEFAULT_MODEL,
  runControlledOpenAiAcceptance,
  type ProviderAcceptanceDiagnostic,
} from "./openai-controlled-adapter";

const apiKey = process.env.OPENAI_API_KEY;
const integrationDescribe = apiKey ? describe : describe.skip;
const model = process.env.PHASE2A_OPENAI_MODEL || PHASE_2A_DEFAULT_MODEL;
const diagnostics: ProviderAcceptanceDiagnostic[] = [];

async function accept<T>(contract: Parameters<typeof runControlledOpenAiAcceptance>[0]["contract"], prompt: string): Promise<T> {
  const result = await runControlledOpenAiAcceptance({
    apiKey: apiKey ?? "",
    contract,
    prompt,
    model,
    allowRepair: true,
  });
  diagnostics.push(result.diagnostic);
  expect(result.ok, result.ok ? undefined : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value as T;
}

integrationDescribe.sequential("Phase 2A real OpenAI provider acceptance", () => {
  afterAll(() => {
    const outputPath = process.env.PHASE2A_DIAGNOSTIC_OUTPUT || "/tmp/transcription-summary-phase2a-provider-acceptance.json";
    writeFileSync(outputPath, `${JSON.stringify({ model, diagnostics }, null, 2)}\n`, { mode: 0o600 });
  });

  it("accepts Registry schemas for four contracts and two Summary criteria", async () => {
    const facts = await accept<FactsV3>(FactsV3Contract, [
      "Return facts.agent.output.v3 for this synthetic source.",
      "Source turn-1, client: «Там переуступка?»",
      "The utterance is a client question. Do not assert that assignment sale is a confirmed fact.",
    ].join("\n"));
    expect(facts.client_questions.some((item) => item.question.includes("переуступка"))).toBe(true);
    expect(facts.confirmed_facts.some((item) => item.value.toLowerCase().includes("переуступ"))).toBe(false);

    const needs = await accept<NeedsV3>(NeedsV3Contract, [
      "Return needs.agent.output.v3 for this synthetic source.",
      "Source turn-1, client: «Покупаю за наличные».",
      "Use canonical Registry values. Other required CRM fields may be 'не определено' where the schema permits.",
    ].join("\n"));
    expect(needs.structured_crm_attributes.funding_source.value).toBe("наличные / депозит");

    const outcome = await accept<OutcomeV3>(OutcomeV3Contract, [
      "Return outcome.agent.output.v3 for this synthetic source.",
      "Source turn-1, agent: «Сегодня отправлю планировку клиенту по электронной почте».",
      "Represent the call result, agreement, primary next step, unresolved questions, and communication channel.",
    ].join("\n"));
    expect(outcome.agreements.length).toBeGreaterThan(0);
    expect(outcome.primary_next_step.channel?.toLowerCase()).toMatch(/mail|почт/);
    expect(outcome).not.toHaveProperty("call_results");
    expect(outcome.agreements[0]).not.toHaveProperty("agreement_id");
    expect(outcome.agreements[0]).not.toHaveProperty("text");

    for (const criterion of ["faithfulness", "format"] as const) {
      const judge = await accept<DeprecatedSummaryJudgeV3_0>(DeprecatedSummaryJudgeV3_0Contract, [
        `Return summary.judge.verdict.v3 for criterion=${criterion}.`,
        "Synthetic verified source: client buys with cash; agent will email a floor plan today.",
        "Synthetic summary: «Клиент покупает за наличные. Агент сегодня отправит планировку по электронной почте.»",
        `The payload criterion must be ${criterion}.`,
        `Expected payload shape example: ${JSON.stringify(DEPRECATED_SUMMARY_JUDGE_PAYLOAD_FIXTURES[criterion])}`,
      ].join("\n"));
      expect(judge.criterion).toBe(criterion);
      expect(judge.payload.criterion).toBe(criterion);
    }

    expect(diagnostics).toHaveLength(5);
    expect(diagnostics.every((item) => item.providerAcceptedRequest && item.zodValidationPassed)).toBe(true);
  }, 180_000);
});

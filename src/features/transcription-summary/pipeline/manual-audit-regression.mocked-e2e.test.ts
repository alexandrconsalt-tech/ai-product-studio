import { describe, expect, it } from "vitest";
import type { ContractRole } from "../contracts/contract-types";
import { createSummaryFixtureContext } from "../summary/fixtures";
import { executeTranscriptionSummaryV3Pipeline } from "./execute";
import type {
  PipelineExecutionContext,
  PipelineStageExecution,
  TranscriptionSummaryV3StageExecutor,
  TranscriptionSummaryV3StageId,
} from "./types";

const ROLE_BY_STAGE: Readonly<Record<Exclude<TranscriptionSummaryV3StageId, "transcript_validation">, ContractRole>> = {
  facts_agent: "facts",
  needs_agent: "needs",
  outcome_agent: "outcome",
  conversation_store: "conversationStore",
  summary_agent: "summary",
  summary_judge_faithfulness: "summaryJudges",
  summary_judge_completeness: "summaryJudges",
  summary_judge_usefulness: "summaryJudges",
  summary_judge_agreements_next_step: "summaryJudges",
  summary_judge_format: "summaryJudges",
  quality_gate: "qualityGate",
  crm_publication: "crmPublicationResult",
};

const LLM_STAGES = new Set<TranscriptionSummaryV3StageId>([
  "facts_agent",
  "needs_agent",
  "outcome_agent",
  "summary_agent",
  "summary_judge_faithfulness",
  "summary_judge_completeness",
  "summary_judge_usefulness",
  "summary_judge_agreements_next_step",
  "summary_judge_format",
]);

class ManualAuditRegressionExecutor implements TranscriptionSummaryV3StageExecutor {
  constructor(readonly caseId: string) {}

  async execute(
    stageId: Exclude<TranscriptionSummaryV3StageId, "transcript_validation">,
    context: PipelineExecutionContext,
  ): Promise<PipelineStageExecution> {
    const reference = context.manifest.contracts[ROLE_BY_STAGE[stageId]];
    const isLlm = LLM_STAGES.has(stageId);
    const audit = {
      contractId: reference.id,
      contractVersion: reference.version,
      schemaHash: reference.schemaHash,
      promptId: isLlm ? `${stageId}-v3.1.0` : null,
      promptVersion: isLlm ? `${stageId}-v3.1.0` : null,
      promptHash: isLlm ? "b".repeat(64) : null,
      basePrompt: isLlm ? "registered v3 prompt" : null,
      resolvedPrompt: isLlm ? "registered v3 prompt and input" : null,
      provider: isLlm ? "openai-direct" : null,
      model: isLlm ? "gpt-5-mini-2025-08-07" : null,
      structuredOutputRequired: isLlm,
      structuredOutputRequested: isLlm,
      structuredOutputApplied: isLlm,
      attempts: isLlm ? 1 : 0,
      validationStatus: "valid" as const,
      blocking: false,
    };
    if (stageId === "needs_agent") {
      return {
        status: "SUCCESS",
        value: this.caseId.includes("alexandra")
          ? {
              funding_source: "деньги на счету",
              purchase_context: "родители покупают квартиру",
            }
          : {
              current_property: "продажа собственной квартиры",
              purchase_context: "переезд",
              preferred_area: "около 46 м²",
            },
        audit,
      };
    }
    if (stageId === "outcome_agent") {
      return {
        status: "SUCCESS",
        value: this.caseId.includes("alexandra")
          ? {
              contract: "outcome.agent.output.v3@3.0.0",
              primary_next_step: "агент свяжется вечером",
              appointed_showing: false,
            }
          : {
              contract: "outcome.agent.output.v3@3.0.0",
              client_questions: ["задвоенное объявление", "рост цены"],
              primary_next_step: "агент уточнит ситуацию и перезвонит",
            },
        audit,
      };
    }
    if (stageId === "conversation_store") {
      return { status: "SUCCESS", value: { complete: true, caseId: this.caseId }, audit };
    }
    if (stageId === "summary_agent") {
      return {
        status: "SUCCESS",
        value: this.caseId.includes("alexandra")
          ? {
              conversation_result: "Александра обсуждает покупку квартиры для родителей.",
              key_facts: [{ label: "Оплата", value: "деньги находятся на счету" }],
              quotes: [],
              next_step: "Агент свяжется вечером.",
            }
          : {
              conversation_result: "Снежана продаёт свою квартиру и планирует переезд.",
              key_facts: [
                { label: "Площадь", value: "предпочтительно около 46 м²" },
                { label: "Вопросы", value: "задвоенное объявление и рост цены" },
              ],
              quotes: [],
              next_step: "Агент уточнит ситуацию и перезвонит.",
            },
        audit,
      };
    }
    if (stageId.startsWith("summary_judge_")) {
      return {
        status: "SUCCESS",
        value: { criterion: stageId.replace("summary_judge_", ""), verdict: "pass", score: 100 },
        audit: { ...audit, score: 100, confidence: 1 },
      };
    }
    if (stageId === "quality_gate") {
      return {
        status: "SUCCESS",
        value: { decision: "QUALITY_RECORDED", blocking: false, qualityScore: 100 },
        audit: { ...audit, score: 100 },
      };
    }
    if (stageId === "crm_publication") {
      return { status: "SUCCESS", value: { status: "SAVED", summarySaved: true }, audit };
    }
    return { status: "SUCCESS", value: { caseId: this.caseId, stageId }, audit };
  }
}

describe("manual audit regressions — full mocked v3 pipeline", () => {
  it.each([
    "alexandra_cash_on_account_parents_purchase_evening_follow_up",
    "snezhana_sale_move_46sqm_duplicate_listing_price_growth_follow_up",
  ])("%s reaches Store, Summary, five Judges, Gate and CRM DRY_RUN", async (caseId) => {
    const result = await executeTranscriptionSummaryV3Pipeline({
      transcript: createSummaryFixtureContext().transcript,
      executor: new ManualAuditRegressionExecutor(caseId),
      runId: `run-${caseId}`,
      now: () => new Date("2026-07-30T18:00:00.000Z"),
    });
    expect(result.report.stages).toHaveLength(13);
    expect(result.report.stages.every((stage) => stage.status === "SUCCESS")).toBe(true);
    expect(result.outputs.conversation_store).toMatchObject({ complete: true });
    expect(result.outputs.summary_agent).toBeTruthy();
    if (caseId.includes("alexandra")) {
      expect(result.outputs.summary_agent).toMatchObject({
        conversation_result: expect.stringContaining("Александра"),
        next_step: "Агент свяжется вечером.",
      });
    } else {
      expect(result.outputs.summary_agent).toMatchObject({
        conversation_result: expect.stringContaining("Снежана"),
        next_step: "Агент уточнит ситуацию и перезвонит.",
      });
    }
    expect(result.report.stages.filter((stage) => stage.stage_id.startsWith("summary_judge_"))).toHaveLength(5);
    expect(result.report.quality_decision).toBe("QUALITY_RECORDED");
    expect(result.report.crm_status).toBe("SAVED");
    expect(result.outputs.crm_publication).toMatchObject({ summarySaved: true });
    expect(result.report.stages.filter((stage) =>
      LLM_STAGES.has(stage.stage_id as TranscriptionSummaryV3StageId)
    ).every((stage) =>
      stage.provider === "openai-direct"
      && stage.structured_output.requested
      && stage.structured_output.applied
    )).toBe(true);
  });
});

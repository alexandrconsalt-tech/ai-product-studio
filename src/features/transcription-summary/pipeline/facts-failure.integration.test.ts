import { describe, expect, it } from "vitest";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import { OutcomeV3Contract } from "../contracts/outcome/v3/contract";
import { InMemoryCrmPublicationRepositoryV3 } from "../crm-publication";
import type { StructuredProviderTransport } from "../runtime/structured-output";
import { executeTranscriptionSummaryV3Pipeline } from "./execute";
import { RuntimeTranscriptionSummaryV3StageExecutor } from "./runtime-executor";

const transcript = {
  transcript_id: "facts-final-failure",
  turns: [
    { id: "turn-1", sequence: 0, speaker: "client", text: "Ищу квартиру, деньги на счёте.", started_at_ms: null, ended_at_ms: null },
    { id: "turn-2", sequence: 1, speaker: "agent", text: "Завтра перезвоню.", started_at_ms: null, ended_at_ms: null },
  ],
  metadata: {},
  validation_warnings: [],
};

describe("typed v3 fail-closed when Facts are unavailable", () => {
  it("возвращает diagnostic preview, технический Gate и не запускает CRM", async () => {
    let factsCalls = 0;
    const llmStages: string[] = [];
    const transport: StructuredProviderTransport = async (request) => {
      llmStages.push(request.schemaId);
      if (request.schemaId === FactsV3Contract.id) {
        factsCalls += 1;
        return {
          ok: false,
          errorCode: "OPENAI_TIMEOUT",
          message: "controlled facts timeout",
          attestation: { requested: true, forwarded: true, accepted: false, structuredResponseReturned: false },
        };
      }
      const structuredValue = request.schemaId === NeedsV3Contract.id
        ? NeedsV3Contract.fixtures.valid
        : request.schemaId === OutcomeV3Contract.id
          ? OutcomeV3Contract.fixtures.valid
          : null;
      if (structuredValue === null) throw new Error(`Unexpected semantic LLM call: ${request.schemaId}`);
      return {
        ok: true,
        structuredValue,
        rawResponse: { id: `controlled-${request.schemaId}` },
        attestation: { requested: true, forwarded: true, accepted: true, structuredResponseReturned: true },
      };
    };
    const executor = new RuntimeTranscriptionSummaryV3StageExecutor({
      provider: "openai-direct",
      models: { default: "gpt-5-mini" },
      transport,
      crmRepository: new InMemoryCrmPublicationRepositoryV3(),
      crmClient: { async publishSummary() { throw new Error("CRM must not run"); } },
    });

    const result = await executeTranscriptionSummaryV3Pipeline({
      transcript,
      runId: "run-facts-final-failure",
      executor,
    });

    expect(factsCalls).toBe(2);
    expect(llmStages).toEqual([
      FactsV3Contract.id,
      FactsV3Contract.id,
      NeedsV3Contract.id,
      OutcomeV3Contract.id,
    ]);
    expect(result.outputs.summary_agent).toMatchObject({
      conversation_result: expect.stringContaining("Диагностический preview"),
      key_facts: [],
    });
    expect(result.outputs.quality_gate).toMatchObject({
      evaluationStatus: "partial",
      decision: "TECHNICAL_ERROR",
      blocking: true,
      qualityScore: null,
    });
    expect(result.report).toMatchObject({
      status: "TECHNICAL_ERROR",
      quality_score: null,
      quality_decision: "TECHNICAL_ERROR",
      degraded_sources: ["facts"],
      semantic_evaluation_allowed: false,
      quality_score_valid: false,
      crm_status: "NOT_RUN",
    });
    expect(result.report.stages.filter((stage) => stage.stage_id.startsWith("summary_judge_"))).toSatisfy(
      (stages: typeof result.report.stages) => stages.every((stage) => stage.status === "TECHNICAL_ERROR" && stage.score === null),
    );
    expect(result.report.stages.find((stage) => stage.stage_id === "crm_publication")?.status).toBe("NOT_RUN");
  });
});

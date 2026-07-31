import { describe, expect, it } from "vitest";
import { createContractManifest } from "../contracts/manifest";
import { AI_SUMMARY_V3_PIPELINE_VERSION } from "../contracts/constants";
import { TranscriptV3Schema } from "../contracts/transcript/v3/contract";
import { InMemoryCrmPublicationRepositoryV3 } from "../crm-publication";
import { FactsV3Contract } from "../contracts/facts/v3/contract";
import { NeedsV3Contract } from "../contracts/needs/v3/contract";
import type { PipelineExecutionContext } from "./types";
import { RuntimeTranscriptionSummaryV3StageExecutor } from "./runtime-executor";

function context(outputs: PipelineExecutionContext["outputs"]): PipelineExecutionContext {
  const transcript = TranscriptV3Schema.parse({
    transcript_id: "transcript-runtime-executor-test",
    turns: [
      { id: "turn-1", sequence: 1, speaker: "client", text: "Деньги на счету.", started_at_ms: null, ended_at_ms: null },
    ],
    metadata: { run_id: "run-runtime-executor-test", sha256: "a".repeat(64) },
    validation_warnings: [],
  });
  return {
    runId: "run-runtime-executor-test",
    transcript,
    transcriptHash: "a".repeat(64),
    manifest: createContractManifest(AI_SUMMARY_V3_PIPELINE_VERSION),
    outputs,
  };
}

function executor(prompts: string[]) {
  return new RuntimeTranscriptionSummaryV3StageExecutor({
    provider: "openai-direct",
    models: { default: "gpt-5-mini" },
    transport: async (request) => {
      prompts.push(request.prompt);
      return {
        ok: false,
        errorCode: "PROVIDER_ERROR",
        message: "controlled",
        attestation: {
          requested: true,
          forwarded: true,
          accepted: false,
          structuredResponseReturned: false,
        },
      };
    },
    crmRepository: new InMemoryCrmPublicationRepositoryV3(),
    crmClient: { async publishSummary() { throw new Error("must not run"); } },
  });
}

describe("v3 runtime executor dependencies", () => {
  it("разрешает только Direct OpenAI", () => {
    expect(() => new RuntimeTranscriptionSummaryV3StageExecutor({
      provider: "ai-tunnel",
      models: {},
      transport: async () => { throw new Error("must not run"); },
      crmRepository: new InMemoryCrmPublicationRepositoryV3(),
      crmClient: { async publishSummary() { throw new Error("must not run"); } },
    })).toThrow("V3_RUNTIME_CONFIGURATION_MISMATCH");
  });

  it("Need Agent получает raw facts и не ожидает Fact Judge", async () => {
    const prompts: string[] = [];
    await executor(prompts).execute("needs_agent", context({
      facts_agent: FactsV3Contract.validator.parse(FactsV3Contract.fixtures.valid),
    }));
    expect(prompts[0]).toContain('"facts"');
    expect(prompts[0]).toContain("Не ожидай fact_check");
    expect(prompts[0]).not.toContain("facts_verified");
  });

  it("Outcome Agent получает raw facts, needs и точный объектный контракт", async () => {
    const prompts: string[] = [];
    await executor(prompts).execute("outcome_agent", context({
      facts_agent: FactsV3Contract.validator.parse(FactsV3Contract.fixtures.valid),
      needs_agent: NeedsV3Contract.validator.parse(NeedsV3Contract.fixtures.valid),
    }));
    expect(prompts[0]).toContain('"facts"');
    expect(prompts[0]).toContain('"needs"');
    expect(prompts[0]).toContain("call_results всегда массив объектов");
    expect(prompts[0]).not.toContain("facts_verified");
    expect(prompts[0]).not.toContain("needs_verified");
  });
});

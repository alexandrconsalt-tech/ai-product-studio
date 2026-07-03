import { describe, expect, it } from "vitest";
import { createModel } from "@/entities/Model/model/factory";
import { createNode } from "@/entities/Node/model/factory";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import type { LLMProvider } from "@/shared/llm/types";
import { emptyPromptRegistry } from "@/shared/prompts/prompt-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { createRealStageHandlers, realStageRegistry, type RealStageDependencies } from "./real-stage";
import type { ExecutionContext } from "./types";

function context(): ExecutionContext {
  return { runId: "run_1", pipelineId: "pipeline_1", variables: new Map() };
}

function deps(overrides: Partial<RealStageDependencies> = {}): RealStageDependencies {
  return {
    llmProviders: defaultLLMProviderRegistry,
    prompts: seededPromptRegistry,
    models: [createModel({ id: "model_reasoning", name: "gpt-4o-mini", provider: "local" })],
    ...overrides,
  };
}

describe("createRealStageHandlers", () => {
  it("covers all 10 NodeTypes", () => {
    const handlers = createRealStageHandlers(deps());
    for (const type of ["agent", "llm", "function", "router", "tool", "store", "validation", "human_review", "input", "output"] as const) {
      expect(handlers[type]).toBeTypeOf("function");
    }
  });

  it("input/output/store/router/function are deterministic passthroughs, same as Mock Stage for these types", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "function", name: "x" });
    const result = await handlers.function({ node, payload: "unchanged", context: context() });
    expect(result.payload).toBe("unchanged");
  });

  it("llm renders the seeded prompt_call_summary template and calls the (mock) LLM provider", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "llm", name: "Call Analyzer", promptId: "prompt_call_summary", modelId: "model_reasoning", temperature: 0.3 });
    const result = await handlers.llm({ node, payload: { transcript: "Хочу трёхкомнатную квартиру, бюджет 12 млн." }, context: context() });

    expect(result.metrics?.map((m) => m.name)).toEqual(expect.arrayContaining(["tokens", "cost", "latency", "confidence"]));
    expect(typeof result.payload).toBe("object");
  });

  it("throws a clear error when an llm node has no promptId", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "llm", name: "No Prompt" });
    await expect(handlers.llm({ node, payload: { transcript: "x" }, context: context() })).rejects.toThrow(/promptId/);
  });

  it("agent uses the same LLM-calling path as llm", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "agent", name: "Agent", promptId: "prompt_call_summary", modelId: "model_reasoning" });
    const result = await handlers.agent({ node, payload: { transcript: "x" }, context: context() });
    expect(result.metrics?.some((m) => m.name === "tokens")).toBe(true);
  });

  it("validation actually validates a CallAnalysisSummary-shaped payload and extracts evidence from цитаты", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "validation", name: "Validator" });
    const validSummary = {
      кто: "Клиент",
      тип_контакта: "agent",
      потребность: "Трёхкомнатная квартира",
      вопросы: [],
      статус: "in_progress",
      действие: "Перезвонить завтра",
      цитаты: ["Хочу трёхкомнатную квартиру"],
    };
    const result = await handlers.validation({ node, payload: validSummary, context: context() });
    expect(result.payload).toMatchObject({ validated: true });
    expect(result.evidence).toEqual(["Хочу трёхкомнатную квартиру"]);
  });

  it("validation marks an invalid payload as not validated rather than throwing", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "validation", name: "Validator" });
    const result = await handlers.validation({ node, payload: { incomplete: true }, context: context() });
    expect(result.payload).toMatchObject({ validated: false });
  });

  it("human_review auto-approves but is explicitly labeled as not a real reviewer", async () => {
    const handlers = createRealStageHandlers(deps());
    const node = createNode({ type: "human_review", name: "Review" });
    const result = await handlers.human_review({ node, payload: {}, context: context() });
    const payload = result.payload as { reviewed: boolean; reviewedBy: string };
    expect(payload.reviewed).toBe(true);
    expect(payload.reviewedBy).toMatch(/auto-approved/);
  });

  it("resolves the LLMProvider via the node's modelId and the Model catalog's provider field", async () => {
    let capturedModel: string | undefined;
    const spyProvider: LLMProvider = {
      name: "spy",
      complete: async (request) => {
        capturedModel = request.model;
        return { content: "{}", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, latencyMs: 1, model: request.model, finishReason: "stop" };
      },
    };
    const registry = defaultLLMProviderRegistry.withProvider("openai", spyProvider);
    const handlers = createRealStageHandlers(
      deps({ llmProviders: registry, models: [createModel({ id: "model_openai", name: "gpt-4o", provider: "openai" })] }),
    );
    const node = createNode({ type: "llm", name: "x", promptId: "prompt_call_summary", modelId: "model_openai" });
    await handlers.llm({ node, payload: { transcript: "x" }, context: context() });
    expect(capturedModel).toBe("gpt-4o");
  });
});

describe("realStageRegistry", () => {
  it("builds a full StageRegistry usable by executePipeline", async () => {
    const registry = realStageRegistry(deps({ prompts: emptyPromptRegistry }));
    const node = createNode({ type: "input", name: "x" });
    const result = await registry.get("input")({ node, payload: "hello", context: context() });
    expect(result.payload).toBe("hello");
  });
});

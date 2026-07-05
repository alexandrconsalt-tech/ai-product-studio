import type { NodeType } from "@/entities/Node/model/types";
import { confidenceFromTemperature } from "@/shared/model/confidence";
import type { StageHandler, StageInput, StageOutput } from "./types";

/**
 * Mock Stage handlers -- deterministic, synchronous-fast, and never
 * call a real LLM or external service. They exist so the Pipeline
 * Executor can be built, tested, and exercised end-to-end before any
 * real model integration exists. Every handler here MUST stay
 * obviously fake: no network calls, no provider SDKs, no attempt to
 * look "real". Replacing a given NodeType's mock with a real
 * implementation is a StageRegistry.register() call away, not a
 * change to the executor.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? { ...(payload as Record<string, unknown>) } : { value: payload };
}

async function passthrough({ payload }: StageInput): Promise<StageOutput> {
  return { payload };
}

async function mockLlm({ node, payload }: StageInput): Promise<StageOutput> {
  const confidence = confidenceFromTemperature(node.temperature);
  return {
    payload: {
      ...asRecord(payload),
      confidence,
      mock: true,
      producedBy: node.id,
    },
    metrics: [{ name: "mock_confidence", value: confidence }],
  };
}

async function mockTool({ node, payload }: StageInput): Promise<StageOutput> {
  return { payload: { ...asRecord(payload), toolResult: `mock-result-from-${node.id}` } };
}

async function mockValidation({ payload }: StageInput): Promise<StageOutput> {
  const record = asRecord(payload);
  const confidence = typeof record.confidence === "number" ? record.confidence : confidenceFromTemperature(undefined);
  return { payload: { ...record, confidence, validated: true } };
}

async function mockHumanReview({ node, payload }: StageInput): Promise<StageOutput> {
  // A Mock Stage cannot involve an actual human. It auto-approves so
  // downstream execution can proceed, but marks the payload so this
  // is never mistaken for a real review decision.
  return { payload: { ...asRecord(payload), reviewed: true, reviewedBy: "mock", reviewNodeId: node.id } };
}

/**
 * Merges a fan-in array payload's object fields into one flat record
 * (mirrors real-stage.ts's `asRecord`, kept separate rather than
 * shared since each module's `asRecord` intentionally has different
 * behavior for the non-store handlers here). A `store` node's whole
 * purpose is to hold merged context for downstream stages -- the
 * default `asRecord` above wraps an array wholesale in `{value:[...]}}`,
 * which would leave a store fed by more than one incoming edge unable
 * to actually merge its sources.
 */
function mergeForStore(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) {
    return payload.reduce<Record<string, unknown>>((merged, item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) return { ...merged, ...item };
      return merged;
    }, {});
  }
  return asRecord(payload);
}

async function mockStore({ node, payload }: StageInput): Promise<StageOutput> {
  return { payload: { ...mergeForStore(payload), stored: true, storeNodeId: node.id } };
}

export const mockStageHandlers: Readonly<Record<NodeType, StageHandler>> = {
  input: passthrough,
  output: passthrough,
  agent: passthrough,
  function: passthrough,
  router: passthrough,
  llm: mockLlm,
  tool: mockTool,
  validation: mockValidation,
  human_review: mockHumanReview,
  store: mockStore,
};

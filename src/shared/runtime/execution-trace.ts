import type { NodeType } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { RunMetric, RunStatus } from "@/entities/Run/model/types";
import type { ExecutionEvent } from "./types";

/**
 * Reconstructs a full per-stage execution trace from the
 * `ExecutionEvent` stream `executePipeline` already emits (§8.1.1) --
 * this is a pure, additive read of data the Runtime already produces,
 * not a change to how it executes. Powers the Execution Inspector.
 */

export type StageTraceStatus = "succeeded" | "failed" | "skipped" | "pending";

export type StageTrace = Readonly<{
  nodeId: string;
  name: string;
  type: NodeType;
  status: StageTraceStatus;
  startedAt?: string;
  durationMs?: number;
  retryCount: number;
  input?: unknown;
  output?: unknown;
  metrics: readonly RunMetric[];
  evidence: readonly string[];
  error?: string;
  promptId?: string;
  modelId?: string;
  temperature?: number;
}>;

export type ExecutionTrace = Readonly<{
  runId: string;
  pipelineId: string;
  status: RunStatus;
  stages: readonly StageTrace[];
}>;

function metric(metrics: readonly RunMetric[], name: string): number | undefined {
  return metrics.find((m) => m.name === name)?.value;
}

export function buildExecutionTrace(pipeline: Pipeline, events: readonly ExecutionEvent[]): ExecutionTrace {
  const nodeById = new Map(pipeline.nodes.map((node) => [node.id, node]));
  const startedOrder: string[] = [];
  const retryCounts = new Map<string, number>();
  const partial = new Map<string, Partial<StageTrace> & { nodeId: string }>();

  for (const event of events) {
    if (!event.nodeId) continue;
    const node = nodeById.get(event.nodeId);
    if (!node) continue;

    const existing = partial.get(event.nodeId) ?? { nodeId: event.nodeId };

    switch (event.type) {
      case "stage_started":
        if (!startedOrder.includes(event.nodeId)) startedOrder.push(event.nodeId);
        partial.set(event.nodeId, { ...existing, startedAt: event.timestamp, input: event.inputPayload, status: "pending" });
        break;
      case "stage_retrying":
        retryCounts.set(event.nodeId, (retryCounts.get(event.nodeId) ?? 0) + 1);
        break;
      case "stage_completed":
        partial.set(event.nodeId, {
          ...existing,
          status: "succeeded",
          output: event.payload,
          metrics: event.metrics ?? [],
          evidence: event.evidence ?? [],
          durationMs: event.durationMs,
        });
        break;
      case "stage_failed":
        partial.set(event.nodeId, { ...existing, status: "failed", error: event.error, durationMs: event.durationMs });
        break;
      case "stage_skipped":
        if (!startedOrder.includes(event.nodeId)) startedOrder.push(event.nodeId);
        partial.set(event.nodeId, { ...existing, status: "skipped" });
        break;
      default:
        break;
    }
  }

  const orderedIds = [...startedOrder, ...pipeline.nodes.map((node) => node.id).filter((id) => !startedOrder.includes(id))];

  const stages: StageTrace[] = orderedIds.map((nodeId) => {
    const node = nodeById.get(nodeId);
    const data = partial.get(nodeId);
    return {
      nodeId,
      name: node?.name ?? nodeId,
      type: node?.type ?? "function",
      status: (data?.status as StageTraceStatus) ?? "pending",
      startedAt: data?.startedAt,
      durationMs: data?.durationMs,
      retryCount: retryCounts.get(nodeId) ?? 0,
      input: data?.input,
      output: data?.output,
      metrics: data?.metrics ?? [],
      evidence: data?.evidence ?? [],
      error: data?.error,
      promptId: node?.promptId,
      modelId: node?.modelId,
      temperature: node?.temperature,
    };
  });

  const runId = events[0]?.runId ?? "";
  const pipelineId = events[0]?.pipelineId ?? pipeline.id;
  const status: RunStatus = events.some((e) => e.type === "run_failed") ? "failed" : events.some((e) => e.type === "run_completed") ? "succeeded" : "running";

  return { runId, pipelineId, status, stages };
}

export function totalFromTrace(trace: ExecutionTrace, metricName: string): number {
  return trace.stages.reduce((total, stage) => total + (metric(stage.metrics, metricName) ?? 0), 0);
}

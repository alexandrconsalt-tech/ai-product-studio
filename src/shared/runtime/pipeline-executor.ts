import { createRun } from "@/entities/Run/model/factory";
import type { Node } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Run, RunLog, RunMetric } from "@/entities/Run/model/types";
import { createEntityId, createTimestamp } from "@/entities/shared";
import { defaultRetryPolicy, withRetry } from "./retry";
import { defaultStageRegistry } from "./stage-registry";
import { evaluateCondition, incomingEdges, topologicalOrder } from "./topology";
import type { ExecutionContext, ExecutionEvent, ExecutionEventListener, NodeExecutionStatus, RetryPolicy } from "./types";
import type { StageRegistry } from "./stage-registry";

export type ExecutePipelineOptions = Readonly<{
  registry?: StageRegistry;
  retryPolicy?: RetryPolicy;
  onEvent?: ExecutionEventListener;
  projectId?: string;
}>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sums every metric with the given name (e.g. "cost", "latency") across all stages that reported one. */
function sumMetric(metrics: readonly RunMetric[], name: string): number | undefined {
  const matching = metrics.filter((metric) => metric.name === name);
  if (matching.length === 0) return undefined;
  return matching.reduce((total, metric) => total + metric.value, 0);
}

/**
 * Executes a Pipeline using Mock Stage handlers by default. This is
 * the Production Pipeline Runtime's core entry point -- it produces a
 * real `Run` entity via `createRun`, the same contract the Simulation
 * Engine already uses, so a screen can eventually call this instead
 * of `simulatePipelineRun` without changing what it does with the
 * result. That swap is NOT done here -- it happens gradually,
 * screen by screen, per explicit instruction.
 *
 * Execution order follows `topologicalOrder`. A node with more than
 * one incoming edge only runs once ALL of its "active" incoming edges
 * (unconditional, or whose condition evaluates true against the
 * source node's output) come from successfully-completed sources; if
 * a node ends up with zero active incoming edges (e.g. the untaken
 * branch of a confidence-based route), it is marked "skipped", not
 * "failed" -- and that skip status naturally cascades forward through
 * the same rule for anything that node feeds.
 */
export async function executePipeline(pipeline: Pipeline, input: unknown, options: ExecutePipelineOptions = {}): Promise<Run> {
  const registry = options.registry ?? defaultStageRegistry;
  const retryPolicy = options.retryPolicy ?? defaultRetryPolicy;
  const runId = createEntityId("run");
  const startedAt = createTimestamp();

  const context: ExecutionContext = {
    runId,
    pipelineId: pipeline.id,
    projectId: options.projectId,
    variables: new Map(),
  };

  const logs: RunLog[] = [];
  const metrics: RunMetric[] = [];
  const evidence: string[] = [];
  const nodeOutputs = new Map<string, unknown>();
  const nodeStatuses = new Map<string, NodeExecutionStatus>();

  const emit = (event: Omit<ExecutionEvent, "timestamp" | "runId" | "pipelineId">): void => {
    options.onEvent?.({ ...event, timestamp: createTimestamp(), runId, pipelineId: pipeline.id });
  };
  const log = (level: RunLog["level"], message: string): void => {
    logs.push({ timestamp: createTimestamp(), level, message });
  };

  emit({ type: "run_started" });
  log("info", `Run ${runId} started for pipeline ${pipeline.id}.`);

  let order: Node[];
  try {
    order = topologicalOrder(pipeline);
  } catch (error) {
    const message = errorMessage(error);
    log("error", message);
    emit({ type: "run_failed", error: message });
    return createRun({ id: runId, pipelineId: pipeline.id, status: "failed", input, logs, metrics, startedAt, finishedAt: createTimestamp() });
  }

  for (const node of pipeline.nodes) nodeStatuses.set(node.id, "pending");

  let runFailed = false;
  let failureMessage: string | undefined;

  for (const node of order) {
    if (runFailed) {
      // A prior stage already failed the run. Everything after it is
      // left "pending" -> implicitly not run; we do not relabel it
      // "skipped" (that status is reserved for the branching case
      // below) and do not emit a per-node event for each of these --
      // the single run_failed event already communicates the halt.
      continue;
    }

    const incoming = incomingEdges(pipeline, node.id);
    let payload: unknown;

    if (incoming.length === 0) {
      payload = input;
    } else {
      const activeEdges = incoming.filter((edge) => nodeStatuses.get(edge.sourceNodeId) === "succeeded" && evaluateCondition(edge, nodeOutputs.get(edge.sourceNodeId)));

      if (activeEdges.length === 0) {
        nodeStatuses.set(node.id, "skipped");
        emit({ type: "stage_skipped", nodeId: node.id });
        log("info", `Node "${node.name}" skipped (no active incoming edge).`);
        continue;
      }

      payload = activeEdges.length === 1 ? nodeOutputs.get(activeEdges[0].sourceNodeId) : activeEdges.map((edge) => nodeOutputs.get(edge.sourceNodeId));
    }

    nodeStatuses.set(node.id, "running");
    emit({ type: "stage_started", nodeId: node.id, inputPayload: payload });
    const stageStartedAtMs = Date.now();

    try {
      const handler = registry.get(node.type);
      const result = await withRetry(
        () => handler({ node, payload, context }),
        retryPolicy,
        (attempt, error) => {
          emit({ type: "stage_retrying", nodeId: node.id, attempt, error: errorMessage(error) });
          log("warning", `Node "${node.name}" attempt ${attempt} failed: ${errorMessage(error)}. Retrying.`);
        },
      );
      nodeOutputs.set(node.id, result.payload);
      if (result.metrics) metrics.push(...result.metrics);
      if (result.evidence) evidence.push(...result.evidence);
      nodeStatuses.set(node.id, "succeeded");
      emit({
        type: "stage_completed",
        nodeId: node.id,
        inputPayload: payload,
        payload: result.payload,
        metrics: result.metrics,
        evidence: result.evidence,
        durationMs: Date.now() - stageStartedAtMs,
      });
      log("info", `Node "${node.name}" completed.`);
    } catch (error) {
      const message = errorMessage(error);
      nodeStatuses.set(node.id, "failed");
      emit({ type: "stage_failed", nodeId: node.id, error: message, inputPayload: payload, durationMs: Date.now() - stageStartedAtMs });
      log("error", `Node "${node.name}" failed: ${message}`);
      runFailed = true;
      failureMessage = message;
    }
  }

  const finishedAt = createTimestamp();
  const outputNode = [...order].reverse().find((node) => node.type === "output" && nodeStatuses.get(node.id) === "succeeded");
  const output = outputNode ? nodeOutputs.get(outputNode.id) : undefined;

  if (runFailed) {
    emit({ type: "run_failed", error: failureMessage });
    log("error", `Run ${runId} failed: ${failureMessage}`);
  } else {
    emit({ type: "run_completed" });
    log("info", `Run ${runId} completed.`);
  }

  return createRun({
    id: runId,
    pipelineId: pipeline.id,
    status: runFailed ? "failed" : "succeeded",
    input,
    output,
    metrics,
    evidence,
    latencyMs: sumMetric(metrics, "latency"),
    costUsd: sumMetric(metrics, "cost"),
    logs,
    startedAt,
    finishedAt,
  });
}

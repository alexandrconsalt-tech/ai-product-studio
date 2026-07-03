import type { Node } from "@/entities/Node/model/types";
import type { RunLog, RunMetric, RunStatus } from "@/entities/Run/model/types";

/**
 * Pure runtime types for the Production Pipeline Runtime. No React,
 * no Zustand, no UI imports -- same isolation rule as src/entities
 * (CLAUDE.md §8.2). This module is a peer of src/shared/simulation,
 * not a replacement for it yet: the Simulation Engine is swapped out
 * gradually, screen by screen, not in one pass.
 */

export type ExecutionEventType =
  | "run_started"
  | "stage_started"
  | "stage_completed"
  | "stage_skipped"
  | "stage_failed"
  | "stage_retrying"
  | "run_completed"
  | "run_failed";

export type ExecutionEvent = Readonly<{
  type: ExecutionEventType;
  timestamp: string;
  runId: string;
  pipelineId: string;
  nodeId?: string;
  attempt?: number;
  error?: string;
}>;

export type ExecutionEventListener = (event: ExecutionEvent) => void;

/**
 * Retry policy for a single stage invocation. `maxAttempts` includes
 * the first (non-retry) attempt, so `maxAttempts: 1` means "no retry".
 */
export type RetryPolicy = Readonly<{
  maxAttempts: number;
  backoffMs: (attempt: number) => number;
}>;

/**
 * Per-run mutable context passed to every stage. `variables` is a
 * shared bag stages can read/write to pass data forward beyond the
 * immediate upstream payload (e.g. a value produced early that a much
 * later stage needs). Deliberately mutable -- this is execution
 * scratch space, not a domain entity, so it does not follow the
 * Readonly-everywhere convention entities use (CLAUDE.md §9).
 */
export type ExecutionContext = Readonly<{
  runId: string;
  pipelineId: string;
  projectId?: string;
  variables: Map<string, unknown>;
  signal?: AbortSignal;
}>;

export type StageInput = Readonly<{
  node: Node;
  payload: unknown;
  context: ExecutionContext;
}>;

export type StageOutput = Readonly<{
  payload: unknown;
  metrics?: readonly RunMetric[];
}>;

export type StageHandler = (input: StageInput) => Promise<StageOutput>;

export type NodeExecutionStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

/**
 * Execution-time state of one pipeline run. Distinct from
 * `Pipeline.status` (the pipeline *definition's* lifecycle,
 * draft/in_progress/review/ready/completed/archived) -- this tracks
 * one specific run's progress through the graph and reuses
 * `RunStatus` (queued/running/succeeded/failed/cancelled) for the
 * overall status, since that is exactly what `Run.status` already
 * represents.
 */
export type PipelineExecutionState = Readonly<{
  runId: string;
  pipelineId: string;
  status: RunStatus;
  nodeStatuses: ReadonlyMap<string, NodeExecutionStatus>;
  logs: readonly RunLog[];
}>;

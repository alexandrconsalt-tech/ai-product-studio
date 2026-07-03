import { createEntityId } from "@/entities/shared";
import type { Run } from "./types";

export function createRun(
  input: Omit<Run, "id" | "status" | "metrics" | "evidence" | "logs" | "version"> &
    Partial<Pick<Run, "id" | "status" | "metrics" | "evidence" | "logs" | "version">>,
): Run {
  return {
    id: input.id ?? createEntityId("run"),
    pipelineId: input.pipelineId,
    status: input.status ?? "queued",
    input: input.input,
    output: input.output,
    metrics: input.metrics ?? [],
    evidence: input.evidence ?? [],
    latencyMs: input.latencyMs,
    costUsd: input.costUsd,
    logs: input.logs ?? [],
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    version: input.version ?? "1.0.0",
  };
}


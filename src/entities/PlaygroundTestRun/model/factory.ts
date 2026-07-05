import { createEntityId } from "@/entities/shared";
import type { PlaygroundTestRun } from "./types";

export function createPlaygroundTestRun(
  input: Omit<PlaygroundTestRun, "id" | "version"> & Partial<Pick<PlaygroundTestRun, "id" | "version">>,
): PlaygroundTestRun {
  return {
    id: input.id ?? createEntityId("playground_test_run"),
    projectId: input.projectId,
    source: input.source,
    status: input.status,
    stageCount: input.stageCount,
    errorCount: input.errorCount,
    warningCount: input.warningCount,
    tokens: input.tokens,
    costUsd: input.costUsd,
    durationMs: input.durationMs,
    confidence: input.confidence,
    qualityScore: input.qualityScore,
    decision: input.decision,
    transcript: input.transcript,
    report: input.report,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    version: input.version ?? "1.0.0",
  };
}

import type { EntityId, IsoDateTime, Version } from "@/entities/shared";

export type PlaygroundTestRunSource = "pipeline-lab-v3";
export type PlaygroundTestRunStatus = "succeeded" | "failed";

export type PlaygroundTestRun = Readonly<{
  id: EntityId;
  projectId: EntityId;
  source: PlaygroundTestRunSource;
  status: PlaygroundTestRunStatus;
  stageCount: number;
  errorCount: number;
  warningCount: number;
  tokens: number;
  costUsd: number;
  durationMs: number;
  confidence?: number;
  qualityScore?: number;
  decision?: string;
  startedAt: IsoDateTime;
  finishedAt: IsoDateTime;
  version: Version;
}>;

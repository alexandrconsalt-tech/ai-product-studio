import type { EntityId, IsoDateTime, Version } from "@/entities/shared";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type RunMetric = Readonly<{
  name: string;
  value: number;
  unit?: string;
}>;

export type RunLog = Readonly<{
  timestamp: IsoDateTime;
  level: "debug" | "info" | "warning" | "error";
  message: string;
}>;

export type Run = Readonly<{
  id: EntityId;
  pipelineId: EntityId;
  status: RunStatus;
  input: unknown;
  output?: unknown;
  metrics: readonly RunMetric[];
  latencyMs?: number;
  costUsd?: number;
  logs: readonly RunLog[];
  startedAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
  version: Version;
}>;


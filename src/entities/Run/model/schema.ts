import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, VersionSchema } from "@/entities/shared";

export const RunStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

export const RunMetricSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().optional(),
});

export const RunLogSchema = z.object({
  timestamp: IsoDateTimeSchema,
  level: z.enum(["debug", "info", "warning", "error"]),
  message: z.string().min(1),
});

export const RunSchema = z.object({
  id: EntityIdSchema,
  pipelineId: EntityIdSchema,
  status: RunStatusSchema,
  input: z.unknown(),
  output: z.unknown().optional(),
  metrics: z.array(RunMetricSchema).readonly(),
  // Literal excerpts/quotes stages grounded their output in -- the
  // citation-grounding requirement from CLAUDE.md §14.3 / §24 Evidence
  // Engine, aggregated here from every stage's StageOutput.evidence.
  evidence: z.array(z.string()).readonly(),
  latencyMs: z.number().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  logs: z.array(RunLogSchema).readonly(),
  startedAt: IsoDateTimeSchema.optional(),
  finishedAt: IsoDateTimeSchema.optional(),
  version: VersionSchema,
});


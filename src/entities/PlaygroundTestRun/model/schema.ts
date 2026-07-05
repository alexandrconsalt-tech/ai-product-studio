import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, VersionSchema } from "@/entities/shared";

export const PlaygroundTestRunSourceSchema = z.enum(["pipeline-lab-v3"]);
export const PlaygroundTestRunStatusSchema = z.enum(["succeeded", "failed"]);

export const PlaygroundTestRunSchema = z.object({
  id: EntityIdSchema,
  // References Project.id (the user-facing "product" selector everywhere
  // else in this app, e.g. getProjectBundle(snapshot, projectId)) rather
  // than Product.id, so Dashboard/Playground's product picker can key off
  // the same id without an extra join.
  projectId: EntityIdSchema,
  source: PlaygroundTestRunSourceSchema,
  status: PlaygroundTestRunStatusSchema,
  stageCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  tokens: z.number().nonnegative(),
  costUsd: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  // 0-1 scale (CLAUDE.md DEC-002 confidence scale), from Pipeline Lab v3's
  // Quality Gate stage (`ctx.gate.confidence`) -- optional because not every
  // custom stage configuration includes a gate step.
  confidence: z.number().min(0).max(1).optional(),
  // 0-100 scale, from Pipeline Lab v3's cross-vendor Check Agent
  // (`ctx.summary_check.score`) -- a different scale than confidence,
  // intentionally (it grades the summary text, not routing confidence).
  qualityScore: z.number().min(0).max(100).optional(),
  decision: z.string().optional(),
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema,
  version: VersionSchema,
});

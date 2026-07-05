import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, VersionSchema } from "@/entities/shared";

// "pipeline-executor" (added 2026-07-05) is a Playground run of the
// domain Pipeline entity through the real Production Pipeline Runtime
// (src/shared/runtime/pipeline-executor.ts) -- distinct from
// "pipeline-lab-v3" (the standalone iframe tool's own postMessage
// bridge). "product-test-bench" (added same day, follow-up) is a real,
// product-specific stage orchestrator with a genuine confidence-gated
// retry loop (src/features/mvp/lib/ad-copy-test-bench.ts) -- something
// the domain Pipeline's DAG-based executor cannot do at all. All three
// feed the same Dashboard history uniformly.
export const PlaygroundTestRunSourceSchema = z.enum(["pipeline-lab-v3", "pipeline-executor", "product-test-bench"]);
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
  // Raw input tested and the full per-stage report (Pipeline Lab v3's own
  // "Скачать полный отчёт" shape: {pipeline, result, usage}) -- kept so a
  // specific historical run can be reopened later, not just its aggregate
  // numbers. `unknown` (not a typed schema) because Pipeline Lab v3 is
  // plain untyped JS, same reasoning as PipelineLabV3RunPayload.
  transcript: z.string().optional(),
  report: z.unknown().optional(),
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema,
  version: VersionSchema,
});

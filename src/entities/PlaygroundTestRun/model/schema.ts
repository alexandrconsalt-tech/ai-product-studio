import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, VersionSchema } from "@/entities/shared";

// "pipeline-executor" (added 2026-07-05) is a Playground run of the
// domain Pipeline entity through the real Production Pipeline Runtime
// (src/shared/runtime/pipeline-executor.ts) -- distinct from
// "pipeline-lab-v3" (the standalone iframe tool's own postMessage
// bridge). "product-test-bench" (added same day, follow-up) is a real,
// product-specific stage orchestrator with a genuine confidence-gated
// retry loop (src/features/mvp/lib/ad-copy-test-bench.ts) -- something
// the domain Pipeline's DAG-based executor cannot do at all.
// "call-summary-pipeline" (added 2026-07-26) is the second, fully
// isolated call-summary product's own engine
// (src/features/call-summary-pipeline/lib/call-summary-pipeline.ts) --
// same "product-specific stage orchestrator" shape as product-test-bench,
// own stages/schemas/quality gate, zero shared code with pipeline-lab-v3.
// All four feed the same Dashboard history uniformly.
export const PlaygroundTestRunSourceSchema = z.enum(["pipeline-lab-v3", "pipeline-executor", "product-test-bench", "call-summary-pipeline"]);
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
  // 0-100 scale, same meaning as qualityScore but from a saved human
  // evaluation (added 2026-07-26 for the call-summary-pipeline product's
  // "Ручная оценка" -- computeQualityDecision's overall_score run on the
  // reviewer's own raw scores). Written via a second recordRun() call
  // with the same id once the reviewer saves, since the human evaluation
  // only exists after the run itself already completed. Optional because
  // no other source ever sets it.
  manualQualityScore: z.number().min(0).max(100).optional(),
  decision: z.string().optional(),
  // Raw input tested and the full per-stage report (Pipeline Lab v3's own
  // "Скачать полный отчёт" shape: {pipeline, result, usage}) -- kept so a
  // specific historical run can be reopened later, not just its aggregate
  // numbers. `unknown` (not a typed schema) because Pipeline Lab v3 is
  // plain untyped JS, same reasoning as PipelineLabV3RunPayload.
  transcript: z.string().optional(),
  report: z.unknown().optional(),
  productName: z.string().optional(),
  moduleName: z.string().optional(),
  pipelineName: z.string().optional(),
  finalScore: z.number().optional(),
  finalDecision: z.string().optional(),
  summary: z.string().optional(),
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema,
  version: VersionSchema,
});

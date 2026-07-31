import { z } from "zod";

/**
 * Shape of the `postMessage` payload public/pipeline-lab-v3.html sends to
 * its parent window after a run finishes (see that file's
 * `reportRunToParent`). Hand-written to match the literal object built
 * there -- there is no Zod validation at this boundary because the
 * message never leaves this same-origin iframe/parent pair, and Pipeline
 * Lab v3 itself is plain untyped JS, not a Zod-validated boundary.
 */
export type PipelineLabV3RunPayload = Readonly<{
  id?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stageCount: number;
  errorCount: number;
  warningCount: number;
  tokens: number;
  costUsd: number;
  status: "succeeded" | "failed";
  confidence?: number;
  decision?: string;
  qualityScore?: number;
  productId?: string;
  productName?: string;
  moduleName?: string;
  pipelineName?: string;
  finalScore?: number;
  finalDecision?: string;
  summary?: string;
  // Raw input tested and the full per-stage report (same shape as
  // Pipeline Lab v3's own "Скачать полный отчёт (JSON)" download) --
  // kept so a specific historical test result can be reopened later
  // from Dashboard, not just its aggregate numbers.
  transcript?: string;
  report?: unknown;
  stageReports?: unknown;
}>;

export type PipelineLabV3RunMessage = Readonly<{
  source: "pipeline-lab-v3";
  type: "run-complete";
  productId: string | null;
  payload: PipelineLabV3RunPayload;
}>;

export function isPipelineLabV3RunMessage(data: unknown): data is PipelineLabV3RunMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === "pipeline-lab-v3" && (data as { type?: unknown }).type === "run-complete";
}

export const PipelineRuntimeConfigSchema = z.object({
  transcriptionSummaryV3Enabled: z.boolean(),
  transcriptionSummaryV3CrmDryRun: z.boolean(),
  transcriptionSummaryV3Required: z.boolean(),
  transcriptionSummaryV3PipelineVersion: z.literal("3.0.0"),
}).strict();

export type PipelineRuntimeConfig = z.infer<typeof PipelineRuntimeConfigSchema>;

export const PipelineLabV3ConfigMessageSchema = z.object({
  source: z.literal("ai-communication-studio"),
  type: z.literal("runtime-config"),
  config: PipelineRuntimeConfigSchema,
}).strict();

export type PipelineLabV3ConfigMessage = z.infer<typeof PipelineLabV3ConfigMessageSchema>;

export function parsePipelineLabV3ConfigMessage(data: unknown): PipelineLabV3ConfigMessage | null {
  const parsed = PipelineLabV3ConfigMessageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

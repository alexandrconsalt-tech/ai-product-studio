import type { Node } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Run, RunLog, RunMetric } from "@/entities/Run/model/types";
import { createRun } from "@/entities/Run/model/factory";
import { createTimestamp } from "@/entities/shared";
import { CallAnalysisSummarySchema, type CallAnalysisSummary } from "@/shared/model/call-analysis-summary";
import { confidenceFromTemperature } from "@/shared/model/confidence";

export type SimulationResult = Readonly<{
  run: Run;
}>;

/**
 * Prompt id used by the demo pipeline's structured-summary step
 * (`demo-data.ts`'s `node_llm`). Recognizing it lets the simulator
 * produce the real CallAnalysisSummary shape (CLAUDE.md §14.3)
 * instead of a generic placeholder, without the domain model or the
 * pipeline entity needing to know anything about "call analysis"
 * specifically -- this stays a simulation-layer concern.
 */
const CALL_SUMMARY_PROMPT_ID = "prompt_call_summary";

/**
 * Rough per-model cost/latency multiplier, keyed by the demo Model
 * ids. Unknown model ids default to 1 (neutral). This is still a
 * simulation -- it does not call any real provider -- but it makes
 * `Node.modelId` visibly affect the result, which it did not before
 * (CLAUDE.md §63 debt item 11).
 */
const MODEL_COST_MULTIPLIER: Record<string, number> = {
  model_fast: 0.35,
  model_reasoning: 1,
};

const estimateTokens = (input: string, nodeCount: number): number => Math.max(420, Math.round(input.length * 2.8 + nodeCount * 180));

function findSummaryNode(pipeline: Pipeline): Node | undefined {
  return pipeline.nodes.find((node) => node.type === "llm" && node.promptId === CALL_SUMMARY_PROMPT_ID);
}

function firstSentence(input: string): string {
  const sentence = input
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return sentence ?? input.trim();
}

function buildCallAnalysisSummary(input: string, confidence: number): CallAnalysisSummary {
  const lower = input.toLowerCase();
  const excerpt = firstSentence(input) || "Transcript пуст.";

  const summary: CallAnalysisSummary = {
    кто: "Клиент (роль не диаризована в Simulation Engine)",
    тип_контакта: lower.includes("кц") || lower.includes("контакт-центр") ? "contact_center" : "agent",
    потребность: excerpt,
    вопросы: lower.includes("?") ? ["Transcript содержит вопрос клиента — см. цитату."] : [],
    статус: confidence < 0.72 ? "thinking" : "in_progress",
    действие: confidence < 0.72 ? "Направить на Human Review (confidence ниже 0.72)." : "Обновить сделку и запланировать follow-up.",
    цитаты: [excerpt],
  };

  return CallAnalysisSummarySchema.parse(summary);
}

function buildGenericOutput(input: string, confidence: number) {
  const lower = input.toLowerCase();
  const needs = lower.includes("crm") ? ["CRM integration", "implementation timeline", "summary accuracy"] : ["customer context", "follow-up clarity"];
  const risks = lower.includes("стоим") || lower.includes("cost") ? ["cost sensitivity"] : ["confidence requires validation"];
  return {
    summary: "Simulation Engine обработал transcript и сформировал structured call analysis.",
    needs,
    risks,
    nextAction: "Подготовить demo сценарий, показать validation и согласовать evaluation thresholds.",
    confidence,
  };
}

export function simulatePipelineRun(pipeline: Pipeline, input: string): SimulationResult {
  const startedAt = createTimestamp();
  const summaryNode = findSummaryNode(pipeline);
  const modelMultiplier = summaryNode?.modelId ? (MODEL_COST_MULTIPLIER[summaryNode.modelId] ?? 1) : 1;

  const tokens = estimateTokens(input, pipeline.nodes.length);
  const latencyMs = Math.round((620 + pipeline.nodes.length * 115 + input.length * 1.4) * modelMultiplier);
  const costUsd = Number((tokens * 0.000018 * modelMultiplier).toFixed(4));
  const confidence = confidenceFromTemperature(summaryNode?.temperature);

  const output = summaryNode ? { ...buildCallAnalysisSummary(input, confidence), confidence } : buildGenericOutput(input, confidence);

  const logs: RunLog[] = [
    { timestamp: startedAt, level: "info", message: "Simulation run started." },
    ...pipeline.nodes.map((node) => ({ timestamp: createTimestamp(), level: "info" as const, message: `${node.name} completed.` })),
    ...(summaryNode
      ? [
          {
            timestamp: createTimestamp(),
            level: "info" as const,
            message: `Summary node "${summaryNode.name}" used model=${summaryNode.modelId ?? "unset"} prompt=${summaryNode.promptId ?? "unset"} temperature=${summaryNode.temperature ?? "unset"}.`,
          },
        ]
      : []),
    { timestamp: createTimestamp(), level: "info", message: "Simulation output generated." },
  ];
  const metrics: RunMetric[] = [
    { name: "tokens", value: tokens, unit: "tokens" },
    { name: "cost", value: costUsd, unit: "usd" },
    { name: "latency", value: latencyMs, unit: "ms" },
    { name: "duration", value: Math.round(latencyMs / 100) / 10, unit: "s" },
  ];

  return {
    run: createRun({
      pipelineId: pipeline.id,
      status: "succeeded",
      input,
      output,
      metrics,
      latencyMs,
      costUsd,
      logs,
      startedAt,
      finishedAt: createTimestamp(),
    }),
  };
}

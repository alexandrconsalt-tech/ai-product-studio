import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Run, RunLog, RunMetric } from "@/entities/Run/model/types";
import { createRun } from "@/entities/Run/model/factory";
import { createTimestamp } from "@/entities/shared";

export type SimulationResult = Readonly<{
  run: Run;
}>;

const estimateTokens = (input: string, nodeCount: number): number => Math.max(420, Math.round(input.length * 2.8 + nodeCount * 180));

export function simulatePipelineRun(pipeline: Pipeline, input: string): SimulationResult {
  const startedAt = createTimestamp();
  const tokens = estimateTokens(input, pipeline.nodes.length);
  const latencyMs = Math.round(620 + pipeline.nodes.length * 115 + input.length * 1.4);
  const costUsd = Number((tokens * 0.000018).toFixed(4));
  const needs = input.toLowerCase().includes("crm") ? ["CRM integration", "implementation timeline", "summary accuracy"] : ["customer context", "follow-up clarity"];
  const risks = input.toLowerCase().includes("стоим") || input.toLowerCase().includes("cost") ? ["cost sensitivity"] : ["confidence requires validation"];
  const output = {
    summary: "Simulation Engine обработал transcript и сформировал structured call analysis.",
    needs,
    risks,
    nextAction: "Подготовить demo сценарий, показать validation и согласовать evaluation thresholds.",
    confidence: 0.86,
  };
  const logs: RunLog[] = [
    { timestamp: startedAt, level: "info", message: "Simulation run started." },
    ...pipeline.nodes.map((node) => ({ timestamp: createTimestamp(), level: "info" as const, message: `${node.name} completed.` })),
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


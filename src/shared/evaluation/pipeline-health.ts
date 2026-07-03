import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { PromptRegistry } from "@/shared/prompts/prompt-registry";
import type { ExecutionTrace } from "@/shared/runtime/execution-trace";
import { incomingEdges } from "@/shared/runtime/topology";

/**
 * Automated Pipeline Review ("Pipeline Health"). Purely structural
 * checks (unreachable_node, duplicate_stage, missing_validation,
 * extra_llm_call, long_prompt) work from the Pipeline definition
 * alone; execution-derived checks (expensive_prompt, low_confidence,
 * high_latency) only run when an `ExecutionTrace` (§M.1) is supplied
 * -- with no trace, this reports only what can be known statically,
 * rather than guessing at runtime behavior.
 */

export type HealthIssueCode =
  | "expensive_prompt"
  | "low_confidence"
  | "extra_llm_call"
  | "missing_validation"
  | "high_latency"
  | "long_prompt"
  | "duplicate_stage"
  | "unreachable_node";

export type HealthSeverity = "info" | "warning" | "critical";

export type HealthIssue = Readonly<{
  code: HealthIssueCode;
  severity: HealthSeverity;
  message: string;
  nodeId?: string;
}>;

export type PipelineHealthReport = Readonly<{
  score: number;
  issues: readonly HealthIssue[];
}>;

export type PipelineHealthThresholds = Readonly<{
  maxLatencyMs: number;
  minConfidence: number;
  maxPromptChars: number;
  maxStageCostUsd: number;
}>;

/**
 * `maxLatencyMs: 2000` and `minConfidence: 0.72` are not arbitrary --
 * they match the actual demo Architecture entity's own evaluation
 * requirements (`demo-data.ts`'s "Latency < 2000ms" and the confidence
 * routing threshold used throughout this repository, CLAUDE.md §25).
 * `maxPromptChars: 800` is a proxy for the real anti-pattern this
 * repository's own business case demonstrated: a 315-line, ~2500+
 * character "do everything" prompt (`pdf-notes.txt`, CLAUDE.md §15).
 */
export const defaultHealthThresholds: PipelineHealthThresholds = {
  maxLatencyMs: 2000,
  minConfidence: 0.72,
  maxPromptChars: 800,
  maxStageCostUsd: 0.01,
};

export type PipelineHealthOptions = Readonly<{
  trace?: ExecutionTrace;
  prompts?: PromptRegistry;
  thresholds?: Partial<PipelineHealthThresholds>;
}>;

const AI_NODE_TYPES = new Set(["llm", "agent"]);

/**
 * "Unreachable" means "cannot reach any `output`-type node" (a
 * backward BFS from every output node, along incoming edges) -- NOT
 * simply "has no incoming edge". A node with zero incoming edges is
 * often a legitimate fan-in source (e.g. the real demo pipeline's
 * `node_tool`, which has no incoming edge but does feed into `node_llm`
 * and ultimately the output); flagging every such node would produce
 * false positives against this repository's own real pipeline. A
 * pipeline with no `output` node at all is a different, earlier-stage
 * problem (still being drafted) -- this check is skipped rather than
 * flagging every node as unreachable in that case.
 */
function findUnreachableNodes(pipeline: Pipeline): string[] {
  const outputIds = pipeline.nodes.filter((node) => node.type === "output").map((node) => node.id);
  if (outputIds.length === 0) return [];

  const canReachOutput = new Set<string>(outputIds);
  const queue = [...outputIds];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const edge of incomingEdges(pipeline, id)) {
      if (!canReachOutput.has(edge.sourceNodeId)) {
        canReachOutput.add(edge.sourceNodeId);
        queue.push(edge.sourceNodeId);
      }
    }
  }
  return pipeline.nodes.filter((node) => !canReachOutput.has(node.id)).map((node) => node.id);
}

function findDuplicateStages(pipeline: Pipeline): string[][] {
  const groups = new Map<string, string[]>();
  for (const node of pipeline.nodes) {
    const key = `${node.type}:${node.name}`;
    groups.set(key, [...(groups.get(key) ?? []), node.id]);
  }
  return [...groups.values()].filter((ids) => ids.length > 1);
}

function findExtraLlmCallEdges(pipeline: Pipeline): string[] {
  return pipeline.edges
    .filter((edge) => {
      const source = pipeline.nodes.find((node) => node.id === edge.sourceNodeId);
      const target = pipeline.nodes.find((node) => node.id === edge.targetNodeId);
      return source && target && AI_NODE_TYPES.has(source.type) && AI_NODE_TYPES.has(target.type);
    })
    .map((edge) => edge.targetNodeId);
}

export function assessPipelineHealth(pipeline: Pipeline, options: PipelineHealthOptions = {}): PipelineHealthReport {
  const thresholds = { ...defaultHealthThresholds, ...options.thresholds };
  const issues: HealthIssue[] = [];

  for (const nodeId of findUnreachableNodes(pipeline)) {
    const node = pipeline.nodes.find((n) => n.id === nodeId);
    issues.push({ code: "unreachable_node", severity: "warning", message: `Node "${node?.name ?? nodeId}" has no incoming edge and is not a source node -- it can never run.`, nodeId });
  }

  for (const group of findDuplicateStages(pipeline)) {
    const node = pipeline.nodes.find((n) => n.id === group[0]);
    issues.push({ code: "duplicate_stage", severity: "info", message: `${group.length} nodes share the same type and name ("${node?.name}") -- likely redundant.`, nodeId: group[0] });
  }

  const hasAiNode = pipeline.nodes.some((node) => AI_NODE_TYPES.has(node.type));
  const hasValidationNode = pipeline.nodes.some((node) => node.type === "validation");
  if (hasAiNode && !hasValidationNode) {
    issues.push({ code: "missing_validation", severity: "critical", message: "Pipeline has an llm/agent node but no validation node -- AI output is never checked before use (CLAUDE.md §13)." });
  }

  for (const nodeId of findExtraLlmCallEdges(pipeline)) {
    const node = pipeline.nodes.find((n) => n.id === nodeId);
    issues.push({ code: "extra_llm_call", severity: "warning", message: `Node "${node?.name ?? nodeId}" is an llm/agent node fed directly by another llm/agent node with no validation in between.`, nodeId });
  }

  if (options.prompts) {
    for (const node of pipeline.nodes) {
      if (!node.promptId) continue;
      try {
        const entry = options.prompts.resolve(node.promptId);
        if (entry.template.length > thresholds.maxPromptChars) {
          issues.push({ code: "long_prompt", severity: "warning", message: `Prompt "${node.promptId}" is ${entry.template.length} characters -- consider splitting it (CLAUDE.md §15 PE-2).`, nodeId: node.id });
        }
      } catch {
        // Prompt not registered -- not this scorer's concern; the
        // Runtime itself will throw a clear PromptNotFoundError on run.
      }
    }
  }

  if (options.trace) {
    for (const stage of options.trace.stages) {
      const cost = stage.metrics.find((m) => m.name === "cost")?.value;
      if (cost !== undefined && cost > thresholds.maxStageCostUsd) {
        issues.push({ code: "expensive_prompt", severity: "warning", message: `Stage "${stage.name}" cost $${cost.toFixed(4)}, above the $${thresholds.maxStageCostUsd} threshold.`, nodeId: stage.nodeId });
      }
      const confidence = stage.metrics.find((m) => m.name === "confidence")?.value;
      if (confidence !== undefined && confidence < thresholds.minConfidence) {
        issues.push({ code: "low_confidence", severity: "warning", message: `Stage "${stage.name}" confidence ${confidence} is below ${thresholds.minConfidence}.`, nodeId: stage.nodeId });
      }
    }
    const totalLatency = options.trace.stages.reduce((sum, stage) => sum + (stage.durationMs ?? 0), 0);
    if (totalLatency > thresholds.maxLatencyMs) {
      issues.push({ code: "high_latency", severity: "warning", message: `Total execution latency ${totalLatency}ms exceeds the ${thresholds.maxLatencyMs}ms target.` });
    }
  }

  const penalty = issues.reduce((total, issue) => total + (issue.severity === "critical" ? 20 : issue.severity === "warning" ? 8 : 3), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { score, issues };
}

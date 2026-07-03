import type { Edge } from "@/entities/Edge/model/types";
import type { Node } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";

export class CyclicPipelineError extends Error {
  readonly retryable = false;
  constructor(readonly pipelineId: string) {
    super(`Pipeline "${pipelineId}" contains a cycle and cannot be executed.`);
    this.name = "CyclicPipelineError";
  }
}

/**
 * Kahn's algorithm over Pipeline.nodes/edges. Throws CyclicPipelineError
 * (non-retryable) if the graph is not a DAG -- production-ready
 * pipelines shouldn't have cycles (docs/domain validation rules), but
 * this is a runtime safety net, not just a design-time lint.
 */
export function topologicalOrder(pipeline: Pipeline): Node[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of pipeline.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of pipeline.edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const queue = pipeline.nodes.filter((node) => inDegree.get(node.id) === 0).map((node) => node.id);
  const orderedIds: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    orderedIds.push(id);
    for (const nextId of adjacency.get(id) ?? []) {
      const remaining = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, remaining);
      if (remaining === 0) queue.push(nextId);
    }
  }

  if (orderedIds.length !== pipeline.nodes.length) {
    throw new CyclicPipelineError(pipeline.id);
  }

  const nodeById = new Map(pipeline.nodes.map((node) => [node.id, node]));
  return orderedIds.map((id) => nodeById.get(id) as Node);
}

export function incomingEdges(pipeline: Pipeline, nodeId: string): Edge[] {
  return pipeline.edges.filter((edge) => edge.targetNodeId === nodeId);
}

export function outgoingEdges(pipeline: Pipeline, nodeId: string): Edge[] {
  return pipeline.edges.filter((edge) => edge.sourceNodeId === nodeId);
}

/**
 * Evaluates an Edge.condition ({field, operator, value}, CLAUDE.md
 * §14.2) against an upstream stage's output payload. An edge with no
 * condition is always active (unconditional). If the condition's
 * field is missing or not a number on the payload, the edge is
 * treated as inactive rather than throwing -- a stage that doesn't
 * produce the expected field simply doesn't route down that branch.
 */
export function evaluateCondition(edge: Edge, payload: unknown): boolean {
  const condition = edge.condition;
  if (!condition) return true;

  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const actual = record[condition.field];
  if (typeof actual !== "number") return false;

  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return actual > condition.value;
    case "gte":
      return actual >= condition.value;
    case "lt":
      return actual < condition.value;
    case "lte":
      return actual <= condition.value;
  }
}

import type { NodeType } from "@/entities/Node/model/types";
import { mockStageHandlers } from "./mock-stage";
import type { StageHandler } from "./types";

/**
 * Maps NodeType -> the handler that executes it. This is the single
 * seam for swapping a Mock Stage out for a real implementation
 * (a real LLM call, a real tool integration, etc.) without touching
 * the Pipeline Executor itself.
 */
export type StageRegistry = Readonly<{
  get(nodeType: NodeType): StageHandler;
  withOverride(nodeType: NodeType, handler: StageHandler): StageRegistry;
}>;

function createRegistry(handlers: Readonly<Record<NodeType, StageHandler>>): StageRegistry {
  return {
    get(nodeType) {
      const handler = handlers[nodeType];
      if (!handler) {
        throw new Error(`No stage handler registered for node type "${nodeType}".`);
      }
      return handler;
    },
    withOverride(nodeType, handler) {
      return createRegistry({ ...handlers, [nodeType]: handler });
    },
  };
}

/**
 * Default registry: every NodeType resolves to its Mock Stage
 * handler. Use `.withOverride(type, handler)` to swap in a real
 * implementation for one node type at a time -- this is the intended
 * "gradually replace" seam.
 */
export const defaultStageRegistry: StageRegistry = createRegistry(mockStageHandlers);

import { createEntityId } from "@/entities/shared";
import type { Edge } from "./types";

export function createEdge(input: Omit<Edge, "id" | "version"> & Partial<Pick<Edge, "id" | "version">>): Edge {
  return {
    id: input.id ?? createEntityId("edge"),
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    sourcePortId: input.sourcePortId,
    targetPortId: input.targetPortId,
    condition: input.condition,
    version: input.version ?? "1.0.0",
  };
}


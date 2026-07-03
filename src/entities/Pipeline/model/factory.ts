import { createEntityId, createTimestamp } from "@/entities/shared";
import type { Pipeline } from "./types";

export function createPipeline(
  input: Omit<Pipeline, "id" | "status" | "nodes" | "edges" | "createdAt" | "updatedAt" | "version"> &
    Partial<Pick<Pipeline, "id" | "status" | "nodes" | "edges" | "createdAt" | "updatedAt" | "version">>,
): Pipeline {
  const now = createTimestamp();

  return {
    id: input.id ?? createEntityId("pipeline"),
    projectId: input.projectId,
    architectureId: input.architectureId,
    status: input.status ?? "draft",
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
    layout: input.layout,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? "1.0.0",
  };
}


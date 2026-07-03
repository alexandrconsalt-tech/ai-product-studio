import { createEntityId, createTimestamp } from "@/entities/shared";
import type { Project } from "./types";

export function createProject(
  input: Omit<Project, "id" | "status" | "playgroundRunIds" | "reviewIds" | "createdAt" | "updatedAt" | "version"> &
    Partial<Pick<Project, "id" | "status" | "playgroundRunIds" | "reviewIds" | "createdAt" | "updatedAt" | "version">>,
): Project {
  const now = createTimestamp();

  return {
    id: input.id ?? createEntityId("project"),
    name: input.name,
    description: input.description,
    status: input.status ?? "draft",
    productId: input.productId,
    architectureId: input.architectureId,
    pipelineId: input.pipelineId,
    playgroundRunIds: input.playgroundRunIds ?? [],
    reviewIds: input.reviewIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? "1.0.0",
  };
}


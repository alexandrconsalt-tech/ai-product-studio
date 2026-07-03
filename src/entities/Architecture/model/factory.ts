import { createEntityId, createTimestamp } from "@/entities/shared";
import type { Architecture } from "./types";

export function createArchitecture(
  input: Omit<Architecture, "id" | "status" | "capabilities" | "aiComponents" | "modelIds" | "dataFlow" | "quality" | "evaluation" | "createdAt" | "updatedAt" | "version"> &
    Partial<Pick<Architecture, "id" | "status" | "capabilities" | "aiComponents" | "modelIds" | "dataFlow" | "quality" | "evaluation" | "createdAt" | "updatedAt" | "version">>,
): Architecture {
  const now = createTimestamp();

  return {
    id: input.id ?? createEntityId("architecture"),
    projectId: input.projectId,
    productId: input.productId,
    status: input.status ?? "draft",
    capabilities: input.capabilities ?? [],
    aiComponents: input.aiComponents ?? [],
    modelIds: input.modelIds ?? [],
    dataFlow: input.dataFlow ?? [],
    quality: input.quality ?? [],
    evaluation: input.evaluation ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? "1.0.0",
  };
}


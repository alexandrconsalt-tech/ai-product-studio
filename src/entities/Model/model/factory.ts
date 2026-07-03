import { createEntityId } from "@/entities/shared";
import type { Model } from "./types";

export function createModel(input: Omit<Model, "id" | "capabilities" | "version"> & Partial<Pick<Model, "id" | "capabilities" | "version">>): Model {
  return {
    id: input.id ?? createEntityId("model"),
    name: input.name,
    provider: input.provider,
    capabilities: input.capabilities ?? [],
    contextWindow: input.contextWindow,
    version: input.version ?? "1.0.0",
  };
}


import { createEntityId } from "@/entities/shared";
import type { KnowledgeModule } from "./types";

export function createKnowledgeModule(
  input: Omit<KnowledgeModule, "id" | "frameworkIds" | "version"> &
    Partial<Pick<KnowledgeModule, "id" | "frameworkIds" | "version">>,
): KnowledgeModule {
  return {
    id: input.id ?? createEntityId("knowledge_module"),
    name: input.name,
    kind: input.kind,
    path: input.path,
    frameworkIds: input.frameworkIds ?? [],
    version: input.version ?? "1.0.0",
  };
}


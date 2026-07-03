import type { EntityId, Version } from "@/entities/shared";

export type KnowledgeModuleKind = "senior_product_manager" | "senior_ai_solution_architect" | "orchestrator" | "pipeline_builder" | "reviewer";

export type KnowledgeModule = Readonly<{
  id: EntityId;
  name: string;
  kind: KnowledgeModuleKind;
  path: string;
  frameworkIds: readonly EntityId[];
  version: Version;
}>;


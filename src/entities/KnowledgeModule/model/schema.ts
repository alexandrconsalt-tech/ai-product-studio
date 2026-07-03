import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const KnowledgeModuleKindSchema = z.enum([
  "senior_product_manager",
  "senior_ai_solution_architect",
  "orchestrator",
  "pipeline_builder",
  "reviewer",
]);

export const KnowledgeModuleSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  kind: KnowledgeModuleKindSchema,
  path: z.string().min(1),
  frameworkIds: z.array(EntityIdSchema).readonly(),
  version: VersionSchema,
});


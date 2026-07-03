import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const ModelProviderSchema = z.enum(["openai", "anthropic", "google", "local", "other"]);
export const ModelCapabilitySchema = z.enum(["classification", "extraction", "generation", "reasoning", "embedding", "reranking", "tool_use"]);

export const ModelSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  provider: ModelProviderSchema,
  capabilities: z.array(ModelCapabilitySchema).readonly(),
  contextWindow: z.number().int().positive().optional(),
  version: VersionSchema,
});


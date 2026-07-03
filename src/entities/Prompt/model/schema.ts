import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const PromptPurposeSchema = z.enum(["instruction", "evaluation", "routing", "extraction", "generation", "review"]);

export const PromptSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  purpose: PromptPurposeSchema,
  description: z.string().min(1),
  ownerModuleId: EntityIdSchema.optional(),
  version: VersionSchema,
});


import { z } from "zod";
import { EntityIdSchema, LifecycleStatusSchema, VersionSchema } from "@/entities/shared";

export const PromptPurposeSchema = z.enum(["instruction", "evaluation", "routing", "extraction", "generation", "review"]);

export const PromptSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  purpose: PromptPurposeSchema,
  description: z.string().min(1),
  status: LifecycleStatusSchema,
  ownerModuleId: EntityIdSchema.optional(),
  version: VersionSchema,
});


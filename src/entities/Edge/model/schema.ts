import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const EdgeConditionSchema = z.object({
  expression: z.string().min(1),
  description: z.string().optional(),
});

export const EdgeSchema = z.object({
  id: EntityIdSchema,
  sourceNodeId: EntityIdSchema,
  targetNodeId: EntityIdSchema,
  sourcePortId: EntityIdSchema.optional(),
  targetPortId: EntityIdSchema.optional(),
  condition: EdgeConditionSchema.optional(),
  version: VersionSchema,
});


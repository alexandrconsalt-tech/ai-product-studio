import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const EdgeConditionOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]);

export const EdgeConditionSchema = z.object({
  field: z.string().min(1),
  operator: EdgeConditionOperatorSchema,
  value: z.number(),
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


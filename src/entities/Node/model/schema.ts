import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const NodeTypeSchema = z.enum(["agent", "llm", "function", "router", "tool", "store", "validation", "human_review", "input", "output"]);

export const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const NodePortSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  schemaRef: z.string().min(1).optional(),
});

export const NodeSchema = z.object({
  id: EntityIdSchema,
  type: NodeTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  inputPorts: z.array(NodePortSchema).readonly(),
  outputPorts: z.array(NodePortSchema).readonly(),
  modelId: EntityIdSchema.optional(),
  promptId: EntityIdSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.string().min(1)).readonly(),
  metadata: z.record(z.string(), z.string()).readonly(),
  position: NodePositionSchema.optional(),
  version: VersionSchema,
});

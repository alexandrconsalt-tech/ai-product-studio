import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, LifecycleStatusSchema, VersionSchema } from "@/entities/shared";

export const AiCapabilitySchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean(),
});

export const AiComponentSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  type: z.enum(["rules_engine", "workflow", "llm", "agent", "rag", "human_review", "gateway"]),
  description: z.string().optional(),
});

export const DataFlowItemSchema = z.object({
  id: EntityIdSchema,
  source: z.string().min(1),
  target: z.string().min(1),
  dataType: z.string().min(1),
});

export const QualityRequirementSchema = z.object({
  name: z.string().min(1),
  threshold: z.string().optional(),
});

export const EvaluationRequirementSchema = z.object({
  metric: z.string().min(1),
  method: z.string().min(1),
  threshold: z.string().optional(),
});

export const ArchitectureSchema = z.object({
  id: EntityIdSchema,
  projectId: EntityIdSchema,
  productId: EntityIdSchema,
  status: LifecycleStatusSchema,
  capabilities: z.array(AiCapabilitySchema).readonly(),
  aiComponents: z.array(AiComponentSchema).readonly(),
  modelIds: z.array(EntityIdSchema).readonly(),
  dataFlow: z.array(DataFlowItemSchema).readonly(),
  quality: z.array(QualityRequirementSchema).readonly(),
  evaluation: z.array(EvaluationRequirementSchema).readonly(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: VersionSchema,
});


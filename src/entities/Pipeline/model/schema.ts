import { z } from "zod";
import { EdgeSchema } from "@/entities/Edge/model/schema";
import { NodeSchema } from "@/entities/Node/model/schema";
import { EntityIdSchema, IsoDateTimeSchema, LifecycleStatusSchema, VersionSchema } from "@/entities/shared";

export const PipelineLayoutSchema = z.object({
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive(),
    })
    .optional(),
});

export const PipelineSchema = z.object({
  id: EntityIdSchema,
  projectId: EntityIdSchema,
  architectureId: EntityIdSchema,
  status: LifecycleStatusSchema,
  nodes: z.array(NodeSchema).readonly(),
  edges: z.array(EdgeSchema).readonly(),
  layout: PipelineLayoutSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: VersionSchema,
});


import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, VersionSchema } from "@/entities/shared";

export const ProjectStatusSchema = z.enum(["draft", "discovery", "product_ready", "architecture_ready", "pipeline_ready", "testing", "completed", "archived"]);

export const ProjectSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  status: ProjectStatusSchema,
  productId: EntityIdSchema.optional(),
  architectureId: EntityIdSchema.optional(),
  pipelineId: EntityIdSchema.optional(),
  playgroundRunIds: z.array(EntityIdSchema).readonly(),
  reviewIds: z.array(EntityIdSchema).readonly(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: VersionSchema,
});


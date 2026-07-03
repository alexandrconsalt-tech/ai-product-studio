import { z } from "zod";
import { EntityIdSchema, VersionSchema } from "@/entities/shared";

export const FrameworkCategorySchema = z.enum([
  "product_discovery",
  "prioritization",
  "metrics",
  "ai_engineering",
  "architecture",
  "evaluation",
]);

export const FrameworkSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  category: FrameworkCategorySchema,
  source: z.string().min(1),
  version: VersionSchema,
});


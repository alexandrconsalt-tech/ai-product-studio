import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, LifecycleStatusSchema, VersionSchema } from "@/entities/shared";

export const ProductIdeaSchema = z.object({
  statement: z.string().min(1),
  source: z.string().optional(),
});

export const ProductProblemSchema = z.object({
  statement: z.string().min(1),
  evidenceIds: z.array(EntityIdSchema).readonly(),
});

export const ProductUserSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  segment: z.string().optional(),
});

export const ProductJtbdSchema = z.object({
  statement: z.string().min(1),
  context: z.string().optional(),
  desiredOutcome: z.string().optional(),
});

export const ProductFeatureSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const ProductMetricCategorySchema = z.enum(["success", "quality", "cost", "speed"]);

export const ProductMetricSchema = z.object({
  name: z.string().min(1),
  target: z.string().optional(),
  category: ProductMetricCategorySchema.optional(),
});

export const ProductSchema = z.object({
  id: EntityIdSchema,
  projectId: EntityIdSchema,
  status: LifecycleStatusSchema,
  idea: ProductIdeaSchema.optional(),
  discovery: z.string().optional(),
  problem: ProductProblemSchema.optional(),
  users: z.array(ProductUserSchema).readonly(),
  jtbd: z.array(ProductJtbdSchema).readonly(),
  features: z.array(ProductFeatureSchema).readonly(),
  mvp: z.string().optional(),
  metrics: z.array(ProductMetricSchema).readonly(),
  prd: z.string().optional(),
  frameworkIds: z.array(EntityIdSchema).readonly(),
  // Product Manager template fields (AI Product Studio v2, CLAUDE.md addendum
  // "Product -> Playground -> Dashboard") -- additive per DDD-1, all optional
  // so existing seeded Products (demo-data.ts) remain valid without changes.
  valueProposition: z.string().optional(),
  targetAudience: z.string().optional(),
  userStory: z.string().optional(),
  mainScenario: z.string().optional(),
  // `mvp` (existing field) holds "что входит"; `mvpOut` complements it with
  // "что не входит" -- kept as two plain strings rather than a nested object
  // per CLAUDE.md's simplicity-first principle (no second consumer yet).
  mvpOut: z.string().optional(),
  assumptions: z.string().optional(),
  aiModels: z.string().optional(),
  aiAgents: z.string().optional(),
  aiPipelineNotes: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  roadmap: z.string().optional(),
  notes: z.string().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  version: VersionSchema,
});


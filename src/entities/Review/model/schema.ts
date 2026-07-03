import { z } from "zod";
import { EntityIdSchema, IsoDateTimeSchema, ReviewStatusSchema, VersionSchema } from "@/entities/shared";

export const ReviewTargetTypeSchema = z.enum(["product", "architecture", "pipeline", "run", "project", "prompt"]);

export const ReviewIssueSchema = z.object({
  id: EntityIdSchema,
  severity: z.enum(["low", "medium", "high", "blocking"]),
  message: z.string().min(1),
  recommendation: z.string().optional(),
});

export const ReviewSchema = z.object({
  id: EntityIdSchema,
  targetType: ReviewTargetTypeSchema,
  targetId: EntityIdSchema,
  status: ReviewStatusSchema,
  score: z.number().min(0).max(100).optional(),
  issues: z.array(ReviewIssueSchema).readonly(),
  reviewerModuleId: EntityIdSchema.optional(),
  createdAt: IsoDateTimeSchema,
  version: VersionSchema,
});


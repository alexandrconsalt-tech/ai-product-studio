import { createEntityId, createTimestamp } from "@/entities/shared";
import type { Review, ReviewIssue } from "./types";

export function createReview(input: Omit<Review, "id" | "issues" | "createdAt" | "version"> & Partial<Pick<Review, "id" | "issues" | "createdAt" | "version">>): Review {
  return {
    id: input.id ?? createEntityId("review"),
    targetType: input.targetType,
    targetId: input.targetId,
    status: input.status,
    score: input.score,
    issues: input.issues ?? [],
    reviewerModuleId: input.reviewerModuleId,
    createdAt: input.createdAt ?? createTimestamp(),
    version: input.version ?? "1.0.0",
  };
}

export function createReviewIssue(input: Omit<ReviewIssue, "id"> & Partial<Pick<ReviewIssue, "id">>): ReviewIssue {
  return {
    id: input.id ?? createEntityId("review_issue"),
    severity: input.severity,
    message: input.message,
    recommendation: input.recommendation,
  };
}


import { describe, expect, it } from "vitest";
import { createReview, createReviewIssue } from "./factory";
import { ReviewSchema, ReviewTargetTypeSchema } from "./schema";

describe("Review", () => {
  it("factory produces a schema-valid review", () => {
    const review = createReview({ targetType: "product", targetId: "product_1", status: "approved", score: 91 });
    expect(ReviewSchema.safeParse(review).success).toBe(true);
    expect(review.issues).toEqual([]);
  });

  it("rejects a score outside 0-100 (CLAUDE.md §66 gate thresholds assume a bounded scale)", () => {
    const review = createReview({ targetType: "architecture", targetId: "arch_1", status: "approved", score: 142 });
    expect(ReviewSchema.safeParse(review).success).toBe(false);
  });

  it("accepts 'prompt' as a target type (gap closed 2026-07-03, CLAUDE.md §16/§63 item 7)", () => {
    expect(ReviewTargetTypeSchema.safeParse("prompt").success).toBe(true);
  });

  it("still rejects an undocumented target type", () => {
    expect(ReviewTargetTypeSchema.safeParse("dataset").success).toBe(false);
  });

  it("createReviewIssue generates a prefixed id", () => {
    const issue = createReviewIssue({ severity: "blocking", message: "No evaluation strategy defined." });
    expect(issue.id.startsWith("review_issue_")).toBe(true);
  });
});

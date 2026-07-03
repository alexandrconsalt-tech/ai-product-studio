import type { EntityId, IsoDateTime, ReviewStatus, Version } from "@/entities/shared";

export type ReviewTargetType = "product" | "architecture" | "pipeline" | "run" | "project";

export type ReviewIssue = Readonly<{
  id: EntityId;
  severity: "low" | "medium" | "high" | "blocking";
  message: string;
  recommendation?: string;
}>;

export type Review = Readonly<{
  id: EntityId;
  targetType: ReviewTargetType;
  targetId: EntityId;
  status: ReviewStatus;
  score?: number;
  issues: readonly ReviewIssue[];
  reviewerModuleId?: EntityId;
  createdAt: IsoDateTime;
  version: Version;
}>;


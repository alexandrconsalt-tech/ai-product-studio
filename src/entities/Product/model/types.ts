import type { EntityId, IsoDateTime, LifecycleStatus, Version } from "@/entities/shared";

export type ProductIdea = Readonly<{
  statement: string;
  source?: string;
}>;

export type ProductProblem = Readonly<{
  statement: string;
  evidenceIds: readonly EntityId[];
}>;

export type ProductUser = Readonly<{
  id: EntityId;
  name: string;
  segment?: string;
}>;

export type ProductJTBD = Readonly<{
  statement: string;
  context?: string;
  desiredOutcome?: string;
}>;

export type ProductFeature = Readonly<{
  id: EntityId;
  name: string;
  description?: string;
  priority?: "low" | "medium" | "high";
}>;

export type ProductMetricCategory = "success" | "quality" | "cost" | "speed";

export type ProductMetric = Readonly<{
  name: string;
  target?: string;
  category?: ProductMetricCategory;
}>;

export type Product = Readonly<{
  id: EntityId;
  projectId: EntityId;
  status: LifecycleStatus;
  idea?: ProductIdea;
  discovery?: string;
  problem?: ProductProblem;
  users: readonly ProductUser[];
  jtbd: readonly ProductJTBD[];
  features: readonly ProductFeature[];
  mvp?: string;
  metrics: readonly ProductMetric[];
  prd?: string;
  frameworkIds: readonly EntityId[];
  valueProposition?: string;
  targetAudience?: string;
  userStory?: string;
  mainScenario?: string;
  mvpOut?: string;
  assumptions?: string;
  aiModels?: string;
  aiAgents?: string;
  aiPipelineNotes?: string;
  acceptanceCriteria?: string;
  roadmap?: string;
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: Version;
}>;


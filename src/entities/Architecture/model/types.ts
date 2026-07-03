import type { EntityId, IsoDateTime, LifecycleStatus, Version } from "@/entities/shared";

export type AiCapability = Readonly<{
  id: EntityId;
  name: string;
  description?: string;
  required: boolean;
}>;

export type AiComponent = Readonly<{
  id: EntityId;
  name: string;
  type: "rules_engine" | "workflow" | "llm" | "agent" | "rag" | "human_review" | "gateway";
  description?: string;
}>;

export type DataFlowItem = Readonly<{
  id: EntityId;
  source: string;
  target: string;
  dataType: string;
}>;

export type QualityRequirement = Readonly<{
  name: string;
  threshold?: string;
}>;

export type EvaluationRequirement = Readonly<{
  metric: string;
  method: string;
  threshold?: string;
}>;

export type Architecture = Readonly<{
  id: EntityId;
  projectId: EntityId;
  productId: EntityId;
  status: LifecycleStatus;
  capabilities: readonly AiCapability[];
  aiComponents: readonly AiComponent[];
  modelIds: readonly EntityId[];
  dataFlow: readonly DataFlowItem[];
  quality: readonly QualityRequirement[];
  evaluation: readonly EvaluationRequirement[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: Version;
}>;


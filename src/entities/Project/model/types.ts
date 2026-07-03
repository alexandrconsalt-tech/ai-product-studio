import type { EntityId, IsoDateTime, Version } from "@/entities/shared";

export type ProjectStatus = "draft" | "discovery" | "product_ready" | "architecture_ready" | "pipeline_ready" | "testing" | "completed" | "archived";

export type Project = Readonly<{
  id: EntityId;
  name: string;
  description?: string;
  status: ProjectStatus;
  productId?: EntityId;
  architectureId?: EntityId;
  pipelineId?: EntityId;
  playgroundRunIds: readonly EntityId[];
  reviewIds: readonly EntityId[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: Version;
}>;


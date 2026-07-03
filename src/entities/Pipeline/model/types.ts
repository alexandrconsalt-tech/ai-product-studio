import type { EntityId, IsoDateTime, LifecycleStatus, Version } from "@/entities/shared";
import type { Edge } from "@/entities/Edge/model/types";
import type { Node } from "@/entities/Node/model/types";

export type PipelineLayout = Readonly<{
  viewport?: Readonly<{
    x: number;
    y: number;
    zoom: number;
  }>;
}>;

export type Pipeline = Readonly<{
  id: EntityId;
  projectId: EntityId;
  architectureId: EntityId;
  status: LifecycleStatus;
  nodes: readonly Node[];
  edges: readonly Edge[];
  layout?: PipelineLayout;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  version: Version;
}>;


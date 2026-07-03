import type { EntityId, Version } from "@/entities/shared";

export type EdgeCondition = Readonly<{
  expression: string;
  description?: string;
}>;

export type Edge = Readonly<{
  id: EntityId;
  sourceNodeId: EntityId;
  targetNodeId: EntityId;
  sourcePortId?: EntityId;
  targetPortId?: EntityId;
  condition?: EdgeCondition;
  version: Version;
}>;


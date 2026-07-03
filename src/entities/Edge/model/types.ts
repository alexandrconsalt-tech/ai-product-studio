import type { EntityId, Version } from "@/entities/shared";

export type EdgeConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";

export type EdgeCondition = Readonly<{
  field: string;
  operator: EdgeConditionOperator;
  value: number;
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


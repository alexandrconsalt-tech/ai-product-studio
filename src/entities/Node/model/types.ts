import type { EntityId, Version } from "@/entities/shared";

export type NodeType = "agent" | "llm" | "function" | "router" | "tool" | "store" | "validation" | "human_review" | "input" | "output";

export type NodePosition = Readonly<{
  x: number;
  y: number;
}>;

export type NodePort = Readonly<{
  id: EntityId;
  name: string;
  schemaRef?: string;
}>;

export type Node = Readonly<{
  id: EntityId;
  type: NodeType;
  name: string;
  description?: string;
  inputPorts: readonly NodePort[];
  outputPorts: readonly NodePort[];
  modelId?: EntityId;
  promptId?: EntityId;
  temperature?: number;
  tools: readonly string[];
  metadata: Readonly<Record<string, string>>;
  position?: NodePosition;
  version: Version;
}>;

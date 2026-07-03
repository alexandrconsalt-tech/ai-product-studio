import type { EntityId, Version } from "@/entities/shared";

export type ModelProvider = "openai" | "anthropic" | "google" | "local" | "other";
export type ModelCapability = "classification" | "extraction" | "generation" | "reasoning" | "embedding" | "reranking" | "tool_use";

export type Model = Readonly<{
  id: EntityId;
  name: string;
  provider: ModelProvider;
  capabilities: readonly ModelCapability[];
  contextWindow?: number;
  version: Version;
}>;


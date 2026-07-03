import type { EntityId, LifecycleStatus, Version } from "@/entities/shared";

export type PromptPurpose = "instruction" | "evaluation" | "routing" | "extraction" | "generation" | "review";

export type Prompt = Readonly<{
  id: EntityId;
  name: string;
  purpose: PromptPurpose;
  description: string;
  status: LifecycleStatus;
  ownerModuleId?: EntityId;
  version: Version;
}>;


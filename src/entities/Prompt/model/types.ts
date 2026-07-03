import type { EntityId, Version } from "@/entities/shared";

export type PromptPurpose = "instruction" | "evaluation" | "routing" | "extraction" | "generation" | "review";

export type Prompt = Readonly<{
  id: EntityId;
  name: string;
  purpose: PromptPurpose;
  description: string;
  ownerModuleId?: EntityId;
  version: Version;
}>;


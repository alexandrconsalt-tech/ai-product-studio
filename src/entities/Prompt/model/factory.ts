import { createEntityId } from "@/entities/shared";
import type { Prompt } from "./types";

export function createPrompt(input: Omit<Prompt, "id" | "version"> & Partial<Pick<Prompt, "id" | "version">>): Prompt {
  return {
    id: input.id ?? createEntityId("prompt"),
    name: input.name,
    purpose: input.purpose,
    description: input.description,
    ownerModuleId: input.ownerModuleId,
    version: input.version ?? "1.0.0",
  };
}


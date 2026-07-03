import { createEntityId } from "@/entities/shared";
import type { Framework } from "./types";

export function createFramework(input: Omit<Framework, "id" | "version"> & Partial<Pick<Framework, "id" | "version">>): Framework {
  return {
    id: input.id ?? createEntityId("framework"),
    name: input.name,
    category: input.category,
    source: input.source,
    version: input.version ?? "1.0.0",
  };
}


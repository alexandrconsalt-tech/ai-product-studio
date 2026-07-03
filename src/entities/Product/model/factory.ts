import { createEntityId, createTimestamp } from "@/entities/shared";
import type { Product } from "./types";

export function createProduct(
  input: Omit<Product, "id" | "status" | "users" | "jtbd" | "features" | "metrics" | "frameworkIds" | "createdAt" | "updatedAt" | "version"> &
    Partial<Pick<Product, "id" | "status" | "users" | "jtbd" | "features" | "metrics" | "frameworkIds" | "createdAt" | "updatedAt" | "version">>,
): Product {
  const now = createTimestamp();

  return {
    id: input.id ?? createEntityId("product"),
    projectId: input.projectId,
    status: input.status ?? "draft",
    idea: input.idea,
    discovery: input.discovery,
    problem: input.problem,
    users: input.users ?? [],
    jtbd: input.jtbd ?? [],
    features: input.features ?? [],
    mvp: input.mvp,
    metrics: input.metrics ?? [],
    prd: input.prd,
    frameworkIds: input.frameworkIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    version: input.version ?? "1.0.0",
  };
}


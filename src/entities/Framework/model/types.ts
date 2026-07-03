import type { EntityId, Version } from "@/entities/shared";

export type FrameworkCategory =
  | "product_discovery"
  | "prioritization"
  | "metrics"
  | "ai_engineering"
  | "architecture"
  | "evaluation";

export type Framework = Readonly<{
  id: EntityId;
  name: string;
  category: FrameworkCategory;
  source: string;
  version: Version;
}>;


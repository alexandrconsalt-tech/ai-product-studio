import type { Architecture } from "@/entities/Architecture/model/types";
import type { Framework } from "@/entities/Framework/model/types";
import type { KnowledgeModule } from "@/entities/KnowledgeModule/model/types";
import type { Model } from "@/entities/Model/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Product } from "@/entities/Product/model/types";
import type { Project } from "@/entities/Project/model/types";
import type { Prompt } from "@/entities/Prompt/model/types";
import type { Review } from "@/entities/Review/model/types";
import type { Run } from "@/entities/Run/model/types";

export type RepositorySnapshot = Readonly<{
  projects: readonly Project[];
  products: readonly Product[];
  architectures: readonly Architecture[];
  pipelines: readonly Pipeline[];
  runs: readonly Run[];
  reviews: readonly Review[];
  frameworks: readonly Framework[];
  knowledgeModules: readonly KnowledgeModule[];
  models: readonly Model[];
  prompts: readonly Prompt[];
}>;

export type ProjectRepository = Readonly<{
  load(): RepositorySnapshot;
  save(snapshot: RepositorySnapshot): void;
  reset(): RepositorySnapshot;
  upsertProject(snapshot: RepositorySnapshot, project: Project): RepositorySnapshot;
  deleteProject(snapshot: RepositorySnapshot, projectId: string): RepositorySnapshot;
  upsertProduct(snapshot: RepositorySnapshot, product: Product): RepositorySnapshot;
  upsertArchitecture(snapshot: RepositorySnapshot, architecture: Architecture): RepositorySnapshot;
  upsertPipeline(snapshot: RepositorySnapshot, pipeline: Pipeline): RepositorySnapshot;
  upsertRun(snapshot: RepositorySnapshot, run: Run): RepositorySnapshot;
}>;

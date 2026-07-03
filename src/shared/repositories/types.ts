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

/**
 * `load`/`save`/`reset` are the only methods the current Zustand stores call
 * (via `useRepositoryStore`) — they operate on the whole `RepositorySnapshot`,
 * which is cheap for a client-held, Local-Storage-backed repository.
 *
 * `upsertProject`/`deleteProject`/`upsertProduct`/`upsertArchitecture`/
 * `upsertPipeline`/`upsertRun` are intentionally part of this interface even
 * though no store calls them today. They are the per-entity mutation contract
 * a future network-backed `ProjectRepository` implementation (§8.7 of
 * CLAUDE.md) should expose, so a backend swap doesn't require sending the
 * entire snapshot on every mutation. Do not delete them as "dead code" — they
 * are forward-compatibility surface, not accidental duplication. Do not add a
 * second, third mutation method for the same entity either; if a store needs
 * a new mutation, add it here once, in this per-entity shape.
 *
 * CLAUDE.md §63 debt item 5 tracks migrating the stores to call these methods
 * once a real backend exists — deferred deliberately rather than done now,
 * since rewriting every store's snapshot-manipulation logic against a
 * Local-Storage-only backend would add complexity with no present benefit
 * (CLAUDE.md §2 principle 6, simplicity first).
 */
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

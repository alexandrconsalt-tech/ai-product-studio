import { ArchitectureSchema } from "@/entities/Architecture/model/schema";
import { FrameworkSchema } from "@/entities/Framework/model/schema";
import { KnowledgeModuleSchema } from "@/entities/KnowledgeModule/model/schema";
import { ModelSchema } from "@/entities/Model/model/schema";
import { PipelineSchema } from "@/entities/Pipeline/model/schema";
import { ProductSchema } from "@/entities/Product/model/schema";
import { ProjectSchema } from "@/entities/Project/model/schema";
import { PromptSchema } from "@/entities/Prompt/model/schema";
import { ReviewSchema } from "@/entities/Review/model/schema";
import { RunSchema } from "@/entities/Run/model/schema";
import { z } from "zod";
import { demoSnapshot } from "./demo-data";
import type { ProjectRepository, RepositorySnapshot } from "./types";

const STORAGE_KEY = "ai-product-studio.repository.v1";

const RepositorySnapshotSchema = z.object({
  projects: z.array(ProjectSchema).readonly(),
  products: z.array(ProductSchema).readonly(),
  architectures: z.array(ArchitectureSchema).readonly(),
  pipelines: z.array(PipelineSchema).readonly(),
  runs: z.array(RunSchema).readonly(),
  reviews: z.array(ReviewSchema).readonly(),
  frameworks: z.array(FrameworkSchema).readonly(),
  knowledgeModules: z.array(KnowledgeModuleSchema).readonly(),
  models: z.array(ModelSchema).readonly(),
  prompts: z.array(PromptSchema).readonly(),
});

const cloneSnapshot = (snapshot: RepositorySnapshot): RepositorySnapshot => RepositorySnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)));

export class LocalStorageProjectRepository implements ProjectRepository {
  load(): RepositorySnapshot {
    if (typeof window === "undefined") {
      return cloneSnapshot(demoSnapshot);
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = cloneSnapshot(demoSnapshot);
      this.save(seeded);
      return seeded;
    }

    const parsed: unknown = JSON.parse(raw);
    return RepositorySnapshotSchema.parse(parsed);
  }

  save(snapshot: RepositorySnapshot): void {
    if (typeof window === "undefined") {
      return;
    }

    const validated = RepositorySnapshotSchema.parse(snapshot);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }

  reset(): RepositorySnapshot {
    const seeded = cloneSnapshot(demoSnapshot);
    this.save(seeded);
    return seeded;
  }

  upsertProject(snapshot: RepositorySnapshot, project: RepositorySnapshot["projects"][number]): RepositorySnapshot {
    const exists = snapshot.projects.some((item) => item.id === project.id);
    return {
      ...snapshot,
      projects: exists ? snapshot.projects.map((item) => (item.id === project.id ? project : item)) : [project, ...snapshot.projects],
    };
  }

  deleteProject(snapshot: RepositorySnapshot, projectId: string): RepositorySnapshot {
    return {
      ...snapshot,
      projects: snapshot.projects.filter((project) => project.id !== projectId),
      products: snapshot.products.filter((product) => product.projectId !== projectId),
      architectures: snapshot.architectures.filter((architecture) => architecture.projectId !== projectId),
      pipelines: snapshot.pipelines.filter((pipeline) => pipeline.projectId !== projectId),
    };
  }

  upsertProduct(snapshot: RepositorySnapshot, product: RepositorySnapshot["products"][number]): RepositorySnapshot {
    const exists = snapshot.products.some((item) => item.id === product.id);
    return {
      ...snapshot,
      products: exists ? snapshot.products.map((item) => (item.id === product.id ? product : item)) : [product, ...snapshot.products],
    };
  }

  upsertArchitecture(snapshot: RepositorySnapshot, architecture: RepositorySnapshot["architectures"][number]): RepositorySnapshot {
    const exists = snapshot.architectures.some((item) => item.id === architecture.id);
    return {
      ...snapshot,
      architectures: exists ? snapshot.architectures.map((item) => (item.id === architecture.id ? architecture : item)) : [architecture, ...snapshot.architectures],
    };
  }

  upsertPipeline(snapshot: RepositorySnapshot, pipeline: RepositorySnapshot["pipelines"][number]): RepositorySnapshot {
    const exists = snapshot.pipelines.some((item) => item.id === pipeline.id);
    return {
      ...snapshot,
      pipelines: exists ? snapshot.pipelines.map((item) => (item.id === pipeline.id ? pipeline : item)) : [pipeline, ...snapshot.pipelines],
    };
  }

  upsertRun(snapshot: RepositorySnapshot, run: RepositorySnapshot["runs"][number]): RepositorySnapshot {
    const exists = snapshot.runs.some((item) => item.id === run.id);
    return {
      ...snapshot,
      runs: exists ? snapshot.runs.map((item) => (item.id === run.id ? run : item)) : [run, ...snapshot.runs],
    };
  }
}

export const projectRepository: ProjectRepository = new LocalStorageProjectRepository();

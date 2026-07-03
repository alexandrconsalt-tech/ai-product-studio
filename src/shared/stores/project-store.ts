"use client";

import { create } from "zustand";
import { createProject } from "@/entities/Project/model/factory";
import type { Project } from "@/entities/Project/model/types";
import { createProduct } from "@/entities/Product/model/factory";
import { createTimestamp } from "@/entities/shared";
import { useRepositoryStore } from "./repository-store";

type ProjectStore = Readonly<{
  createProject: (name: string, description?: string) => Project;
  updateProjectDetails: (projectId: string, input: Readonly<{ name: string; description?: string }>) => void;
  deleteProject: (projectId: string) => void;
  duplicateProject: (projectId: string, input?: Readonly<{ name?: string; description?: string }>) => Project | null;
}>;

export const useProjectStore = create<ProjectStore>(() => ({
  createProject: (name, description) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot ?? { projects: [], products: [], architectures: [], pipelines: [], runs: [], reviews: [], frameworks: [], knowledgeModules: [], models: [], prompts: [] };
    const project = createProject({ name, description });
    const product = createProduct({ projectId: project.id, idea: description ? { statement: description, source: "Project description" } : undefined });
    const nextProject: Project = { ...project, productId: product.id };
    repository.setSnapshot({ ...snapshot, projects: [nextProject, ...snapshot.projects], products: [product, ...snapshot.products] });
    repository.selectProject(nextProject.id);
    return nextProject;
  },
  updateProjectDetails: (projectId, input) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    if (!snapshot) return;
    repository.setSnapshot({
      ...snapshot,
      projects: snapshot.projects.map((project) =>
        project.id === projectId ? { ...project, name: input.name, description: input.description, updatedAt: createTimestamp() } : project,
      ),
    });
  },
  deleteProject: (projectId) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    if (!snapshot) return;

    const removedProducts = snapshot.products.filter((product) => product.projectId === projectId);
    const removedArchitectures = snapshot.architectures.filter((architecture) => architecture.projectId === projectId);
    const removedPipelines = snapshot.pipelines.filter((pipeline) => pipeline.projectId === projectId);
    const removedPipelineIds = new Set(removedPipelines.map((pipeline) => pipeline.id));
    const removedRuns = snapshot.runs.filter((run) => removedPipelineIds.has(run.pipelineId));

    // Every id that no longer has an owning aggregate once the project is deleted.
    // Reviews target one of these via `targetId` (§9.3 ENTITY_RELATIONSHIPS) and must be
    // removed alongside them, otherwise they become orphaned records (CLAUDE.md §63 debt item 4).
    const removedTargetIds = new Set<string>([
      projectId,
      ...removedProducts.map((product) => product.id),
      ...removedArchitectures.map((architecture) => architecture.id),
      ...removedPipelines.map((pipeline) => pipeline.id),
      ...removedRuns.map((run) => run.id),
    ]);

    repository.setSnapshot({
      ...snapshot,
      projects: snapshot.projects.filter((project) => project.id !== projectId),
      products: snapshot.products.filter((product) => product.projectId !== projectId),
      architectures: snapshot.architectures.filter((architecture) => architecture.projectId !== projectId),
      pipelines: snapshot.pipelines.filter((pipeline) => pipeline.projectId !== projectId),
      runs: snapshot.runs.filter((run) => !removedPipelineIds.has(run.pipelineId)),
      reviews: snapshot.reviews.filter((review) => !removedTargetIds.has(review.targetId)),
    });
  },
  duplicateProject: (projectId, input) => {
    const repository = useRepositoryStore.getState();
    const snapshot = repository.snapshot;
    const source = snapshot?.projects.find((project) => project.id === projectId);
    if (!snapshot || !source) return null;
    const duplicate = createProject({ name: input?.name ?? `${source.name} Copy`, description: input?.description ?? source.description, status: "draft" });
    repository.setSnapshot({ ...snapshot, projects: [duplicate, ...snapshot.projects] });
    repository.selectProject(duplicate.id);
    return duplicate;
  },
}));

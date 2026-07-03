import { describe, expect, it } from "vitest";
import { createArchitecture } from "@/entities/Architecture/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { createProduct } from "@/entities/Product/model/factory";
import { createProject } from "@/entities/Project/model/factory";
import { createReview } from "@/entities/Review/model/factory";
import { createRun } from "@/entities/Run/model/factory";
import { LocalStorageProjectRepository } from "./local-storage-repository";
import type { RepositorySnapshot } from "./types";

function emptySnapshot(): RepositorySnapshot {
  return {
    projects: [],
    products: [],
    architectures: [],
    pipelines: [],
    runs: [],
    reviews: [],
    frameworks: [],
    knowledgeModules: [],
    models: [],
    prompts: [],
  };
}

describe("LocalStorageProjectRepository.deleteProject", () => {
  it("cascades to remove Run and Review records, not just Product/Architecture/Pipeline (CLAUDE.md §63 debt item 4)", () => {
    const repo = new LocalStorageProjectRepository();

    const project = createProject({ name: "AI Call Analysis" });
    const product = createProduct({ projectId: project.id });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id });
    const run = createRun({ pipelineId: pipeline.id, input: "transcript" });

    const projectReview = createReview({ targetType: "project", targetId: project.id, status: "approved", score: 90 });
    const productReview = createReview({ targetType: "product", targetId: product.id, status: "approved", score: 91 });
    const architectureReview = createReview({ targetType: "architecture", targetId: architecture.id, status: "approved", score: 93 });
    const pipelineReview = createReview({ targetType: "pipeline", targetId: pipeline.id, status: "approved", score: 89 });
    const runReview = createReview({ targetType: "run", targetId: run.id, status: "approved", score: 88 });

    // An unrelated project + review that must survive the deletion untouched.
    const otherProject = createProject({ name: "Unrelated" });
    const otherReview = createReview({ targetType: "project", targetId: otherProject.id, status: "not_reviewed" });

    const snapshot: RepositorySnapshot = {
      ...emptySnapshot(),
      projects: [project, otherProject],
      products: [product],
      architectures: [architecture],
      pipelines: [pipeline],
      runs: [run],
      reviews: [projectReview, productReview, architectureReview, pipelineReview, runReview, otherReview],
    };

    const next = repo.deleteProject(snapshot, project.id);

    expect(next.projects.map((p) => p.id)).toEqual([otherProject.id]);
    expect(next.products).toHaveLength(0);
    expect(next.architectures).toHaveLength(0);
    expect(next.pipelines).toHaveLength(0);
    expect(next.runs).toHaveLength(0);
    // Only the review targeting the surviving, unrelated project remains.
    expect(next.reviews.map((r) => r.id)).toEqual([otherReview.id]);
  });

  it("does not remove a Run/Review belonging to a pipeline of a different project", () => {
    const repo = new LocalStorageProjectRepository();

    const project = createProject({ name: "A" });
    const otherProject = createProject({ name: "B" });
    const otherArchitecture = createArchitecture({ projectId: otherProject.id, productId: "product_other" });
    const otherPipeline = createPipeline({ projectId: otherProject.id, architectureId: otherArchitecture.id });
    const otherRun = createRun({ pipelineId: otherPipeline.id, input: "x" });
    const otherRunReview = createReview({ targetType: "run", targetId: otherRun.id, status: "approved", score: 80 });

    const snapshot: RepositorySnapshot = {
      ...emptySnapshot(),
      projects: [project, otherProject],
      architectures: [otherArchitecture],
      pipelines: [otherPipeline],
      runs: [otherRun],
      reviews: [otherRunReview],
    };

    const next = repo.deleteProject(snapshot, project.id);

    expect(next.pipelines).toHaveLength(1);
    expect(next.runs).toHaveLength(1);
    expect(next.reviews).toHaveLength(1);
  });
});

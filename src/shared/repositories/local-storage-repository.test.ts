import { afterEach, describe, expect, it, vi } from "vitest";
import { createEdge } from "@/entities/Edge/model/factory";
import { createArchitecture } from "@/entities/Architecture/model/factory";
import { createPipeline } from "@/entities/Pipeline/model/factory";
import { createProduct } from "@/entities/Product/model/factory";
import { createProject } from "@/entities/Project/model/factory";
import { createReview } from "@/entities/Review/model/factory";
import { createRun } from "@/entities/Run/model/factory";
import { LocalStorageProjectRepository } from "./local-storage-repository";
import type { RepositorySnapshot } from "./types";

const STORAGE_KEY = "ai-product-studio.repository.v1";
const BACKUP_STORAGE_KEY = "ai-product-studio.repository.invalid-backup.v1";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLocalStorage(initial: Readonly<Record<string, string>> = {}) {
  const values = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  return values;
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

describe("LocalStorageProjectRepository.load", () => {
  it("migrates legacy React Flow edge fields from localStorage before schema validation", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ name: "Legacy" });
    const product = createProduct({ projectId: project.id });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id });
    const edge = createEdge({ sourceNodeId: "node_a", targetNodeId: "node_b" });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id, edges: [edge] });
    const legacySnapshot = {
      ...emptySnapshot(),
      projects: [project],
      products: [product],
      architectures: [architecture],
      pipelines: [
        {
          ...pipeline,
          edges: [{ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId }],
        },
      ],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();
    const migratedPipeline = loaded.pipelines.find((item) => item.id === pipeline.id);

    expect(migratedPipeline?.edges[0]).toMatchObject({
      id: edge.id,
      sourceNodeId: "node_a",
      targetNodeId: "node_b",
      version: "1.0.0",
    });
  });

  it("drops malformed legacy edges that cannot be migrated", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ name: "Legacy malformed" });
    const product = createProduct({ projectId: project.id });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id });
    const edge = createEdge({ sourceNodeId: "node_a", targetNodeId: "node_b" });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id, edges: [edge] });
    const legacySnapshot = {
      ...emptySnapshot(),
      projects: [project],
      products: [product],
      architectures: [architecture],
      pipelines: [
        {
          ...pipeline,
          edges: [
            { id: "broken_edge", source: null, target: { label: "not-an-id" } },
            { id: "bad_condition", source: edge.sourceNodeId, target: edge.targetNodeId, condition: { field: "", operator: "contains", value: "x" } },
            { id: edge.id, source: { id: edge.sourceNodeId }, target: { id: edge.targetNodeId } },
          ],
        },
      ],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();
    const migratedPipeline = loaded.pipelines.find((item) => item.id === pipeline.id);

    expect(migratedPipeline?.edges).toHaveLength(1);
    expect(migratedPipeline?.edges[0]).toMatchObject({
      id: edge.id,
      sourceNodeId: "node_a",
      targetNodeId: "node_b",
    });
  });

  it("synthesizes a valid edge id when a legacy edge id is not a string", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ name: "Legacy edge id" });
    const product = createProduct({ projectId: project.id });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id });
    const edge = createEdge({ sourceNodeId: "node_a", targetNodeId: "node_b" });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id, edges: [edge] });
    const legacySnapshot = {
      ...emptySnapshot(),
      projects: [project],
      products: [product],
      architectures: [architecture],
      pipelines: [
        {
          ...pipeline,
          edges: [{ id: { value: edge.id }, source: edge.sourceNodeId, target: edge.targetNodeId }],
        },
      ],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();
    const migratedPipeline = loaded.pipelines.find((item) => item.id === pipeline.id);

    expect(migratedPipeline?.edges[0]).toMatchObject({
      id: "edge_node_a_node_b_0",
      sourceNodeId: "node_a",
      targetNodeId: "node_b",
    });
  });

  it("normalizes legacy Run array fields before schema validation", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ name: "Legacy run" });
    const product = createProduct({ projectId: project.id });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id });
    const run = createRun({ pipelineId: pipeline.id, input: "transcript", evidence: ["valid evidence"] });
    const legacySnapshot = {
      ...emptySnapshot(),
      projects: [project],
      products: [product],
      architectures: [architecture],
      pipelines: [pipeline],
      runs: [
        {
          ...run,
          metrics: null,
          evidence: { quote: "not-an-array" },
          logs: undefined,
        },
      ],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();

    expect(loaded.runs[0]).toMatchObject({
      id: run.id,
      metrics: [],
      evidence: [],
      logs: [],
    });
  });

  it("normalizes legacy status values before schema validation", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ name: "Legacy statuses", status: "draft" });
    const product = createProduct({ projectId: project.id, status: "draft" });
    const architecture = createArchitecture({ projectId: project.id, productId: product.id, status: "draft" });
    const pipeline = createPipeline({ projectId: project.id, architectureId: architecture.id, status: "draft" });
    const run = createRun({ pipelineId: pipeline.id, input: "x", status: "queued" });
    const review = createReview({ targetType: "pipeline", targetId: pipeline.id, status: "not_reviewed" });
    const legacySnapshot = {
      ...emptySnapshot(),
      projects: [{ ...project, status: "in_progress" }],
      products: [{ ...product, status: "testing" }],
      architectures: [{ ...architecture, status: "product_ready" }],
      pipelines: [{ ...pipeline, status: "testing" }],
      runs: [{ ...run, status: "success" }],
      reviews: [{ ...review, status: "pending" }],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();
    const loadedProject = loaded.projects.find((item) => item.id === project.id);
    const loadedProduct = loaded.products.find((item) => item.id === product.id);
    const loadedArchitecture = loaded.architectures.find((item) => item.id === architecture.id);
    const loadedPipeline = loaded.pipelines.find((item) => item.id === pipeline.id);
    const loadedRun = loaded.runs.find((item) => item.id === run.id);
    const loadedReview = loaded.reviews.find((item) => item.id === review.id);

    expect(loadedProject?.status).toBe("discovery");
    expect(loadedProduct?.status).toBe("ready");
    expect(loadedArchitecture?.status).toBe("ready");
    expect(loadedPipeline?.status).toBe("ready");
    expect(loadedRun?.status).toBe("succeeded");
    expect(loadedReview?.status).toBe("not_reviewed");
  });

  it("backs up and reseeds when a stored snapshot cannot be migrated", () => {
    const repo = new LocalStorageProjectRepository();
    const invalidSnapshot = {
      ...emptySnapshot(),
      projects: [{ id: "", name: "", status: "unknown", playgroundRunIds: "bad", reviewIds: "bad", createdAt: "bad", updatedAt: "bad", version: "" }],
    };
    const stored = stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(invalidSnapshot) });

    const loaded = repo.load();

    expect(stored.get(BACKUP_STORAGE_KEY)).toBe(JSON.stringify(invalidSnapshot));
    expect(loaded.projects.length).toBeGreaterThan(0);
    expect(loaded.products.length).toBeGreaterThan(0);
    expect(loaded.pipelines.length).toBeGreaterThan(0);
  });
});

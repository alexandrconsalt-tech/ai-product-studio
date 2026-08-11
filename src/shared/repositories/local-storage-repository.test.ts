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
const TRANSCRIPTION_SUMMARY_PROJECT_ID = "project_transcription_summary_module";
const TRANSCRIPTION_SUMMARY_PRODUCT_ID = "product_transcription_summary_module";
const TRANSCRIPTION_SUMMARY_NAME = "Модуль транскрибации и AI-саммари звонков";
const SUMMARY_V2_PROJECT_ID = "project_summary_pipeline_v2";
const SUMMARY_V2_PRODUCT_ID = "product_summary_pipeline_v2";
const APPLICATION_ATTRIBUTES_PROJECT_ID = "project_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const APPLICATION_ATTRIBUTES_PRODUCT_ID = "product_72f7b30d-0d09-49fd-81b7-82a8b8f88c4f";
const AI_SUMMARY_TEN_AUGUST_PROJECT_ID = "project_ai_summary_2026_08_10";
const AI_SUMMARY_TEN_AUGUST_PRODUCT_ID = "product_ai_summary_2026_08_10";

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

describe("LocalStorageProjectRepository retired demo project pruning", () => {
  it("removes retired demo projects (and their products/architectures/pipelines/runs/reviews) from an already-persisted snapshot on load", () => {
    const repo = new LocalStorageProjectRepository();

    const retiredIds = ["project_demo_call_analysis", "project_demo_lead_qualification", "project_demo_chat_classification", "project_ad_copy_generation", "project_demo_pipeline_lab_v3"];
    const retiredProjects = retiredIds.map((id) => createProject({ name: id, id }));
    const retiredProducts = retiredProjects.map((project) => createProduct({ projectId: project.id }));
    const retiredArchitectures = retiredProjects.map((project, i) => createArchitecture({ projectId: project.id, productId: retiredProducts[i].id }));
    const retiredPipelines = retiredProjects.map((project, i) => createPipeline({ projectId: project.id, architectureId: retiredArchitectures[i].id }));
    const retiredRuns = retiredPipelines.map((pipeline) => createRun({ pipelineId: pipeline.id, input: "x" }));
    const retiredReviews = retiredProjects.map((project) => createReview({ targetType: "project", targetId: project.id, status: "approved", score: 90 }));

    const keptProject = createProject({ name: TRANSCRIPTION_SUMMARY_NAME, id: TRANSCRIPTION_SUMMARY_PROJECT_ID });
    const keptProduct = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: keptProject.id });

    const legacySnapshot: RepositorySnapshot = {
      ...emptySnapshot(),
      projects: [...retiredProjects, keptProject],
      products: [...retiredProducts, keptProduct],
      architectures: retiredArchitectures,
      pipelines: retiredPipelines,
      runs: retiredRuns,
      reviews: retiredReviews,
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();

    const loadedIds = loaded.projects.map((project) => project.id);
    for (const retiredId of retiredIds) expect(loadedIds).not.toContain(retiredId);
    expect(loadedIds).toContain(keptProject.id);
    expect(loaded.products.some((product) => product.projectId === keptProject.id)).toBe(true);
    expect(loaded.pipelines).toHaveLength(0);
    expect(loaded.runs).toHaveLength(0);
    expect(loaded.reviews).toHaveLength(0);
  });

  it("preserves a persisted user product and adds recovery products without duplicates", () => {
    const repo = new LocalStorageProjectRepository();
    const userProject = createProject({ name: "My Own Product" });
    const userProduct = createProduct({ projectId: userProject.id, notes: "user metadata" });
    const userArchitecture = createArchitecture({ projectId: userProject.id, productId: userProduct.id });
    const userPipeline = createPipeline({ projectId: userProject.id, architectureId: userArchitecture.id });
    const userRun = createRun({ pipelineId: userPipeline.id, input: "saved transcript" });
    const legacySnapshot: RepositorySnapshot = { ...emptySnapshot(), projects: [{ ...userProject, productId: userProduct.id }], products: [userProduct], architectures: [userArchitecture], pipelines: [userPipeline], runs: [userRun] };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(legacySnapshot) });

    const loaded = repo.load();

    expect(loaded.projects.map((project) => project.id)).toEqual([TRANSCRIPTION_SUMMARY_PROJECT_ID, userProject.id, SUMMARY_V2_PROJECT_ID, APPLICATION_ATTRIBUTES_PROJECT_ID, AI_SUMMARY_TEN_AUGUST_PROJECT_ID]);
    expect(loaded.products.map((product) => product.id)).toEqual([TRANSCRIPTION_SUMMARY_PRODUCT_ID, userProduct.id, SUMMARY_V2_PRODUCT_ID, APPLICATION_ATTRIBUTES_PRODUCT_ID, AI_SUMMARY_TEN_AUGUST_PRODUCT_ID]);
    expect(loaded.architectures).toEqual([userArchitecture]);
    expect(loaded.pipelines).toEqual([userPipeline]);
    expect(loaded.runs).toEqual([userRun]);
    expect(loaded.projects.find((project) => project.id === APPLICATION_ATTRIBUTES_PROJECT_ID)?.name).toBe("AI Атрибуты в Заявке");
    expect(loaded.projects.find((project) => project.id === AI_SUMMARY_TEN_AUGUST_PROJECT_ID)?.name).toBe("AI Summary 10.08");

    repo.save({
      ...loaded,
      projects: loaded.projects.map((project) => (project.id === userProject.id ? { ...project, name: "Renamed User Product" } : project)),
    });
    const reloaded = repo.load();
    expect(reloaded.projects.find((project) => project.id === userProject.id)?.name).toBe("Renamed User Product");
    expect(reloaded.projects.filter((project) => project.id === AI_SUMMARY_TEN_AUGUST_PROJECT_ID)).toHaveLength(1);
    expect(reloaded.products.filter((product) => product.id === AI_SUMMARY_TEN_AUGUST_PRODUCT_ID)).toHaveLength(1);
    expect(reloaded.pipelines).toEqual([userPipeline]);
  });
});

describe("LocalStorageProjectRepository transcription products seed", () => {
  it("keeps v1 and independent v2 products and preserves v1 saved settings", () => {
    const repo = new LocalStorageProjectRepository();
    const originalProjectRenamedByMistake = createProject({
      id: "project_transcription_summary_module",
      name: "Summary NEW",
      description: "Сохранённое описание исходного продукта",
      playgroundRunIds: ["playground_run_existing"],
    });
    const originalProduct = createProduct({
      id: "product_transcription_summary_module",
      projectId: originalProjectRenamedByMistake.id,
      notes: "Сохранённые настройки исходного продукта",
      aiModels: "gpt-5-mini",
    });
    const summaryNewProject = createProject({ id: "project_summary_new", name: "Summary NEW" });
    const summaryNewProduct = createProduct({ id: "product_summary_new", projectId: summaryNewProject.id });
    const otherProject = createProject({ name: "Другой продукт" });
    const otherProduct = createProduct({ projectId: otherProject.id });
    const snapshot: RepositorySnapshot = {
      ...emptySnapshot(),
      projects: [{ ...originalProjectRenamedByMistake, productId: originalProduct.id }, summaryNewProject, otherProject],
      products: [originalProduct, summaryNewProduct, otherProduct],
    };

    stubLocalStorage({ [STORAGE_KEY]: JSON.stringify(snapshot) });

    const loaded = repo.load();

    expect(loaded.projects.find((project) => project.id === originalProjectRenamedByMistake.id)).toEqual({
      ...originalProjectRenamedByMistake,
      productId: originalProduct.id,
      name: "Модуль транскрибации и AI-саммари звонков",
    });
    expect(loaded.products.find((product) => product.id === originalProduct.id)).toEqual(originalProduct);
    expect(loaded.projects.map((project) => project.id)).toEqual([TRANSCRIPTION_SUMMARY_PROJECT_ID, summaryNewProject.id, otherProject.id, SUMMARY_V2_PROJECT_ID, APPLICATION_ATTRIBUTES_PROJECT_ID, AI_SUMMARY_TEN_AUGUST_PROJECT_ID]);
    expect(loaded.products.map((product) => product.id)).toEqual([TRANSCRIPTION_SUMMARY_PRODUCT_ID, summaryNewProduct.id, otherProduct.id, SUMMARY_V2_PRODUCT_ID, APPLICATION_ATTRIBUTES_PRODUCT_ID, AI_SUMMARY_TEN_AUGUST_PRODUCT_ID]);
  });
});

describe("LocalStorageProjectRepository.load", () => {
  it("migrates legacy React Flow edge fields from localStorage before schema validation", () => {
    const repo = new LocalStorageProjectRepository();
    const project = createProject({ id: TRANSCRIPTION_SUMMARY_PROJECT_ID, name: TRANSCRIPTION_SUMMARY_NAME });
    const product = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: project.id });
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
    const project = createProject({ id: TRANSCRIPTION_SUMMARY_PROJECT_ID, name: TRANSCRIPTION_SUMMARY_NAME });
    const product = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: project.id });
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
    const project = createProject({ id: TRANSCRIPTION_SUMMARY_PROJECT_ID, name: TRANSCRIPTION_SUMMARY_NAME });
    const product = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: project.id });
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
    const project = createProject({ id: TRANSCRIPTION_SUMMARY_PROJECT_ID, name: TRANSCRIPTION_SUMMARY_NAME });
    const product = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: project.id });
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
    const project = createProject({ id: TRANSCRIPTION_SUMMARY_PROJECT_ID, name: TRANSCRIPTION_SUMMARY_NAME, status: "draft" });
    const product = createProduct({ id: TRANSCRIPTION_SUMMARY_PRODUCT_ID, projectId: project.id, status: "draft" });
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
    expect(loaded.projects.map((project) => project.id)).toEqual([TRANSCRIPTION_SUMMARY_PROJECT_ID, SUMMARY_V2_PROJECT_ID, APPLICATION_ATTRIBUTES_PROJECT_ID, AI_SUMMARY_TEN_AUGUST_PROJECT_ID]);
    expect(loaded.products.map((product) => product.id)).toEqual([TRANSCRIPTION_SUMMARY_PRODUCT_ID, SUMMARY_V2_PRODUCT_ID, APPLICATION_ATTRIBUTES_PRODUCT_ID, AI_SUMMARY_TEN_AUGUST_PRODUCT_ID]);
    expect(loaded.pipelines).toHaveLength(0);
  });
});

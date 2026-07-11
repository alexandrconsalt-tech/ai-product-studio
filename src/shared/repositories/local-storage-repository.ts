import { ArchitectureSchema } from "@/entities/Architecture/model/schema";
import { EdgeSchema } from "@/entities/Edge/model/schema";
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
const BACKUP_STORAGE_KEY = "ai-product-studio.repository.invalid-backup.v1";
const TRANSCRIPTION_SUMMARY_PROJECT_ID = "project_transcription_summary_module";
const TRANSCRIPTION_SUMMARY_PRODUCT_ID = "product_transcription_summary_module";
const TRANSCRIPTION_SUMMARY_NAME = "Модуль транскрибации и AI-саммари звонков";
const TRANSCRIPTION_SUMMARY_CREATED_AT = "2026-07-08T00:00:00.000Z";

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickEntityId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  const record = asRecord(value);
  return typeof record?.id === "string" && record.id.trim() ? record.id : undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeLifecycleStatus(value: unknown): string {
  const status = pickString(value);
  if (status === "draft" || status === "in_progress" || status === "review" || status === "ready" || status === "completed" || status === "archived") return status;
  if (status === "discovery" || status === "product_ready" || status === "architecture_ready" || status === "pipeline_ready" || status === "testing") return "ready";
  if (status === "approved" || status === "published" || status === "active") return "ready";
  if (status === "pending" || status === "not_started") return "draft";
  if (status === "requires_changes" || status === "needs_review") return "review";
  return "draft";
}

function normalizeProjectStatus(value: unknown): string {
  const status = pickString(value);
  if (status === "draft" || status === "discovery" || status === "product_ready" || status === "architecture_ready" || status === "pipeline_ready" || status === "testing" || status === "completed" || status === "archived") return status;
  if (status === "in_progress") return "discovery";
  if (status === "review") return "testing";
  if (status === "ready") return "pipeline_ready";
  if (status === "approved" || status === "published" || status === "active") return "completed";
  return "draft";
}

function normalizeReviewStatus(value: unknown): string {
  const status = pickString(value);
  if (status === "not_reviewed" || status === "approved" || status === "requires_changes" || status === "rejected") return status;
  if (status === "ready" || status === "completed" || status === "accepted") return "approved";
  if (status === "review" || status === "pending" || status === "draft") return "not_reviewed";
  if (status === "changes_requested" || status === "needs_review") return "requires_changes";
  return "not_reviewed";
}

function normalizeRunStatus(value: unknown): string {
  const status = pickString(value);
  if (status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "cancelled") return status;
  if (status === "success" || status === "completed" || status === "done") return "succeeded";
  if (status === "error" || status === "rejected") return "failed";
  if (status === "canceled") return "cancelled";
  return "queued";
}

function migrateRecordStatus(item: unknown, normalizeStatus: (value: unknown) => string): unknown {
  const record = asRecord(item);
  if (!record) return item;
  return { ...record, status: normalizeStatus(record.status) };
}

function migrateLegacyRepositorySnapshot(value: unknown): unknown {
  const snapshot = asRecord(value);
  if (!snapshot) return value;

  return {
    ...snapshot,
    projects: Array.isArray(snapshot.projects) ? snapshot.projects.map((project) => migrateRecordStatus(project, normalizeProjectStatus)) : snapshot.projects,
    products: Array.isArray(snapshot.products) ? snapshot.products.map((product) => migrateRecordStatus(product, normalizeLifecycleStatus)) : snapshot.products,
    architectures: Array.isArray(snapshot.architectures) ? snapshot.architectures.map((architecture) => migrateRecordStatus(architecture, normalizeLifecycleStatus)) : snapshot.architectures,
    pipelines: Array.isArray(snapshot.pipelines) ? snapshot.pipelines.map((pipeline) => {
      const pipelineRecord = asRecord(pipeline);
      if (!pipelineRecord || !Array.isArray(pipelineRecord.edges)) return pipeline;

      return {
        ...pipelineRecord,
        status: normalizeLifecycleStatus(pipelineRecord.status),
        edges: pipelineRecord.edges.flatMap((edge, index) => {
          const edgeRecord = asRecord(edge);
          if (!edgeRecord) return [];

          const sourceNodeId = pickEntityId(edgeRecord.sourceNodeId) ?? pickEntityId(edgeRecord.source);
          const targetNodeId = pickEntityId(edgeRecord.targetNodeId) ?? pickEntityId(edgeRecord.target);
          if (!sourceNodeId || !targetNodeId) return [];

          const sourcePortId = pickEntityId(edgeRecord.sourcePortId) ?? pickEntityId(edgeRecord.sourceHandle);
          const targetPortId = pickEntityId(edgeRecord.targetPortId) ?? pickEntityId(edgeRecord.targetHandle);
          const id = pickEntityId(edgeRecord.id) ?? `edge_${sourceNodeId}_${targetNodeId}_${index}`;

          const migratedEdge = {
            ...edgeRecord,
            id,
            sourceNodeId,
            targetNodeId,
            sourcePortId,
            targetPortId,
            version: edgeRecord.version ?? "1.0.0",
          };
          const parsedEdge = EdgeSchema.safeParse(migratedEdge);
          return parsedEdge.success ? [parsedEdge.data] : [];
        }),
      };
    }) : snapshot.pipelines,
    runs: Array.isArray(snapshot.runs) ? snapshot.runs.map((run) => {
      const runRecord = asRecord(run);
      if (!runRecord) return run;

      return {
        ...runRecord,
        status: normalizeRunStatus(runRecord.status),
        metrics: Array.isArray(runRecord.metrics) ? runRecord.metrics : [],
        evidence: Array.isArray(runRecord.evidence) ? runRecord.evidence.filter((item): item is string => typeof item === "string") : [],
        logs: Array.isArray(runRecord.logs) ? runRecord.logs : [],
      };
    }) : snapshot.runs,
    reviews: Array.isArray(snapshot.reviews) ? snapshot.reviews.map((review) => migrateRecordStatus(review, normalizeReviewStatus)) : snapshot.reviews,
    prompts: Array.isArray(snapshot.prompts) ? snapshot.prompts.map((prompt) => migrateRecordStatus(prompt, normalizeLifecycleStatus)) : snapshot.prompts,
  };
}

// Legacy demo projects retired from the visible product list (kept as fixture
// data in demo-data.ts for tests, e.g. pipeline-executor.demo.test.ts's use of
// the "AI Call Analysis" 8-node pipeline) -- pruned here, at the repository
// boundary, rather than removed from demo-data.ts, so existing tests that
// import demoSnapshot directly are unaffected. Applied on every load() (not
// just first-time seeding) so browsers with an already-persisted snapshot
// from before this change also converge to the reduced product list.
const RETIRED_DEMO_PROJECT_IDS = ["project_demo_call_analysis", "project_demo_lead_qualification", "project_demo_chat_classification", "project_ad_copy_generation"];

function cascadeDeleteProject(snapshot: RepositorySnapshot, projectId: string): RepositorySnapshot {
  const removedProducts = snapshot.products.filter((product) => product.projectId === projectId);
  const removedArchitectures = snapshot.architectures.filter((architecture) => architecture.projectId === projectId);
  const removedPipelines = snapshot.pipelines.filter((pipeline) => pipeline.projectId === projectId);
  const removedPipelineIds = new Set(removedPipelines.map((pipeline) => pipeline.id));
  const removedRuns = snapshot.runs.filter((run) => removedPipelineIds.has(run.pipelineId));

  // See src/shared/stores/project-store.ts deleteProject for the same cascade rule
  // (CLAUDE.md §63 debt item 4) — kept in sync deliberately.
  const removedTargetIds = new Set<string>([
    projectId,
    ...removedProducts.map((product) => product.id),
    ...removedArchitectures.map((architecture) => architecture.id),
    ...removedPipelines.map((pipeline) => pipeline.id),
    ...removedRuns.map((run) => run.id),
  ]);

  return {
    ...snapshot,
    projects: snapshot.projects.filter((project) => project.id !== projectId),
    products: snapshot.products.filter((product) => product.projectId !== projectId),
    architectures: snapshot.architectures.filter((architecture) => architecture.projectId !== projectId),
    pipelines: snapshot.pipelines.filter((pipeline) => pipeline.projectId !== projectId),
    runs: snapshot.runs.filter((run) => !removedPipelineIds.has(run.pipelineId)),
    reviews: snapshot.reviews.filter((review) => !removedTargetIds.has(review.targetId)),
  };
}

function withoutRetiredDemoProjects(snapshot: RepositorySnapshot): RepositorySnapshot {
  return RETIRED_DEMO_PROJECT_IDS.reduce(
    (acc, projectId) => (acc.projects.some((project) => project.id === projectId) ? cascadeDeleteProject(acc, projectId) : acc),
    snapshot,
  );
}

function withTranscriptionSummaryModule(snapshot: RepositorySnapshot): RepositorySnapshot {
  const existingProject = snapshot.projects.find((project) => project.id === TRANSCRIPTION_SUMMARY_PROJECT_ID || /^Модуль транскрибации и AI-саммари звонков/i.test(project.name));
  const targetProjectId = existingProject?.id ?? TRANSCRIPTION_SUMMARY_PROJECT_ID;
  const hasProject = Boolean(existingProject);
  const hasProduct = snapshot.products.some((product) => product.id === TRANSCRIPTION_SUMMARY_PRODUCT_ID || product.projectId === targetProjectId);

  if (hasProject && hasProduct) return snapshot;

  const project = {
    id: targetProjectId,
    name: TRANSCRIPTION_SUMMARY_NAME,
    description: "Модуль для расшифровки звонков, генерации AI-саммари, проверки качества Summary и тестирования собственного pipeline в Песочнице.",
    status: "testing" as const,
    productId: TRANSCRIPTION_SUMMARY_PRODUCT_ID,
    playgroundRunIds: [],
    reviewIds: [],
    createdAt: TRANSCRIPTION_SUMMARY_CREATED_AT,
    updatedAt: TRANSCRIPTION_SUMMARY_CREATED_AT,
    version: "1.0.0",
  };

  const product = {
    id: TRANSCRIPTION_SUMMARY_PRODUCT_ID,
    projectId: targetProjectId,
    status: "ready" as const,
    idea: {
      statement: "Автоматически превращать транскрибацию звонка в проверенное CRM-саммари и структурированные данные для последующей работы.",
      source: "AI Product Studio",
    },
    discovery: "Команде нужно быстро тестировать пайплайн транскрибации и AI-саммари без зависимости от старого Pipeline Lab v3 по недвижимости.",
    problem: {
      statement: "После звонка важные факты, потребности и результат могут теряться, а summary требует проверки качества перед публикацией.",
      evidenceIds: [],
    },
    users: [
      { id: "user_transcription_manager", name: "Менеджер", segment: "Коммуникации" },
      { id: "user_summary_reviewer", name: "Оценщик Summary", segment: "Quality" },
    ],
    jtbd: [
      {
        statement: "Когда завершился звонок, я хочу получить краткое проверенное summary и структурированные результаты, чтобы быстро продолжить работу без прослушивания записи.",
        context: "После клиентского звонка",
        desiredOutcome: "Summary и карточка готовы к проверке или публикации",
      },
    ],
    features: [
      { id: "feature_transcription_alias", name: "Transcript Context", description: "Передача полной транскрипции во все extraction/checker этапы.", priority: "high" as const },
      { id: "feature_ai_summary_quality", name: "Summary Quality Review", description: "Оценка качества саммари и открытие pipeline_report.json.", priority: "high" as const },
      { id: "feature_pipeline_sandbox", name: "Pipeline Sandbox", description: "Пустой конструктор pipeline для самостоятельной настройки шагов.", priority: "high" as const },
    ],
    mvp: "Песочница с пустым pipeline, добавление шагов пользователем, запуск на транскрипции, Conversation Store, Summary Quality Gate, Publish и Dashboard-история.",
    metrics: [
      { name: "Summary Quality Score", target: ">= 90", category: "quality" as const },
      { name: "AUTO_SAVE rate", target: "растёт после настройки pipeline", category: "success" as const },
      { name: "Стоимость запуска", target: "контролируется по Dashboard", category: "cost" as const },
    ],
    prd: "Модуль принимает текст звонка, проводит пользовательский pipeline извлечения фактов/потребностей/результата, формирует summary, проверяет его качество и сохраняет историю запусков.",
    frameworkIds: ["framework_jtbd", "framework_prd"],
    valueProposition: "Быстрое тестирование и улучшение AI-саммари звонков в отдельном модуле без изменения старых пайплайнов.",
    targetAudience: "Команды, которые внедряют транскрибацию звонков и проверяемые AI-саммари.",
    acceptanceCriteria: "Модуль виден во всех разделах, открывает Песочницу с пустым pipeline, сохраняет историю запусков и поддерживает загрузку отчётов в Оценке Summary.",
    createdAt: TRANSCRIPTION_SUMMARY_CREATED_AT,
    updatedAt: TRANSCRIPTION_SUMMARY_CREATED_AT,
    version: "1.0.0",
  };

  return {
    ...snapshot,
    projects: hasProject ? snapshot.projects : [project, ...snapshot.projects],
    products: hasProduct ? snapshot.products : [product, ...snapshot.products],
  };
}

export class LocalStorageProjectRepository implements ProjectRepository {
  load(): RepositorySnapshot {
    if (typeof window === "undefined") {
      return withTranscriptionSummaryModule(withoutRetiredDemoProjects(cloneSnapshot(demoSnapshot)));
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = withTranscriptionSummaryModule(withoutRetiredDemoProjects(cloneSnapshot(demoSnapshot)));
      this.save(seeded);
      return seeded;
    }

    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateLegacyRepositorySnapshot(parsed);
    const parsedSnapshot = RepositorySnapshotSchema.safeParse(migrated);
    if (!parsedSnapshot.success) {
      window.localStorage.setItem(BACKUP_STORAGE_KEY, raw);
      const seeded = withTranscriptionSummaryModule(withoutRetiredDemoProjects(cloneSnapshot(demoSnapshot)));
      this.save(seeded);
      return seeded;
    }

    const snapshot = withTranscriptionSummaryModule(withoutRetiredDemoProjects(parsedSnapshot.data));
    this.save(snapshot);
    return snapshot;
  }

  save(snapshot: RepositorySnapshot): void {
    if (typeof window === "undefined") {
      return;
    }

    const validated = RepositorySnapshotSchema.parse(snapshot);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }

  reset(): RepositorySnapshot {
    const seeded = withTranscriptionSummaryModule(withoutRetiredDemoProjects(cloneSnapshot(demoSnapshot)));
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
    return cascadeDeleteProject(snapshot, projectId);
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

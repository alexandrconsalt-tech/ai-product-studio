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

function withTranscriptionSummaryModule(snapshot: RepositorySnapshot): RepositorySnapshot {
  const hasProject = snapshot.projects.some((project) => project.id === TRANSCRIPTION_SUMMARY_PROJECT_ID || project.name === TRANSCRIPTION_SUMMARY_NAME);
  const hasProduct = snapshot.products.some((product) => product.id === TRANSCRIPTION_SUMMARY_PRODUCT_ID || product.projectId === TRANSCRIPTION_SUMMARY_PROJECT_ID);

  if (hasProject && hasProduct) return snapshot;

  const project = {
    id: TRANSCRIPTION_SUMMARY_PROJECT_ID,
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
    projectId: TRANSCRIPTION_SUMMARY_PROJECT_ID,
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
      return withTranscriptionSummaryModule(cloneSnapshot(demoSnapshot));
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = withTranscriptionSummaryModule(cloneSnapshot(demoSnapshot));
      this.save(seeded);
      return seeded;
    }

    const parsed: unknown = JSON.parse(raw);
    const snapshot = withTranscriptionSummaryModule(RepositorySnapshotSchema.parse(parsed));
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
    const seeded = withTranscriptionSummaryModule(cloneSnapshot(demoSnapshot));
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

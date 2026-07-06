"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Layers, Play, XCircle } from "lucide-react";
import { Badge, Button, Card, Dialog, EmptyState, NodeCard, Page, Section, Select, Status, Textarea } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { createPlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/factory";
import type { PlaygroundTestRunSource } from "@/entities/PlaygroundTestRun/model/types";
import type { Node, NodeType } from "@/entities/Node/model/types";
import type { Pipeline } from "@/entities/Pipeline/model/types";
import type { Model } from "@/entities/Model/model/types";
import type { PipelineLabV3RunPayload } from "@/shared/model/pipeline-lab-v3-message";
import { executePipeline } from "@/shared/runtime/pipeline-executor";
import { realStageRegistry } from "@/shared/runtime/real-stage";
import { defaultLLMProviderRegistry } from "@/shared/llm/provider-registry";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { buildExecutionTrace, type ExecutionTrace, type StageTrace } from "@/shared/runtime/execution-trace";
import type { ExecutionEvent } from "@/shared/runtime/types";
import { getProjectBundle } from "../selectors";
import { PipelineLabV3Screen } from "./pipeline-lab-v3-screen";
import { AdCopyTestBenchPanel } from "./ad-copy-test-bench-panel";
import type { AdCopyPipelineResult } from "../lib/ad-copy-test-bench";

const IFRAME_SOURCE: PlaygroundTestRunSource = "pipeline-lab-v3";
const EXECUTOR_SOURCE: PlaygroundTestRunSource = "pipeline-executor";
const TEST_BENCH_SOURCE: PlaygroundTestRunSource = "product-test-bench";
const AD_COPY_PIPELINE_ID = "pipeline_ad_copy_generation";

/**
 * Hidden per explicit request (2026-07-06): both the "Этапы пайплайна"
 * node-card preview and the generic "Запустить Pipeline" (Mock LLM
 * Provider) run bar were confusing next to each product's real test
 * bench (Pipeline Lab v3 / Ad Copy's own panel) and are hidden across
 * every product, not deleted -- same "hide navigation, never delete
 * code" convention as `visibleNavItems` in `mvp-shell.tsx`. The domain
 * Pipeline Executor itself, `PipelineStagesSection`, and every handler
 * below are untouched and still exercised by tests / the hidden
 * Analytics screen's Golden Dataset evaluation.
 */
const SHOW_DOMAIN_EXECUTOR_PREVIEW = false;

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  agent: "Агент",
  llm: "LLM",
  function: "Код",
  router: "Маршрутизатор",
  tool: "Инструмент",
  store: "Хранилище",
  validation: "Валидация",
  human_review: "Ручная проверка",
  input: "Вход",
  output: "Выход",
};

const STAGE_STATUS_LABELS: Record<StageTrace["status"], string> = {
  succeeded: "успешно",
  failed: "ошибка",
  skipped: "пропущен",
  pending: "не запускался",
};

function stageStatusTone(status: StageTrace["status"]): "success" | "error" | "neutral" | "warning" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  if (status === "skipped") return "warning";
  return "neutral";
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined) return "—";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

// Clicking a stage shows exactly what the task spec asks a stage card to
// carry: название/назначение/вход/выход/тип/модель/краткое описание,
// plus the real Prompt body (if any) and the JSON Schema documented on
// the node (Node.metadata.jsonSchema, see demo-data.ts's Ad Copy
// Generation pipeline) and, once a run has happened, its real status.
function StageDetailDialog({ node, model, stage, onClose }: Readonly<{ node: Node; model: Model | undefined; stage: StageTrace | undefined; onClose: () => void }>) {
  let promptTemplate: string | null = null;
  if (node.promptId) {
    try {
      promptTemplate = seededPromptRegistry.resolve(node.promptId).template;
    } catch {
      promptTemplate = null;
    }
  }
  const jsonSchema = node.metadata.jsonSchema;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <Dialog className="grid max-h-[85vh] w-full max-w-2xl gap-3 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{node.name}</h2>
            <p className="text-sm text-text-muted">{node.description}</p>
          </div>
          <Status tone={stage ? stageStatusTone(stage.status) : "neutral"}>{stage ? STAGE_STATUS_LABELS[stage.status] : "не запускался"}</Status>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Card><p className="text-xs text-text-muted">Тип</p><p className="font-medium">{NODE_TYPE_LABELS[node.type]}</p></Card>
          <Card><p className="text-xs text-text-muted">Модель</p><p className="font-medium">{model?.name ?? "—"}</p></Card>
          <Card><p className="text-xs text-text-muted">Вход</p><p className="font-medium">{node.inputPorts.map((port) => port.name).join(", ") || "точка входа"}</p></Card>
          <Card><p className="text-xs text-text-muted">Выход</p><p className="font-medium">{node.outputPorts.map((port) => port.name).join(", ") || "—"}</p></Card>
        </div>

        {promptTemplate ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Prompt</p>
            <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{promptTemplate}</pre>
          </div>
        ) : null}

        {jsonSchema ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">JSON Schema</p>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{jsonSchema}</pre>
          </div>
        ) : null}

        {stage?.output !== undefined ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Результат последнего запуска</p>
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{stringifyPayload(stage.output)}</pre>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>Закрыть</Button>
        </div>
      </Dialog>
    </div>
  );
}

// "В нем должна отображаться вся цепочка Pipeline. Каждый этап должен
// быть кликабельным" -- one NodeCard per Node, in pipeline order,
// reusing the existing (previously unwired) shared/ui NodeCard
// primitive rather than inventing a new stage-card component.
function PipelineStagesSection({ pipeline, models, trace }: Readonly<{ pipeline: Pipeline; models: readonly Model[]; trace: ExecutionTrace | undefined }>) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const selectedNode = pipeline.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedStage = trace?.stages.find((stage) => stage.nodeId === selectedNodeId);

  return (
    <Section>
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
        <Layers className="size-4 text-text-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Этапы пайплайна</h2>
        <Badge tone="info">{pipeline.nodes.length}</Badge>
      </button>
      {expanded ? (
        <>
          <p className="text-sm text-text-muted">Нажмите на этап, чтобы увидеть описание, тип, модель, вход, выход, prompt, JSON Schema и статус последнего запуска.</p>
          <div className="flex flex-wrap gap-3">
            {pipeline.nodes.map((node) => {
              const stage = trace?.stages.find((item) => item.nodeId === node.id);
              const model = models.find((item) => item.id === node.modelId);
              return (
                <NodeCard key={node.id} selected={selectedNodeId === node.id} className="w-56 cursor-pointer" onClick={() => setSelectedNodeId(node.id)}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone="neutral">{NODE_TYPE_LABELS[node.type]}</Badge>
                    {stage ? <Badge tone={stageStatusTone(stage.status)}>{STAGE_STATUS_LABELS[stage.status]}</Badge> : null}
                  </div>
                  <p className="text-sm font-medium">{node.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{node.description}</p>
                  {model ? <p className="mt-2 text-xs text-text-muted">Модель: {model.name}</p> : null}
                </NodeCard>
              );
            })}
          </div>
        </>
      ) : null}
      {selectedNode ? <StageDetailDialog node={selectedNode} model={models.find((item) => item.id === selectedNode.modelId)} stage={selectedStage} onClose={() => setSelectedNodeId(null)} /> : null}
    </Section>
  );
}

/**
 * Playground is a universal test bench, not tied to any one product's
 * pipeline (CLAUDE.md addendum "Product -> Playground -> Dashboard"): a
 * product picker up top, then (for whichever product is selected) its
 * Pipeline shown as clickable stage cards with a real "Запустить
 * Pipeline" button (Production Pipeline Runtime, `executePipeline` --
 * the same engine Analytics' Golden Dataset evaluation already uses,
 * §12.4a), and Pipeline Lab v3 embedded below for products that use it.
 * Every run from either path is recorded into PlaygroundTestRun history
 * for Dashboard to read.
 */
export function PlaygroundScreen() {
  const { snapshot, selectedProjectId, selectProject } = useRepositoryStore();
  const { recordRun } = usePlaygroundTestRunStore();
  const { recordTrace, getTrace } = useExecutionTraceStore();
  const [runInput, setRunInput] = React.useState("");
  const [executing, setExecuting] = React.useState(false);
  const [lastRunId, setLastRunId] = React.useState<string | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  const projects = snapshot?.projects ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const { pipeline } = getProjectBundle(snapshot, selectedProjectId);
  const models = snapshot?.models ?? [];
  const lastTrace = pipeline && lastRunId ? buildExecutionTrace(pipeline, getTrace(lastRunId) ?? []) : undefined;

  React.useEffect(() => {
    setRunError(null);
    setLastRunId(null);
    setRunInput("");
  }, [pipeline?.id]);

  const handleRunComplete = React.useCallback(
    (payload: PipelineLabV3RunPayload) => {
      if (!selectedProjectId) return;
      recordRun(
        createPlaygroundTestRun({
          projectId: selectedProjectId,
          source: IFRAME_SOURCE,
          status: payload.status,
          stageCount: payload.stageCount,
          errorCount: payload.errorCount,
          warningCount: payload.warningCount,
          tokens: payload.tokens,
          costUsd: payload.costUsd,
          durationMs: payload.durationMs,
          confidence: payload.confidence,
          qualityScore: payload.qualityScore,
          decision: payload.decision,
          transcript: payload.transcript,
          report: payload.report,
          startedAt: payload.startedAt,
          finishedAt: payload.finishedAt,
        }),
      );
    },
    [selectedProjectId, recordRun],
  );

  const handleAdCopyRunComplete = React.useCallback(
    (result: AdCopyPipelineResult, rawInput: string) => {
      if (!selectedProjectId) return;
      const reportList = Object.values(result.reports);
      const errorCount = reportList.filter((report) => report.status === "bad").length;
      const warningCount = reportList.filter((report) => report.status === "warn").length;
      const startedAt = new Date(Date.now() - result.totalDurationMs).toISOString();
      recordRun(
        createPlaygroundTestRun({
          projectId: selectedProjectId,
          source: TEST_BENCH_SOURCE,
          status: errorCount === 0 ? "succeeded" : "failed",
          stageCount: reportList.length,
          errorCount,
          warningCount,
          tokens: result.totalTokensEstimate,
          costUsd: result.totalCostUsd,
          durationMs: result.totalDurationMs,
          confidence: result.finalRecord ? result.finalRecord.confidenceScore / 100 : undefined,
          decision: result.finalRecord ? (result.finalRecord.lowConfidence ? "SAVE_LOW_CONFIDENCE" : "SAVE") : undefined,
          transcript: rawInput,
          report: { reports: result.reports, ctx: result.ctx },
          startedAt,
          finishedAt: new Date().toISOString(),
        }),
      );
    },
    [selectedProjectId, recordRun],
  );

  const handleRunPipeline = async () => {
    if (!pipeline) return;
    setExecuting(true);
    setRunError(null);
    try {
      let input: unknown = runInput;
      try {
        input = JSON.parse(runInput);
      } catch {
        // Not JSON -- pass the raw text through (e.g. call-analysis-style transcript pipelines).
      }
      const registry = realStageRegistry({ llmProviders: defaultLLMProviderRegistry, prompts: seededPromptRegistry, models });
      const events: ExecutionEvent[] = [];
      const run = await executePipeline(pipeline, input, { registry, projectId: pipeline.projectId, onEvent: (event) => events.push(event) });
      recordTrace(run.id, events);
      setLastRunId(run.id);

      const trace = buildExecutionTrace(pipeline, events);
      const errorCount = trace.stages.filter((stage) => stage.status === "failed").length;
      const confidence = [...trace.stages].reverse().map((stage) => stage.metrics.find((metric) => metric.name === "confidence")?.value).find((value): value is number => value !== undefined);
      const startedMs = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
      const finishedMs = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();

      recordRun(
        createPlaygroundTestRun({
          projectId: pipeline.projectId,
          source: EXECUTOR_SOURCE,
          status: run.status === "failed" ? "failed" : "succeeded",
          stageCount: pipeline.nodes.length,
          errorCount,
          warningCount: 0,
          tokens: run.metrics.find((metric) => metric.name === "tokens")?.value ?? 0,
          costUsd: run.costUsd ?? 0,
          durationMs: Math.max(0, finishedMs - startedMs),
          confidence,
          transcript: typeof input === "string" ? input : JSON.stringify(input),
          report: { trace },
          startedAt: run.startedAt ?? new Date(startedMs).toISOString(),
          finishedAt: run.finishedAt ?? new Date(finishedMs).toISOString(),
        }),
      );
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Не удалось выполнить pipeline.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Песочница</h1>
        <p className="text-sm text-text-muted">Выберите продукт и протестируйте его пайплайн — этапы, промежуточные результаты, реальный запуск и отчёт.</p>
      </div>

      <Section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Продукт</h2>
          <Status tone="info">{projects.length}</Status>
        </div>
        {projects.length === 0 ? (
          <EmptyState>Продукты не найдены. Создайте продукт в разделе «Продукт».</EmptyState>
        ) : (
          <label className="grid max-w-md gap-1 text-sm">
            Выберите продукт
            <Select value={selectedProjectId ?? ""} onChange={(event) => selectProject(event.target.value)} aria-label="Выбрать продукт">
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {selectedProject ? <p className="text-sm text-text-muted">{selectedProject.description}</p> : null}
      </Section>

      {!selectedProject ? (
        <EmptyState>Выберите продукт выше, чтобы открыть его pipeline.</EmptyState>
      ) : !pipeline ? (
        <EmptyState>Для этого продукта ещё не создан Pipeline.</EmptyState>
      ) : pipeline.id === AD_COPY_PIPELINE_ID ? (
        <Section>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{selectedProject.name}</h2>
          </div>
          <p className="text-sm text-text-muted">Загрузите входные данные и нажмите «Прогнать пайплайн». Каждый этап реально выполняется — с реальными вызовами модели (ключ из «Настройки») и реальной детерминированной логикой.</p>
          <AdCopyTestBenchPanel productId={selectedProject.id} onRunComplete={handleAdCopyRunComplete} />
        </Section>
      ) : (
        <>
          {SHOW_DOMAIN_EXECUTOR_PREVIEW ? (
            <>
              <PipelineStagesSection pipeline={pipeline} models={models} trace={lastTrace} />

              <Section>
                <div className="flex items-center gap-2">
                  <Play className="size-4 text-text-muted" aria-hidden="true" />
                  <h2 className="text-lg font-semibold">Запустить Pipeline</h2>
                </div>
                <p className="text-sm text-text-muted">Реальный Pipeline Executor выполняет граф по узлам (топологический порядок, ветвление, fan-in). LLM-вызовы идут через Mock LLM Provider, если не настроен реальный provider.</p>
                <Textarea className="min-h-40 font-mono text-xs" value={runInput} onChange={(event) => setRunInput(event.target.value)} placeholder="Входные данные пайплайна (текст или JSON)" />
                <div className="flex items-center gap-2">
                  <Button variant="primary" onClick={handleRunPipeline} disabled={executing || !runInput.trim()}>
                    <Play className="size-4" aria-hidden="true" />
                    {executing ? "Выполняется…" : "Запустить"}
                  </Button>
                  {lastTrace ? (
                    <Badge tone={lastTrace.status === "succeeded" ? "success" : "error"}>
                      {lastTrace.status === "succeeded" ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
                      {lastTrace.status === "succeeded" ? "Успешно" : "Ошибка"}
                    </Badge>
                  ) : null}
                </div>
                {runError ? (
                  <div className="flex items-center gap-2 text-sm text-error">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {runError}
                  </div>
                ) : null}
              </Section>
            </>
          ) : null}

          <Section className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-text-muted" aria-hidden="true" />
              <h2 className="text-lg font-semibold">{selectedProject.name}</h2>
            </div>
            <Card className="h-[75vh] min-h-[560px] overflow-hidden p-0">
              <PipelineLabV3Screen productId={selectedProject.id} productName={selectedProject.name} onRunComplete={handleRunComplete} />
            </Card>
          </Section>
        </>
      )}
    </Page>
  );
}

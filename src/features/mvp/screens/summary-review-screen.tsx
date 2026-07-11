"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCheck, Clock, Gauge, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/types";
import type { Run } from "@/entities/Run/model/types";
import { ReviewWorkspace } from "@/features/summary-review/review-workspace";
import { normalizePlaygroundRun } from "@/features/summary-review/importer";
import { getReviews, saveRun } from "@/features/summary-review/storage";
import type { RepositorySnapshot } from "@/shared/repositories/types";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { Badge, Button, EmptyState, Page, Section, Status } from "@/shared/ui";

const LEGACY_REPOSITORY_BACKUP_KEY = "ai-product-studio.repository.invalid-backup.v1";

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} с` : `${Math.round(value)} мс`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

function runProductLabel(run: PlaygroundTestRun): string {
  return run.productName ?? run.moduleName ?? run.pipelineName ?? run.projectId;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function inputToTranscript(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  if (input === undefined || input === null) return undefined;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function metricValue(run: Run, name: string): number | undefined {
  return run.metrics.find((metric) => metric.name === name)?.value;
}

function durationMs(run: Run): number {
  if (run.latencyMs !== undefined) return run.latencyMs;
  if (run.startedAt && run.finishedAt) return Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime());
  return 0;
}

function repositoryRunToPlaygroundRun(run: Run, snapshot: RepositorySnapshot): PlaygroundTestRun | null {
  const pipeline = snapshot.pipelines.find((item) => item.id === run.pipelineId);
  if (!pipeline) return null;
  const project = snapshot.projects.find((item) => item.id === pipeline.projectId);

  return {
    id: run.id,
    projectId: pipeline.projectId,
    source: "pipeline-executor",
    status: run.status === "failed" || run.status === "cancelled" ? "failed" : "succeeded",
    stageCount: pipeline.nodes.length,
    errorCount: run.status === "failed" || run.status === "cancelled" ? 1 : 0,
    warningCount: 0,
    tokens: metricValue(run, "tokens") ?? 0,
    costUsd: run.costUsd ?? 0,
    durationMs: durationMs(run),
    confidence: metricValue(run, "confidence"),
    transcript: inputToTranscript(run.input),
    report: { output: run.output, metrics: run.metrics, evidence: run.evidence, logs: run.logs },
    productName: project?.name,
    pipelineName: pipeline.id,
    startedAt: run.startedAt ?? run.finishedAt ?? new Date().toISOString(),
    finishedAt: run.finishedAt ?? run.startedAt ?? new Date().toISOString(),
    version: run.version,
  };
}

function readLegacyBackupRuns(): PlaygroundTestRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_REPOSITORY_BACKUP_KEY);
    if (!raw) return [];
    const snapshot = asRecord(JSON.parse(raw));
    if (!snapshot || !Array.isArray(snapshot.runs) || !Array.isArray(snapshot.pipelines)) return [];

    const pipelines = snapshot.pipelines.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
    const projects = Array.isArray(snapshot.projects) ? snapshot.projects.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : [];

    return snapshot.runs.flatMap((item, index): PlaygroundTestRun[] => {
      const run = asRecord(item);
      if (!run) return [];
      const id = typeof run.id === "string" && run.id.trim() ? run.id : `legacy_run_${index}`;
      const pipelineId = typeof run.pipelineId === "string" ? run.pipelineId : undefined;
      const pipeline = pipelines.find((candidate) => candidate.id === pipelineId);
      const projectId = typeof pipeline?.projectId === "string" ? pipeline.projectId : typeof run.projectId === "string" ? run.projectId : "legacy_project";
      const project = projects.find((candidate) => candidate.id === projectId);
      const startedAt = typeof run.startedAt === "string" ? run.startedAt : undefined;
      const finishedAt = typeof run.finishedAt === "string" ? run.finishedAt : startedAt ?? new Date().toISOString();
      const status = run.status === "failed" || run.status === "cancelled" || run.status === "error" ? "failed" : "succeeded";

      return [{
        id,
        projectId,
        source: "pipeline-executor",
        status,
        stageCount: Array.isArray(pipeline?.nodes) ? pipeline.nodes.length : 0,
        errorCount: status === "failed" ? 1 : 0,
        warningCount: 0,
        tokens: 0,
        costUsd: typeof run.costUsd === "number" ? run.costUsd : 0,
        durationMs: typeof run.latencyMs === "number" ? run.latencyMs : 0,
        transcript: inputToTranscript(run.input),
        report: { output: run.output, metrics: run.metrics, evidence: run.evidence, logs: run.logs, legacyBackup: true },
        productName: typeof project?.name === "string" ? project.name : undefined,
        pipelineName: pipelineId,
        startedAt: startedAt ?? finishedAt,
        finishedAt,
        version: typeof run.version === "string" ? run.version : "1.0.0",
      }];
    });
  } catch {
    return [];
  }
}

function buildReviewSource(run: PlaygroundTestRun): Record<string, unknown> {
  return {
    ...run,
    run_id: run.id,
    created_at: run.finishedAt,
    report_json: run.report,
    transcript: run.transcript,
    summary: run.summary,
  };
}

function canReviewRun(run: PlaygroundTestRun): boolean {
  const source = normalizePlaygroundRun(buildReviewSource(run));
  return Boolean(source.summary.trim() || source.transcript.trim());
}

function SummaryReviewHistory() {
  const router = useRouter();
  const { runsByProjectId, refreshFromStorage } = usePlaygroundTestRunStore();
  const { snapshot } = useRepositoryStore();
  const [legacyBackupVersion, setLegacyBackupVersion] = React.useState(0);
  const [reviewVersion, setReviewVersion] = React.useState(0);

  React.useEffect(() => {
    refreshFromStorage();
    setLegacyBackupVersion((value) => value + 1);
    setReviewVersion((value) => value + 1);

    const refresh = () => {
      refreshFromStorage();
      setLegacyBackupVersion((value) => value + 1);
      setReviewVersion((value) => value + 1);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshFromStorage]);

  const reviewsByRunId = React.useMemo(() => {
    void reviewVersion;
    return new Map(getReviews().map((review) => [review.runId, review]));
  }, [reviewVersion]);

  const runs = React.useMemo(
    () => {
      const byId = new Map<string, PlaygroundTestRun>();
      for (const run of Object.values(runsByProjectId).flat()) byId.set(run.id, run);
      if (snapshot) {
        for (const run of snapshot.runs) {
          const converted = repositoryRunToPlaygroundRun(run, snapshot);
          if (converted && !byId.has(converted.id)) byId.set(converted.id, converted);
        }
      }
      void legacyBackupVersion;
      for (const run of readLegacyBackupRuns()) {
        if (!byId.has(run.id)) byId.set(run.id, run);
      }
      return [...byId.values()].sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());
    },
    [legacyBackupVersion, runsByProjectId, snapshot],
  );

  const openReview = (run: PlaygroundTestRun) => {
    const imported = normalizePlaygroundRun(buildReviewSource(run));
    saveRun(imported);
    router.push(`/?view=summary-review&runId=${encodeURIComponent(imported.id)}`);
  };

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Оценка качества Summary</h1>
        <p className="text-sm text-text-muted">История запусков из Песочницы. Откройте запуск, чтобы провести или пересмотреть ручную оценку Summary.</p>
      </div>

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-semibold">Запуски Pipeline</h2>
          </div>
          <Badge tone="info">{runs.length} запуск(ов)</Badge>
        </div>

        {runs.length === 0 ? (
          <EmptyState>В Песочнице ещё нет запусков Pipeline.</EmptyState>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <div className="grid min-w-[1120px] grid-cols-[170px_1.2fr_120px_100px_95px_90px_1fr_130px_120px] gap-2 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-text-muted">
              <span>Дата</span>
              <span>Продукт / Pipeline</span>
              <span>Запуск</span>
              <span>Стоимость</span>
              <span>Время</span>
              <span>SQS</span>
              <span>Решение</span>
              <span>Оценка</span>
              <span />
            </div>
            {runs.map((run) => {
              const review = reviewsByRunId.get(run.id);
              const reviewable = canReviewRun(run);
              return (
                <div
                  key={run.id}
                  className={`grid min-w-[1120px] grid-cols-[170px_1.2fr_120px_100px_95px_90px_1fr_130px_120px] items-center gap-2 border-b border-border px-3 py-3 text-sm last:border-b-0 ${review ? "bg-success/5" : "bg-surface"}`}
                >
                  <span className="text-text-muted">{formatDateTime(run.finishedAt)}</span>
                  <span className="truncate">
                    {runProductLabel(run)}
                    <span className="ml-2 text-xs text-text-muted">{run.source}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {run.status === "succeeded" ? <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> : <XCircle className="size-3.5 text-error" aria-hidden="true" />}
                    {run.status === "succeeded" ? "успешно" : "с ошибкой"}
                  </span>
                  <span>{formatUsd(run.costUsd)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-text-muted" aria-hidden="true" />
                    {formatMs(run.durationMs)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="size-3.5 text-text-muted" aria-hidden="true" />
                    {run.qualityScore !== undefined ? `${Math.round(run.qualityScore)}%` : "—"}
                  </span>
                  <span className="truncate">{run.decision ?? run.finalDecision ?? "—"}</span>
                  <span>
                    {review ? (
                      <Status tone="success">оценено · {Math.round(review.humanScore)}%</Status>
                    ) : reviewable ? (
                      <Status tone="warning">не оценено</Status>
                    ) : (
                      <Status tone="neutral">нет summary</Status>
                    )}
                  </span>
                  <span className="flex justify-end">
                    <Button size="sm" variant={review ? "secondary" : "primary"} disabled={!reviewable} onClick={() => openReview(run)}>
                      {review ? "Открыть" : "Оценить"}
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </Page>
  );
}

export function SummaryReviewScreen() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("runId");

  if (runId) {
    return <ReviewWorkspace runId={runId} embedded />;
  }

  return <SummaryReviewHistory />;
}

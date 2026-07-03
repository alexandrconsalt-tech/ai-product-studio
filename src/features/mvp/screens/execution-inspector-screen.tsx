"use client";

import * as React from "react";
import { ArrowDown, CheckCircle2, Circle, Download, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Page, Section, Status, Select } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundStore } from "@/shared/stores/playground-store";
import { useExecutionTraceStore } from "@/shared/stores/execution-trace-store";
import { buildExecutionTrace, type StageTrace, type StageTraceStatus } from "@/shared/runtime/execution-trace";
import { assessPipelineHealth, type HealthSeverity } from "@/shared/evaluation/pipeline-health";
import { compareRuns } from "@/shared/evaluation/compare-runs";
import { buildReportEnvelope } from "@/shared/evaluation/reports";
import { downloadJson } from "@/shared/lib/download-json";
import { seededPromptRegistry } from "@/shared/prompts/seed-prompts";
import { getProjectBundle } from "../selectors";

function metricValue(stage: StageTrace, name: string): number | undefined {
  return stage.metrics.find((m) => m.name === name)?.value;
}

function statusIcon(status: StageTraceStatus) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="size-4 text-success" aria-hidden="true" />;
    case "failed":
      return <XCircle className="size-4 text-error" aria-hidden="true" />;
    case "skipped":
      return <Circle className="size-4 text-text-muted" aria-hidden="true" />;
    default:
      return <Circle className="size-4 text-text-muted opacity-40" aria-hidden="true" />;
  }
}

function statusTone(status: StageTraceStatus): "success" | "error" | "neutral" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  return "neutral";
}

function severityTone(severity: HealthSeverity): "error" | "warning" | "info" {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function stringify(value: unknown): string {
  if (value === undefined) return "—";
  return JSON.stringify(value, null, 2);
}

export function ExecutionInspectorScreen() {
  const { snapshot, selectedProjectId } = useRepositoryStore();
  const { selectedRunId } = usePlaygroundStore();
  const { getTrace } = useExecutionTraceStore();
  const { pipeline, runs } = getProjectBundle(snapshot, selectedProjectId);
  const [selectedStageId, setSelectedStageId] = React.useState<string | null>(null);
  const [compareRunId, setCompareRunId] = React.useState<string>("");

  const run = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null;

  if (!pipeline || !run) {
    return <EmptyState>Запустите Pipeline в Playground, чтобы открыть Execution Inspector.</EmptyState>;
  }

  const events = getTrace(run.id);
  if (!events) {
    return (
      <EmptyState>
        Для Run &quot;{run.id}&quot; нет сохранённого execution trace (запущен в другой сессии). Запустите Pipeline заново в Playground, чтобы увидеть полный trace.
      </EmptyState>
    );
  }

  const trace = buildExecutionTrace(pipeline, events);
  const health = assessPipelineHealth(pipeline, { trace, prompts: seededPromptRegistry });
  const selectedStage = trace.stages.find((s) => s.nodeId === selectedStageId) ?? null;
  const compareRun = runs.find((r) => r.id === compareRunId) ?? null;
  const comparison = compareRun ? compareRuns(run, compareRun) : null;

  const model = (modelId: string | undefined) => snapshot?.models.find((m) => m.id === modelId);
  const promptVersion = (promptId: string | undefined) => {
    if (!promptId) return undefined;
    try {
      return seededPromptRegistry.resolve(promptId).version;
    } catch {
      return undefined;
    }
  };

  const exportExecutionReport = () => {
    const envelope = buildReportEnvelope("execution_report", { run, trace, health });
    downloadJson(`execution-report-${run.id}.json`, envelope);
  };
  const exportRunReport = () => {
    downloadJson(`run-report-${run.id}.json`, buildReportEnvelope("run_report", run));
  };

  return (
    <Page className="max-w-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Execution Inspector</h1>
          <p className="text-sm text-text-muted">Run {run.id} · Pipeline {pipeline.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportRunReport}>
            <Download className="size-4" aria-hidden="true" />
            Run Report
          </Button>
          <Button variant="secondary" onClick={exportExecutionReport}>
            <Download className="size-4" aria-hidden="true" />
            Execution Report
          </Button>
          <Status tone={run.status === "succeeded" ? "success" : run.status === "failed" ? "error" : "neutral"}>{run.status}</Status>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs text-text-muted">Score</p><p className="text-2xl font-semibold">{health.score}/100</p></Card>
        <Card><p className="text-xs text-text-muted">Tokens</p><p className="text-xl font-semibold">{run.metrics.find((m) => m.name === "tokens")?.value ?? 0}</p></Card>
        <Card><p className="text-xs text-text-muted">Cost</p><p className="text-xl font-semibold">${run.costUsd?.toFixed(4) ?? "0.0000"}</p></Card>
        <Card><p className="text-xs text-text-muted">Latency</p><p className="text-xl font-semibold">{run.latencyMs ?? 0} ms</p></Card>
      </div>

      <Section>
        <h2 className="mb-2 text-lg font-semibold">Pipeline Health</h2>
        {health.issues.length === 0 ? (
          <Alert tone="success">Проблем не найдено.</Alert>
        ) : (
          <div className="grid gap-2">
            {health.issues.map((issue, index) => (
              <div key={`${issue.code}-${index}`} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                <Badge tone={severityTone(issue.severity)}>{issue.code}</Badge>
                <span className="text-text-muted">{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Section>
          <h2 className="mb-2 text-lg font-semibold">Timeline</h2>
          <div className="grid gap-1">
            {trace.stages.map((stage, index) => (
              <React.Fragment key={stage.nodeId}>
                <button
                  type="button"
                  onClick={() => setSelectedStageId(stage.nodeId)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-colors ${
                    selectedStageId === stage.nodeId ? "border-primary bg-selected" : "border-border hover:bg-hover"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {statusIcon(stage.status)}
                    <span>{stage.name}</span>
                  </span>
                  <span className="text-xs text-text-muted">{stage.durationMs !== undefined ? `${stage.durationMs}ms` : ""}</span>
                </button>
                {index < trace.stages.length - 1 ? (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="size-3 text-text-muted" aria-hidden="true" />
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </Section>

        <Section>
          <h2 className="mb-2 text-lg font-semibold">Stage Detail</h2>
          {!selectedStage ? (
            <EmptyState>Выберите узел в Timeline слева.</EmptyState>
          ) : (
            <Card className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-medium">{selectedStage.name}</p>
                <Badge tone={statusTone(selectedStage.status)}>{selectedStage.status}</Badge>
              </div>
              {selectedStage.error ? <Alert tone="error">{selectedStage.error}</Alert> : null}
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><p className="text-xs text-text-muted">Type</p><p>{selectedStage.type}</p></div>
                <div><p className="text-xs text-text-muted">Duration</p><p>{selectedStage.durationMs ?? "—"} ms</p></div>
                <div><p className="text-xs text-text-muted">Tokens</p><p>{metricValue(selectedStage, "tokens") ?? "—"}</p></div>
                <div><p className="text-xs text-text-muted">Cost</p><p>${(metricValue(selectedStage, "cost") ?? 0).toFixed(4)}</p></div>
                <div><p className="text-xs text-text-muted">Confidence</p><p>{metricValue(selectedStage, "confidence") ?? "—"}</p></div>
                <div><p className="text-xs text-text-muted">Retry Count</p><p>{selectedStage.retryCount}</p></div>
                <div><p className="text-xs text-text-muted">Prompt Version</p><p>{promptVersion(selectedStage.promptId) ?? "—"}</p></div>
                <div><p className="text-xs text-text-muted">Model</p><p>{model(selectedStage.modelId)?.name ?? selectedStage.modelId ?? "—"}</p></div>
                <div><p className="text-xs text-text-muted">Provider</p><p>{model(selectedStage.modelId)?.provider ?? "—"}</p></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-text-muted">Input</p>
                  <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs">{stringify(selectedStage.input)}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs text-text-muted">Output</p>
                  <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs">{stringify(selectedStage.output)}</pre>
                </div>
              </div>
              {selectedStage.evidence.length > 0 ? (
                <div>
                  <p className="mb-1 text-xs text-text-muted">Evidence</p>
                  <div className="grid gap-1">
                    {selectedStage.evidence.map((quote, index) => (
                      <p key={index} className="rounded-md bg-muted p-2 text-xs italic text-text-muted">&quot;{quote}&quot;</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </Section>
      </div>

      <Section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Compare Runs</h2>
          <Select value={compareRunId} onChange={(event) => setCompareRunId(event.target.value)} className="w-64">
            <option value="">Выберите Run для сравнения…</option>
            {runs.filter((r) => r.id !== run.id).map((r) => (
              <option key={r.id} value={r.id}>{r.id}</option>
            ))}
          </Select>
        </div>
        {comparison ? (
          <div className="mt-3 grid gap-2">
            <p className="text-sm text-text-muted">
              Baseline: {comparison.baselineStatus} → Candidate: {comparison.candidateStatus} {comparison.statusChanged ? <Badge tone="warning">status changed</Badge> : null}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted"><th>Metric</th><th>Baseline</th><th>Candidate</th><th>Δ</th><th>%</th></tr>
              </thead>
              <tbody>
                {comparison.metrics.map((metric) => (
                  <tr key={metric.name} className="border-t border-border">
                    <td className="py-1">{metric.name}</td>
                    <td>{metric.baseline ?? "—"}</td>
                    <td>{metric.candidate ?? "—"}</td>
                    <td className={metric.delta !== undefined && metric.delta < 0 ? "text-success" : metric.delta !== undefined && metric.delta > 0 ? "text-error" : ""}>
                      {metric.delta ?? "—"}
                    </td>
                    <td>{metric.percentChange !== undefined ? `${metric.percentChange}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>
    </Page>
  );
}

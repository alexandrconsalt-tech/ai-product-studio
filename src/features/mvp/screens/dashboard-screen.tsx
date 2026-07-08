"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Download, Gauge, History, LineChart as LineChartIcon, Timer, Wallet, XCircle } from "lucide-react";
import { Badge, Button, Card, Dialog, EmptyState, LineChart, Page, Section, SegmentedControl, Select, Status } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { computeDashboardStats, scoreFromReportResult, scoreFromStageReport } from "@/shared/evaluation/playground-dashboard-analytics";
import { downloadJson } from "@/shared/lib/download-json";
import type { PlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/types";

const RANGE_OPTIONS = ["all", 5, 10, 20, 50, 100] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];
const ALL_PROJECTS = "__all__";

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} с` : `${Math.round(value)} мс`;
}
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU");
}

function runProductLabel(run: PlaygroundTestRun): string {
  return run.productName ?? run.moduleName ?? run.pipelineName ?? run.projectId;
}

function getFinalSummary(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;
  const result = "result" in report ? (report as { result?: unknown }).result : undefined;
  if (!result || typeof result !== "object") return null;

  const summary = "summary" in result ? (result as { summary?: unknown }).summary : undefined;
  if (summary && typeof summary === "object" && "summary" in summary) {
    const value = (summary as { summary?: unknown }).summary;
    if (typeof value === "string" && value.trim()) return value;
  }

  const crm = "crm" in result ? (result as { crm?: unknown }).crm : undefined;
  if (crm && typeof crm === "object" && "card" in crm) {
    const card = (crm as { card?: unknown }).card;
    if (card && typeof card === "object" && "summary" in card) {
      const value = (card as { summary?: unknown }).summary;
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function resultFromReport(report: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(report)?.result);
}

function mainIssue(report: unknown): string {
  const gate = asRecord(resultFromReport(report)?.summary_quality_gate);
  const lists = [gate?.key_problems, gate?.critical_errors, gate?.warnings, gate?.top_recommendations, gate?.recommendations];
  for (const list of lists) {
    if (Array.isArray(list) && list.length > 0) return typeof list[0] === "string" ? list[0] : JSON.stringify(list[0]);
  }
  if (typeof gate?.main_reason === "string" && gate.main_reason.trim()) return gate.main_reason;
  return "—";
}

function failedStage(report: unknown): string {
  const stages = asRecord(report)?.stageReports;
  if (!Array.isArray(stages)) return "—";
  const failed = stages.find((item) => {
    const rep = asRecord(asRecord(item)?.report);
    const meta = asRecord(rep?.meta);
    return meta?.status === "fail" || rep?.status === "bad";
  });
  return typeof asRecord(failed)?.stage === "object" ? String(asRecord(asRecord(failed)?.stage)?.name ?? "—") : "—";
}

function StageScoresBlock({ report }: Readonly<{ report: unknown }>) {
  const stages = asRecord(report)?.stageReports;
  if (!Array.isArray(stages) || stages.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-sm font-medium">Оценки по этапам</p>
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        {stages.map((item, index) => {
          const itemRecord = asRecord(item);
          const stage = asRecord(asRecord(item)?.stage);
          const stat = itemRecord ? scoreFromStageReport(itemRecord) : null;
          return (
            <div key={`${String(stage?.name ?? index)}-${index}`} className="grid grid-cols-[1fr_80px_90px] gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0">
              <span className="truncate">{String(stage?.name ?? "Этап")}</span>
              <span>{stat ? `${Math.round(stat.score)}%` : "—"}</span>
              <span>{stat ? formatMs(stat.durationMs) : "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: Readonly<{ icon: React.ReactNode; label: string; value: string; hint?: string }>) {
  return (
    <Card className="grid gap-1">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className="text-xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </Card>
  );
}

// Full detail of one historical test run -- so the user can "в любое
// время вернуться и посмотреть результаты конкретного теста", not just
// the aggregate stats above. Shows the raw transcript tested and the
// full per-stage report Pipeline Lab v3's postMessage bridge captured
// (same shape as its own "Скачать полный отчёт" download).
function RunDetailDialog({ run, onClose }: Readonly<{ run: PlaygroundTestRun; onClose: () => void }>) {
  const finalSummary = getFinalSummary(run.report);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <Dialog className="grid max-h-[85vh] w-full max-w-3xl gap-3 overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Результат теста</h2>
            <p className="text-sm text-text-muted">{formatDateTime(run.finishedAt)}</p>
          </div>
          <Status tone={run.status === "succeeded" ? "success" : "error"}>{run.status === "succeeded" ? "успешно" : "с ошибкой"}</Status>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Card><p className="text-xs text-text-muted">Стоимость</p><p className="font-medium">{formatUsd(run.costUsd)}</p></Card>
          <Card><p className="text-xs text-text-muted">Время</p><p className="font-medium">{formatMs(run.durationMs)}</p></Card>
          <Card><p className="text-xs text-text-muted">Уверенность</p><p className="font-medium">{run.confidence !== undefined ? run.confidence.toFixed(2) : "—"}</p></Card>
          <Card><p className="text-xs text-text-muted">Оценка качества</p><p className="font-medium">{run.qualityScore !== undefined ? `${Math.round(run.qualityScore)}%` : "—"}</p></Card>
        </div>
        {run.decision ? <p className="text-sm text-text-muted">Решение: <span className="text-foreground">{run.decision}</span></p> : null}
        {run.transcript ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Входные данные</p>
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{run.transcript}</pre>
          </div>
        ) : null}
        {finalSummary ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Итоговое саммари</p>
            <div className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-foreground">{finalSummary}</div>
          </div>
        ) : null}
        <StageScoresBlock report={run.report} />
        <div className="grid gap-1">
          <p className="text-sm font-medium">Причины решения</p>
          <div className="rounded-md bg-muted p-3 text-sm text-foreground">{mainIssue(run.report)}</div>
        </div>
        <div className="grid min-h-0 flex-1 gap-1">
          <p className="text-sm font-medium">Полный отчёт по этапам</p>
          <pre className="max-h-72 min-h-0 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{JSON.stringify(run.report ?? "Отчёт не сохранён для этого запуска.", null, 2)}</pre>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => downloadJson(`test-run-${run.id}.json`, run)}>
            <Download className="size-4" aria-hidden="true" />
            Скачать JSON
          </Button>
          <Button variant="primary" onClick={onClose}>Закрыть</Button>
        </div>
      </Dialog>
    </div>
  );
}

function RunHistorySection({ runs }: Readonly<{ runs: readonly PlaygroundTestRun[] }>) {
  const [selectedRun, setSelectedRun] = React.useState<PlaygroundTestRun | null>(null);

  return (
    <Section>
      <div className="flex items-center gap-2">
        <History className="size-4 text-text-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold">История запусков</h2>
      </div>
      <p className="text-sm text-text-muted">Нажмите на запуск, чтобы посмотреть его полный результат.</p>
      <div className="grid gap-2">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            className="grid grid-cols-2 items-center gap-2 rounded-lg border border-border bg-surface p-3 text-left text-sm hover:bg-hover md:grid-cols-[1.2fr_1.1fr_0.8fr_0.7fr_0.7fr_0.7fr_0.9fr_0.6fr_0.6fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr]"
            onClick={() => setSelectedRun(run)}
          >
            <span className="text-text-muted">{formatDateTime(run.finishedAt)}</span>
            <span className="truncate text-text-muted">{runProductLabel(run)}</span>
            <span className="flex items-center gap-1">
              {run.status === "succeeded" ? <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> : <XCircle className="size-3.5 text-error" aria-hidden="true" />}
              {run.status === "succeeded" ? "успешно" : "с ошибкой"}
            </span>
            <span>{formatUsd(run.costUsd)}</span>
            <span>{formatMs(run.durationMs)}</span>
            <span>{run.qualityScore !== undefined ? `SQS ${Math.round(run.qualityScore)}%` : "—"}</span>
            <span className="truncate">{run.decision ?? "—"}</span>
            <span>{scoreFromReportResult(run.report, "truth_check") !== undefined ? `${Math.round(scoreFromReportResult(run.report, "truth_check")!)}%` : "—"}</span>
            <span>{scoreFromReportResult(run.report, "critical_facts_check") !== undefined ? `${Math.round(scoreFromReportResult(run.report, "critical_facts_check")!)}%` : "—"}</span>
            <span>{scoreFromReportResult(run.report, "context_utility_check") !== undefined ? `${Math.round(scoreFromReportResult(run.report, "context_utility_check")!)}%` : "—"}</span>
            <span>{scoreFromReportResult(run.report, "action_check") !== undefined ? `${Math.round(scoreFromReportResult(run.report, "action_check")!)}%` : "—"}</span>
            <span>{scoreFromReportResult(run.report, "presentation_check") !== undefined ? `${Math.round(scoreFromReportResult(run.report, "presentation_check")!)}%` : "—"}</span>
            <span className="truncate text-text-muted">{failedStage(run.report)}</span>
            <span className="truncate text-text-muted">{mainIssue(run.report)}</span>
          </button>
        ))}
      </div>
      {selectedRun ? <RunDetailDialog run={selectedRun} onClose={() => setSelectedRun(null)} /> : null}
    </Section>
  );
}

/**
 * Dashboard reads PlaygroundTestRun history (recorded by
 * PlaygroundScreen from Pipeline Lab v3's postMessage bridge) --
 * real captured numbers, never fabricated, per CLAUDE.md §2 principle 5
 * / R-010. Empty state is honest when a product has no recorded runs
 * yet, rather than showing zeroed-out charts as if they were real.
 */
export function DashboardScreen() {
  const { snapshot, selectProject } = useRepositoryStore();
  const { getRuns, runsByProjectId } = usePlaygroundTestRunStore();
  const [range, setRange] = React.useState<RangeOption>("all");
  const [projectFilter, setProjectFilter] = React.useState<string>(ALL_PROJECTS);
  const projects = React.useMemo(() => snapshot?.projects ?? [], [snapshot?.projects]);

  const allProjectRuns = React.useMemo(
    () => Object.values(runsByProjectId).flat().sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()),
    [runsByProjectId],
  );
  const productOptions = React.useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project.name]));
    for (const run of allProjectRuns) {
      if (!byId.has(run.projectId)) byId.set(run.projectId, runProductLabel(run));
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [allProjectRuns, projects]);
  const selectedProductName = productOptions.find((project) => project.id === projectFilter)?.name;
  const allRuns = projectFilter === ALL_PROJECTS
    ? allProjectRuns
    : allProjectRuns.filter((run) => run.projectId === projectFilter || (selectedProductName && runProductLabel(run) === selectedProductName));
  const runs = range === "all" ? allRuns : allRuns.slice(0, range);
  const stats = computeDashboardStats(runs);

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <p className="text-sm text-text-muted">Агрегированная статистика тестирования продукта в Песочнице — по многим запускам, а не по одному отчёту.</p>
      </div>

      <Section>
        <div className="flex flex-wrap items-center gap-4">
          <label className="grid gap-1 text-sm">
            Продукт
            <Select
              value={projectFilter}
              onChange={(event) => {
                const nextProjectId = event.target.value;
                setProjectFilter(nextProjectId);
                if (nextProjectId !== ALL_PROJECTS) selectProject(nextProjectId);
              }}
              className="min-w-64"
              aria-label="Выбрать продукт"
            >
              <option value={ALL_PROJECTS}>Все продукты</option>
              {productOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-1 text-sm">
            Период истории
            <SegmentedControl>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  className={`rounded-[4px] px-3 py-1 text-sm transition-colors ${option === range ? "bg-primary text-primary-foreground" : "text-text-muted hover:bg-hover"}`}
                >
                  {option === "all" ? "Все" : option}
                </button>
              ))}
            </SegmentedControl>
          </div>
          <Badge tone="info">{stats.runCount} запуск(ов) в выборке · {allRuns.length} всего</Badge>
        </div>
      </Section>

      {stats.runCount === 0 ? (
        <EmptyState>Для этого продукта ещё нет протестированных запусков. Откройте «Песочницу» и запустите Pipeline Lab v3.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={<Gauge className="size-4" aria-hidden="true" />} label="Точность (средняя оценка качества)" value={stats.averageQualityScore ? `${Math.round(stats.averageQualityScore)}%` : "—"} />
            <StatCard
              icon={<Wallet className="size-4" aria-hidden="true" />}
              label="Стоимость"
              value={formatUsd(stats.lastCostUsd)}
              hint={`среднее ${formatUsd(stats.averageCostUsd)} · мин ${formatUsd(stats.minCostUsd)} · макс ${formatUsd(stats.maxCostUsd)}`}
            />
            <StatCard icon={<Timer className="size-4" aria-hidden="true" />} label="Среднее время" value={formatMs(stats.averageDurationMs)} />
            <StatCard icon={<CheckCircle2 className="size-4" aria-hidden="true" />} label="Доля успешных" value={formatPercent(stats.successRate)} hint={`${stats.successCount} успешно · ${stats.failureCount} с ошибкой`} />
            <StatCard icon={<Gauge className="size-4" aria-hidden="true" />} label="Средняя уверенность" value={stats.averageConfidence ? stats.averageConfidence.toFixed(2) : "—"} />
            <StatCard icon={<AlertTriangle className="size-4" aria-hidden="true" />} label="Ошибки / предупреждения (среднее)" value={`${stats.averageErrorCount.toFixed(1)} / ${stats.averageWarningCount.toFixed(1)}`} />
            <StatCard icon={<CheckCircle2 className="size-4" aria-hidden="true" />} label="Успешные запуски" value={String(stats.successCount)} />
            <StatCard icon={<AlertTriangle className="size-4" aria-hidden="true" />} label="Неуспешные запуски" value={String(stats.failureCount)} />
          </div>

          <Section>
            <div className="flex items-center gap-2">
              <LineChartIcon className="size-4 text-text-muted" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Графики</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Точность</p>
                <LineChart points={stats.qualityScoreSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--success))" formatValue={(value) => `${Math.round(value)}%`} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Стоимость</p>
                <LineChart points={stats.costSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--warning))" formatValue={formatUsd} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Скорость</p>
                <LineChart points={stats.durationSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--info))" formatValue={formatMs} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Уверенность</p>
                <LineChart points={stats.confidenceSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--primary))" formatValue={(value) => value.toFixed(2)} />
              </Card>
            </div>
          </Section>

          <Section>
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-text-muted" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Качество Summary</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {stats.decisionShares.map((item) => (
                <StatCard key={item.decision} icon={<CheckCircle2 className="size-4" aria-hidden="true" />} label={item.decision} value={formatPercent(item.rate)} hint={`${item.count} запуск(ов)`} />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Качество по проверщикам</p>
                <LineChart points={stats.judgeScores.map((item) => ({ label: item.label, value: item.averageScore }))} stroke="hsl(var(--primary))" formatValue={(value) => `${Math.round(value)}%`} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Топ причин MANUAL_REVIEW / RETRY</p>
                {stats.topReviewReasons.length ? (
                  <div className="grid gap-2">
                    {stats.topReviewReasons.map((item) => (
                      <div key={item.reason} className="grid grid-cols-[1fr_48px] gap-2 rounded-md bg-muted p-2 text-sm">
                        <span className="truncate">{item.reason}</span>
                        <span className="text-right text-text-muted">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Пока нет причин для ручной проверки или повтора.</p>
                )}
              </Card>
            </div>
          </Section>

          <Section>
            <div className="flex items-center gap-2">
              <Timer className="size-4 text-text-muted" aria-hidden="true" />
              <h2 className="text-lg font-semibold">Средняя оценка, время и стоимость по этапам</h2>
            </div>
            <div className="overflow-auto rounded-lg border border-border">
              <div className="grid min-w-[680px] grid-cols-[1.5fr_100px_120px_120px_80px] gap-2 border-b border-border bg-muted px-3 py-2 text-xs font-medium text-text-muted">
                <span>Этап</span>
                <span>Score</span>
                <span>Время</span>
                <span>Стоимость</span>
                <span>Запусков</span>
              </div>
              {stats.stageScores.map((item) => (
                <div key={item.key} className="grid min-w-[680px] grid-cols-[1.5fr_100px_120px_120px_80px] gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
                  <span className="truncate">{item.label}</span>
                  <span>{Math.round(item.averageScore)}%</span>
                  <span>{formatMs(item.averageDurationMs)}</span>
                  <span>{formatUsd(item.averageCostUsd)}</span>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>
          </Section>

          <RunHistorySection runs={runs} />
        </>
      )}
    </Page>
  );
}

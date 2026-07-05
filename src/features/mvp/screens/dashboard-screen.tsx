"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Gauge, LineChart as LineChartIcon, Timer, Wallet } from "lucide-react";
import { Badge, Card, EmptyState, LineChart, Page, Section, SegmentedControl, Select } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { usePlaygroundTestRunStore } from "@/shared/stores/playground-test-run-store";
import { computeDashboardStats } from "@/shared/evaluation/playground-dashboard-analytics";

const RANGE_OPTIONS = [5, 10, 20, 50, 100] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
function formatMs(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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

/**
 * Dashboard reads PlaygroundTestRun history (recorded by
 * PlaygroundScreen from Pipeline Lab v3's postMessage bridge) --
 * real captured numbers, never fabricated, per CLAUDE.md §2 principle 5
 * / R-010. Empty state is honest when a product has no recorded runs
 * yet, rather than showing zeroed-out charts as if they were real.
 */
export function DashboardScreen() {
  const { snapshot, selectedProjectId, selectProject } = useRepositoryStore();
  const { getRuns } = usePlaygroundTestRunStore();
  const [range, setRange] = React.useState<RangeOption>(20);
  const projects = snapshot?.projects ?? [];

  const allRuns = selectedProjectId ? getRuns(selectedProjectId) : [];
  const runs = allRuns.slice(0, range);
  const stats = computeDashboardStats(runs);

  return (
    <Page className="max-w-none">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-text-muted">Агрегированная статистика тестирования продукта в Playground — по многим запускам, а не по одному отчёту.</p>
      </div>

      <Section>
        <div className="flex flex-wrap items-center gap-4">
          <label className="grid gap-1 text-sm">
            Продукт
            <Select value={selectedProjectId ?? ""} onChange={(event) => selectProject(event.target.value)} className="min-w-64" aria-label="Выбрать продукт">
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid gap-1 text-sm">
            Последние N итераций
            <SegmentedControl>
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  className={`rounded-[4px] px-3 py-1 text-sm transition-colors ${option === range ? "bg-primary text-primary-foreground" : "text-text-muted hover:bg-hover"}`}
                >
                  {option}
                </button>
              ))}
            </SegmentedControl>
          </div>
          <Badge tone="info">{stats.runCount} запуск(ов) в выборке · {allRuns.length} всего</Badge>
        </div>
      </Section>

      {stats.runCount === 0 ? (
        <EmptyState>Для этого продукта ещё нет протестированных запусков. Откройте Playground и запустите Pipeline Lab v3.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={<Gauge className="size-4" aria-hidden="true" />} label="Accuracy (avg quality score)" value={stats.averageQualityScore ? `${Math.round(stats.averageQualityScore)}%` : "—"} />
            <StatCard
              icon={<Wallet className="size-4" aria-hidden="true" />}
              label="Cost"
              value={formatUsd(stats.lastCostUsd)}
              hint={`avg ${formatUsd(stats.averageCostUsd)} · min ${formatUsd(stats.minCostUsd)} · max ${formatUsd(stats.maxCostUsd)}`}
            />
            <StatCard icon={<Timer className="size-4" aria-hidden="true" />} label="Average Time" value={formatMs(stats.averageDurationMs)} />
            <StatCard icon={<CheckCircle2 className="size-4" aria-hidden="true" />} label="Success Rate" value={formatPercent(stats.successRate)} hint={`${stats.successCount} успешно · ${stats.failureCount} с ошибкой`} />
            <StatCard icon={<Gauge className="size-4" aria-hidden="true" />} label="Average Confidence" value={stats.averageConfidence ? stats.averageConfidence.toFixed(2) : "—"} />
            <StatCard icon={<AlertTriangle className="size-4" aria-hidden="true" />} label="Avg Errors / Warnings" value={`${stats.averageErrorCount.toFixed(1)} / ${stats.averageWarningCount.toFixed(1)}`} />
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
                <p className="text-sm font-medium">Accuracy по времени</p>
                <LineChart points={stats.qualityScoreSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--success))" formatValue={(value) => `${Math.round(value)}%`} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Стоимость по времени</p>
                <LineChart points={stats.costSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--warning))" formatValue={formatUsd} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Скорость (длительность запуска)</p>
                <LineChart points={stats.durationSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--info))" formatValue={formatMs} />
              </Card>
              <Card className="grid gap-2">
                <p className="text-sm font-medium">Confidence по времени</p>
                <LineChart points={stats.confidenceSeries.map((point) => ({ label: point.timestamp, value: point.value }))} stroke="hsl(var(--primary))" formatValue={(value) => value.toFixed(2)} />
              </Card>
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}

import type { PlaygroundTestRun } from "@/entities/PlaygroundTestRun/model/types";

/**
 * Aggregates a slice of PlaygroundTestRun history (already limited to the
 * user-selected range -- last 5/10/20/50/100 -- by the Dashboard screen)
 * into the stat-card/chart numbers Dashboard renders. Pure and side-effect
 * free so it's independently testable (PT-1) without a store or DOM.
 */

export type DashboardSeriesPoint = Readonly<{ runId: string; timestamp: string; value: number }>;
export type StageScoreStat = Readonly<{ key: string; label: string; averageScore: number; averageDurationMs: number; averageCostUsd: number; count: number }>;
export type DecisionShare = Readonly<{ decision: string; count: number; rate: number }>;
export type ReasonStat = Readonly<{ reason: string; count: number }>;

export type DashboardStats = Readonly<{
  runCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageQualityScore: number;
  averageConfidence: number;
  averageCostUsd: number;
  lastCostUsd: number;
  minCostUsd: number;
  maxCostUsd: number;
  averageDurationMs: number;
  averageErrorCount: number;
  averageWarningCount: number;
  qualityScoreSeries: readonly DashboardSeriesPoint[];
  costSeries: readonly DashboardSeriesPoint[];
  durationSeries: readonly DashboardSeriesPoint[];
  confidenceSeries: readonly DashboardSeriesPoint[];
  stageScores: readonly StageScoreStat[];
  judgeScores: readonly StageScoreStat[];
  decisionShares: readonly DecisionShare[];
  topReviewReasons: readonly ReasonStat[];
}>;

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toSeries(runs: readonly PlaygroundTestRun[], pick: (run: PlaygroundTestRun) => number | undefined): DashboardSeriesPoint[] {
  // Runs are stored newest-first (playground-test-run-store.ts); charts
  // read left-to-right as oldest-to-newest, so reverse here once.
  return [...runs]
    .reverse()
    .map((run) => ({ runId: run.id, timestamp: run.finishedAt, value: pick(run) }))
    .filter((point): point is DashboardSeriesPoint => point.value !== undefined);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeScore(value: unknown): number | undefined {
  const score = num(value);
  if (score === undefined) return undefined;
  const normalized = score >= 0 && score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, normalized));
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function reportResult(run: PlaygroundTestRun): Record<string, unknown> | null {
  const report = asRecord(run.report);
  return asRecord(report?.result);
}

function stageReports(run: PlaygroundTestRun): readonly Record<string, unknown>[] {
  const report = asRecord(run.report);
  const value = report?.stageReports;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item))) : [];
}

function stageLabel(item: Record<string, unknown>): string | undefined {
  const stage = asRecord(item.stage);
  return text(stage?.name);
}

function stageKey(label: string): string {
  const pairs: readonly [RegExp, string][] = [
    [/STT/i, "stt"],
    [/Валидация/i, "validation"],
    [/Извлечение фактов/i, "facts"],
    [/Потребности/i, "needs"],
    [/Результат звонка/i, "outcome"],
    [/Генерация саммари/i, "summary"],
    [/достоверности/i, "truth_check"],
    [/критически важных/i, "critical_facts_check"],
    [/полезности/i, "context_utility_check"],
    [/договор/i, "action_check"],
    [/формата/i, "presentation_check"],
    [/Summary Quality Gate/i, "summary_quality_gate"],
  ];
  return pairs.find(([rx]) => rx.test(label))?.[1] ?? label;
}

function scoreFromRecord(value: unknown): number | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return (
    normalizeScore(record.score) ??
    normalizeScore(record.summary_quality_score) ??
    // Кастомные (user-edited) проверщики Pipeline Lab v3 кладут оценку в
    // scores.overall (шкала 0-100) -- то же чтение добавлено в сам
    // pipeline-lab-v3.html (2026-07-10, fix "все этапы показывают 90%").
    normalizeScore(asRecord(record.scores)?.overall) ??
    normalizeScore(asRecord(record.raw)?.score) ??
    normalizeScore(asRecord(record.fact_check_quality)?.score) ??
    normalizeScore(asRecord(record.need_check_quality)?.score) ??
    normalizeScore(asRecord(record.outcome_check_quality)?.score) ??
    normalizeScore(asRecord(record.quality)?.store_score) ??
    normalizeScore(asRecord(record.quality)?.stt_quality_score)
  );
}

export function scoreFromReportResult(report: unknown, key: string): number | undefined {
  const result = asRecord(asRecord(report)?.result);
  const direct = scoreFromRecord(result?.[key]);
  if (direct !== undefined) return direct;

  const gate = asRecord(result?.summary_quality_gate);
  const scores = asRecord(gate?.scores);
  const fromGateScores = normalizeScore(scores?.[key]);
  if (fromGateScores !== undefined) return fromGateScores;

  const judges = asRecord(gate?.judges);
  return scoreFromRecord(judges?.[key]);
}

export function scoreFromStageReport(item: Record<string, unknown>): { score: number; durationMs: number; costUsd: number } | null {
  const report = asRecord(item.report);
  const meta = asRecord(report?.meta);
  const score = scoreFromRecord(meta) ?? scoreFromRecord(report?.output) ?? scoreFromRecord(report);
  if (score === undefined) return null;
  return { score, durationMs: num(meta?.durationMs) ?? num(report?.ms) ?? 0, costUsd: num(meta?.cost) ?? num(report?.cost) ?? 0 };
}

function aggregateStages(runs: readonly PlaygroundTestRun[], judgeOnly: boolean): StageScoreStat[] {
  const map = new Map<string, { label: string; scores: number[]; durations: number[]; costs: number[] }>();
  const judgeKeys = new Set(["truth_check", "critical_facts_check", "context_utility_check", "action_check", "presentation_check"]);
  for (const run of runs) {
    for (const item of stageReports(run)) {
      const label = stageLabel(item);
      const stat = scoreFromStageReport(item);
      if (!label || !stat) continue;
      const key = stageKey(label);
      if (judgeOnly !== judgeKeys.has(key)) continue;
      const entry = map.get(key) ?? { label, scores: [], durations: [], costs: [] };
      entry.scores.push(stat.score);
      entry.durations.push(stat.durationMs);
      entry.costs.push(stat.costUsd);
      map.set(key, entry);
    }
  }
  return [...map.entries()].map(([key, value]) => ({
    key,
    label: value.label,
    averageScore: average(value.scores),
    averageDurationMs: average(value.durations),
    averageCostUsd: average(value.costs),
    count: value.scores.length,
  }));
}

function decisionShares(runs: readonly PlaygroundTestRun[]): DecisionShare[] {
  const decisions = ["AUTO_SAVE", "MANUAL_REVIEW", "RETRY"];
  return decisions.map((decision) => {
    const count = runs.filter((run) => run.decision === decision).length;
    return { decision, count, rate: runs.length === 0 ? 0 : count / runs.length };
  });
}

function collectReasonTexts(run: PlaygroundTestRun): string[] {
  const result = reportResult(run);
  const gate = asRecord(result?.summary_quality_gate);
  const presentation = asRecord(result?.presentation_check);
  const critical = asRecord(result?.critical_facts_check);
  const candidates = [
    gate?.critical_errors,
    gate?.warnings,
    presentation?.forbidden_card_duplicates,
    presentation?.readability_issues,
    presentation?.forbidden_phrases,
    critical?.missed_critical_facts,
  ];
  return candidates.flatMap((value) => (Array.isArray(value) ? value : [])).map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
}

function topReasons(runs: readonly PlaygroundTestRun[]): ReasonStat[] {
  const counts = new Map<string, number>();
  for (const run of runs.filter((item) => item.decision === "MANUAL_REVIEW" || item.decision === "RETRY")) {
    for (const reason of collectReasonTexts(run)) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count }));
}

export function computeDashboardStats(runs: readonly PlaygroundTestRun[]): DashboardStats {
  const successCount = runs.filter((run) => run.status === "succeeded").length;
  const failureCount = runs.length - successCount;
  const costs = runs.map((run) => run.costUsd);
  const qualityScores = runs.map((run) => run.qualityScore).filter((value): value is number => value !== undefined);
  const confidences = runs.map((run) => run.confidence).filter((value): value is number => value !== undefined);
  const durations = runs.map((run) => run.durationMs);

  return {
    runCount: runs.length,
    successCount,
    failureCount,
    successRate: runs.length === 0 ? 0 : successCount / runs.length,
    averageQualityScore: average(qualityScores),
    averageConfidence: average(confidences),
    averageCostUsd: average(costs),
    // runs[0] is the most recent (newest-first storage order).
    lastCostUsd: runs[0]?.costUsd ?? 0,
    minCostUsd: costs.length === 0 ? 0 : Math.min(...costs),
    maxCostUsd: costs.length === 0 ? 0 : Math.max(...costs),
    averageDurationMs: average(durations),
    averageErrorCount: average(runs.map((run) => run.errorCount)),
    averageWarningCount: average(runs.map((run) => run.warningCount)),
    qualityScoreSeries: toSeries(runs, (run) => run.qualityScore),
    costSeries: toSeries(runs, (run) => run.costUsd),
    durationSeries: toSeries(runs, (run) => run.durationMs),
    confidenceSeries: toSeries(runs, (run) => run.confidence),
    stageScores: aggregateStages(runs, false),
    judgeScores: aggregateStages(runs, true),
    decisionShares: decisionShares(runs),
    topReviewReasons: topReasons(runs),
  };
}

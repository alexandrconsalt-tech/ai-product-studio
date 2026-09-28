"use client";

import { Alert, Button, Card } from "@/shared/ui";
import type { ExperimentRun } from "../domain/schema";
import { aggregateFloorPlanRuns } from "../benchmark/aggregate";

const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const number = (value: number | null) => value === null ? "—" : value.toFixed(2);

export function BenchmarkDashboard({ runs, onClear }: { runs: ExperimentRun[]; onClear: () => void }) {
  const rows = aggregateFloorPlanRuns(runs);
  const documents = new Set(runs.map((run) => run.sourceHash)).size;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Benchmark</h2><p className="text-sm text-text-muted">Документов: {documents} · запусков: {runs.length} · цель: ≥ 30 документов</p></div><Button variant="danger" disabled={!runs.length} onClick={onClear}>Удалить историю PoC</Button></div>
      <Alert tone={documents >= 30 ? "success" : "warning"}>Главная метрика — готовность к публикации без исправления геометрии ≥ 80%. Явные площади следует проверять отдельно с целевой точностью ≥ 95%.</Alert>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => <Card key={row.key} className="grid gap-3"><div className="flex items-center justify-between"><h3 className="font-semibold">{row.label}</h3><span className="text-xs text-text-muted">{row.evaluated}/{row.runs} оценено</span></div><div className="grid grid-cols-2 gap-3 text-sm"><Metric label="Готово к публикации без критической ошибки" value={percent(row.publishableRate)} /><Metric label="Критические ошибки геометрии" value={percent(row.criticalErrorRate)} /><Metric label="Точность геометрии" value={number(row.averageGeometry)} /><Metric label="Соответствие исходнику" value={number(row.averageSourceFidelity)} /><Metric label="Качество визуализации" value={number(row.averageQuality)} /><Metric label="Среднее количество исправлений (5+ = 5)" value={number(row.averageManualCorrections)} /><Metric label="Средняя QA-оценка" value={row.averageQaScore === null ? "—" : percent(row.averageQaScore * 100)} /><Metric label="Среднее число auto-fix" value={number(row.averageAutoFixes)} /><Metric label="Средняя длительность" value={row.averageLatency === null ? "—" : `${(row.averageLatency / 1000).toFixed(1)} с`} /><Metric label="Средняя стоимость" value={row.averageCost === null ? "нет данных API" : `${row.averageCost.toFixed(2)} ₽`} /></div></Card>)}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-secondary p-3"><div className="text-xs text-text-muted">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>; }

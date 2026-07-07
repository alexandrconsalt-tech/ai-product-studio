"use client";

import * as React from "react";
import { Download, FileJson } from "lucide-react";
import { Button, Input, Panel, Select } from "@/shared/ui";
import { downloadCsv, downloadJson, getGoldenDataset, getRecords } from "./storage";
import type { DifferenceStatus, HumanDecision, ReviewRecord } from "./types";

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function barWidth(value: number, max: number) {
  return `${Math.max(4, Math.round((value / Math.max(max, 1)) * 100))}%`;
}

export function ReportWorkspace() {
  const [records, setRecords] = React.useState<ReviewRecord[]>([]);
  const [reviewer, setReviewer] = React.useState("");
  const [role, setRole] = React.useState("Все");
  const [aiDecision, setAiDecision] = React.useState("Все");
  const [humanDecision, setHumanDecision] = React.useState<HumanDecision | "Все">("Все");
  const [golden, setGolden] = React.useState("Все");
  const [diffStatus, setDiffStatus] = React.useState<DifferenceStatus | "Все">("Все");

  React.useEffect(() => {
    setRecords(getRecords());
  }, []);

  const filtered = records.filter((record) => {
    return (
      (!reviewer || record.review?.reviewerName.toLowerCase().includes(reviewer.toLowerCase())) &&
      (role === "Все" || record.review?.reviewerRole === role) &&
      (aiDecision === "Все" || record.run.aiDecision === aiDecision) &&
      (humanDecision === "Все" || record.review?.humanDecision === humanDecision) &&
      (golden === "Все" || (golden === "Да" ? record.isGolden : !record.isGolden)) &&
      (diffStatus === "Все" || record.differenceStatus === diffStatus)
    );
  });

  const reviewed = filtered.filter((record) => record.review);
  const metrics = [
    ["Всего оценено", String(reviewed.length)],
    ["Средний AI Score", avg(reviewed.map((record) => record.run.aiScore)).toFixed(1)],
    ["Средний Human Score", avg(reviewed.map((record) => record.review?.humanScore ?? 0)).toFixed(1)],
    ["Среднее расхождение", avg(reviewed.map((record) => record.difference ?? 0)).toFixed(1)],
    ["Доля совпадений AI/Human", `${Math.round((reviewed.filter((record) => record.differenceStatus === "Совпадает").length / Math.max(reviewed.length, 1)) * 100)}%`],
    ["Количество Golden Dataset", String(filtered.filter((record) => record.isGolden).length)],
    ["Доля RETRY", `${Math.round((filtered.filter((record) => record.run.aiDecision === "RETRY").length / Math.max(filtered.length, 1)) * 100)}%`],
    ["Доля Manual Review", `${Math.round((filtered.filter((record) => record.run.aiDecision === "MANUAL_REVIEW").length / Math.max(filtered.length, 1)) * 100)}%`],
  ];

  const blockAverages = [
    ["Достоверность", avg(reviewed.map((record) => record.review?.truthScore ?? 0))],
    ["Критические факты", avg(reviewed.map((record) => record.review?.criticalFactsScore ?? 0))],
    ["Полезность", avg(reviewed.map((record) => record.review?.utilityScore ?? 0))],
    ["Следующий шаг", avg(reviewed.map((record) => record.review?.actionScore ?? 0))],
    ["Формат", avg(reviewed.map((record) => record.review?.formatScore ?? 0))],
  ];

  const lowReasons = Object.entries(
    reviewed.reduce<Record<string, number>>((acc, record) => {
      Object.entries(record.review?.criteriaJson ?? {}).forEach(([key, value]) => {
        if (value === "no" || value === "partial") acc[key] = (acc[key] ?? 0) + 1;
      });
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const exportCsv = () => {
    downloadCsv("summary-review-report.csv", [
      ["id", "date", "client", "ai_score", "human_score", "diff", "ai_decision", "human_decision", "golden", "reviewer", "status"],
      ...filtered.map((record) => [
        record.run.id,
        record.run.createdAt,
        record.run.clientName,
        String(record.run.aiScore),
        String(record.review?.humanScore ?? ""),
        String(record.difference ?? ""),
        String(record.run.aiDecision),
        String(record.review?.humanDecision ?? ""),
        record.isGolden ? "GOLDEN_DATASET" : "",
        record.review?.reviewerName ?? "",
        record.reviewStatus,
      ]),
    ]);
  };

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Отчёт по оценке</h1>
          <p className="text-sm text-text-muted">Сравнение AI Score и ручной оценки пользователей.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv}><Download className="size-4" />Экспорт CSV</Button>
          <Button onClick={() => downloadJson("golden-dataset.json", getGoldenDataset())}><FileJson className="size-4" />Экспорт Golden Dataset</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {metrics.map(([label, value]) => (
          <Panel key={label} className="p-3">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-2 text-xl font-semibold">{value}</p>
          </Panel>
        ))}
      </div>

      <Panel className="grid gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
        <Input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Оценщик" />
        <Select value={role} onChange={(event) => setRole(event.target.value)}><option>Все</option><option>Агент</option><option>РОП</option><option>Продакт</option><option>QA</option><option>Другое</option></Select>
        <Select value={aiDecision} onChange={(event) => setAiDecision(event.target.value)}><option>Все</option><option>AUTO_SAVE</option><option>MANUAL_REVIEW</option><option>RETRY</option></Select>
        <Select value={humanDecision} onChange={(event) => setHumanDecision(event.target.value as HumanDecision | "Все")}><option>Все</option><option>EXCELLENT</option><option>GOOD</option><option>ACCEPTABLE</option><option>NEEDS_REWORK</option></Select>
        <Select value={golden} onChange={(event) => setGolden(event.target.value)}><option>Все</option><option>Да</option><option>Нет</option></Select>
        <Select value={diffStatus} onChange={(event) => setDiffStatus(event.target.value as DifferenceStatus | "Все")}><option>Все</option><option>Совпадает</option><option>Допустимое расхождение</option><option>Требует анализа</option></Select>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-4">
        <Panel className="p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">AI Score vs Human Score</h2>
          <div className="space-y-2">
            {reviewed.slice(0, 8).map((record) => (
              <div key={record.run.id} className="grid grid-cols-[120px_1fr_48px] items-center gap-2 text-xs">
                <span className="truncate">{record.run.clientName}</span>
                <div className="space-y-1">
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-info" style={{ width: barWidth(record.run.aiScore, 100) }} /></div>
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-success" style={{ width: barWidth(record.review?.humanScore ?? 0, 100) }} /></div>
                </div>
                <span>{record.difference?.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Средний score по блокам</h2>
          <div className="space-y-3">
            {blockAverages.map(([label, value]) => (
              <div key={label as string} className="text-xs">
                <div className="mb-1 flex justify-between"><span>{label}</span><span>{Number(value).toFixed(1)}</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: barWidth(Number(value), 100) }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Топ причин низкой оценки</h2>
          <div className="space-y-2 text-xs">
            {lowReasons.length ? lowReasons.map(([key, value]) => <p key={key} className="flex justify-between gap-3"><span className="truncate">{key}</span><span>{value}</span></p>) : <p className="text-text-muted">Нет данных</p>}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border text-xs text-text-muted">
            <tr>{["id", "дата", "клиент", "AI Score", "Human Score", "разница", "AI Decision", "Human Decision", "Golden", "оценщик", "статус"].map((head) => <th key={head} className="p-3 font-medium">{head}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={record.run.id} className="border-b border-border/60">
                <td className="p-3 font-mono text-xs">{record.run.id}</td>
                <td className="p-3">{new Date(record.run.createdAt).toLocaleDateString("ru-RU")}</td>
                <td className="p-3">{record.run.clientName}</td>
                <td className="p-3">{record.run.aiScore}</td>
                <td className="p-3">{record.review?.humanScore.toFixed(1) ?? ""}</td>
                <td className="p-3">{record.difference?.toFixed(1) ?? ""} {record.differenceStatus !== "Нет оценки" ? `· ${record.differenceStatus}` : ""}</td>
                <td className="p-3">{record.run.aiDecision}</td>
                <td className="p-3">{record.review?.humanDecision ?? ""}</td>
                <td className="p-3">{record.isGolden ? <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-semibold text-yellow-950">GOLDEN</span> : ""}</td>
                <td className="p-3">{record.review?.reviewerName ?? ""}</td>
                <td className="p-3">{record.reviewStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}


"use client";

import * as React from "react";
import { Check, Clipboard, FileJson, Search, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Panel, Select, Textarea } from "@/shared/ui";
import { normalizePlaygroundRun } from "./importer";
import { buildReview, createDefaultCriteria, getAllBlockScores, getHumanDecision, getHumanScore, reviewBlocks, reviewerRoles } from "./scoring";
import { sampleRun } from "./sample-data";
import { getReview, getRun, saveReview, saveRun } from "./storage";
import type { CriterionValue, ReviewerRole, SummaryRun } from "./types";

type ReviewWorkspaceProps = {
  runId?: string;
  embedded?: boolean;
};

const optionLabels: Record<CriterionValue, string> = {
  yes: "Да",
  partial: "Частично",
  no: "Нет",
  na: "Не обсуждалось",
};

const optionClasses: Record<CriterionValue, string> = {
  yes: "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200",
  partial: "border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
  no: "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  na: "border-border bg-muted text-text-muted",
};

function decodePayload(payload: string | null): unknown | null {
  if (!payload) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(window.atob(payload))));
  } catch {
    return null;
  }
}

function aiIssues(run: SummaryRun): string[] {
  const json = run.aiJudgesJson;
  if (!json || typeof json !== "object") return [];
  const issues: string[] = [];
  Object.entries(json as Record<string, unknown>).forEach(([key, value]) => {
    if (value && typeof value === "object" && Array.isArray((value as { issues?: unknown }).issues)) {
      (value as { issues: unknown[] }).issues.forEach((issue) => {
        if (typeof issue === "string" && issue.trim()) issues.push(`${key}: ${issue}`);
      });
    }
  });
  return issues.slice(0, 5);
}

function extractSpeakerLines(transcript: string, query: string, visibleRoles: Record<string, boolean>) {
  const lines = transcript.split(/\n+/).filter(Boolean);
  return lines.filter((line) => {
    const role = line.split(":")[0]?.trim();
    const roleVisible = role in visibleRoles ? visibleRoles[role] : true;
    return roleVisible && (!query || line.toLowerCase().includes(query.toLowerCase()));
  });
}

export function ReviewWorkspace({ runId, embedded = false }: ReviewWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const effectiveRunId = runId ?? searchParams.get("runId") ?? undefined;
  const [run, setRun] = React.useState<SummaryRun | null>(null);
  const [criteria, setCriteria] = React.useState<Record<string, CriterionValue>>(createDefaultCriteria);
  const [reviewerName, setReviewerName] = React.useState("");
  const [reviewerRole, setReviewerRole] = React.useState<ReviewerRole>("QA");
  const [comment, setComment] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [visibleRoles, setVisibleRoles] = React.useState<Record<string, boolean>>({ Оператор: true, Агент: true, Клиент: true });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const payloadRun = decodePayload(searchParams.get("payload"));
    if (payloadRun) {
      const imported = normalizePlaygroundRun(payloadRun);
      saveRun(imported);
      setRun(imported);
      return;
    }

    if (effectiveRunId) {
      const stored = getRun(effectiveRunId);
      if (stored) {
        setRun(stored);
        const review = getReview(effectiveRunId);
        if (review) {
          setCriteria(review.criteriaJson);
          setReviewerName(review.reviewerName);
          setReviewerRole(review.reviewerRole);
          setComment(review.comment);
        }
      }
    }
  }, [effectiveRunId, searchParams]);

  const blockScores = getAllBlockScores(criteria);
  const humanScore = getHumanScore(criteria);
  const humanDecision = getHumanDecision(humanScore);
  const transcriptLines = run ? extractSpeakerLines(run.transcript, query, visibleRoles) : [];

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const json = JSON.parse(await file.text());
    const imported = normalizePlaygroundRun(json);
    saveRun(imported);
    setRun(imported);
    setSaved(false);
    router.push(embedded ? `/?view=summary-review&runId=${imported.id}` : `/review/${imported.id}`);
  };

  const loadDemo = () => {
    saveRun(sampleRun);
    setRun(sampleRun);
    setSaved(false);
    router.push(embedded ? `/?view=summary-review&runId=${sampleRun.id}` : `/review/${sampleRun.id}`);
  };

  const save = () => {
    if (!run) return;
    const review = buildReview({ runId: run.id, reviewerName, reviewerRole, criteria, comment });
    saveReview(review);
    setSaved(true);
    router.push(embedded ? "/?view=summary-report" : "/reports");
  };

  if (!run) {
    return (
      <div className="flex min-h-full flex-col gap-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Оценка качества Summary</h1>
          <p className="mt-1 text-sm text-text-muted">Загрузите pipeline_report.json из Playground или откройте демо-запуск.</p>
        </div>
        <Panel className="flex max-w-2xl flex-col gap-4 p-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface p-8 text-sm hover:bg-hover">
            <Upload className="size-4" aria-hidden="true" />
            Загрузить pipeline_report.json
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0])} />
          </label>
          <Button onClick={loadDemo}>Открыть демо-запуск</Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Оценка качества Summary</h1>
          <p className="text-sm text-text-muted">{run.clientName} · {new Date(run.createdAt).toLocaleString("ru-RU")} · {run.id}</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          Human Score: <span className="font-semibold">{humanScore.toFixed(1)}</span> · {humanDecision}
        </div>
      </div>

      <div className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.85fr_1.15fr]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Search className="size-4 text-text-muted" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по транскрибации" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(visibleRoles).map((role) => (
                <Button key={role} size="sm" variant={visibleRoles[role] ? "secondary" : "ghost"} onClick={() => setVisibleRoles((prev) => ({ ...prev, [role]: !prev[role] }))}>
                  {role}
                </Button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3 text-sm leading-6">
            {transcriptLines.map((line, index) => (
              <p key={`${line}-${index}`} className="rounded-md bg-muted/50 px-3 py-2">{line}</p>
            ))}
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col gap-3 overflow-auto p-4">
          <div>
            <h2 className="text-lg font-semibold">Итоговое саммари</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-6">{run.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-border p-3">AI Score<br /><span className="text-xl font-semibold">{run.aiScore}</span></div>
            <div className="rounded-md border border-border p-3">AI Decision<br /><span className="text-base font-semibold">{run.aiDecision}</span></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Краткие AI-проблемы</h3>
            <div className="mt-2 space-y-2 text-sm text-text-muted">
              {aiIssues(run).length ? aiIssues(run).map((issue) => <p key={issue}>• {issue}</p>) : <p>Критичные проблемы не найдены.</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void navigator.clipboard.writeText(run.summary)}><Clipboard className="size-4" />Скопировать саммари</Button>
          </div>
          <details className="rounded-md border border-border p-3 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-medium"><FileJson className="size-4" />Открыть полный JSON</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{JSON.stringify(run.sourceRunJson, null, 2)}</pre>
          </details>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-auto p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ручная оценка</h2>
            {saved ? <span className="inline-flex items-center gap-1 text-sm text-green-700"><Check className="size-4" />Сохранено</span> : null}
          </div>
          <div className="space-y-4">
            {reviewBlocks.map((block) => {
              const scoreKey = `${block.id}Score` as keyof typeof blockScores;
              return (
                <section key={block.id} className="rounded-md border border-border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{block.title}</h3>
                    <span className="text-sm text-text-muted">{Number(blockScores[scoreKey]).toFixed(1)} · {Math.round(block.weight * 100)}%</span>
                  </div>
                  <div className="space-y-3">
                    {block.criteria.map((criterion) => {
                      const options: CriterionValue[] = criterion.allowNa ? ["yes", "partial", "no", "na"] : ["yes", "partial", "no"];
                      return (
                        <div key={criterion.id} className="space-y-2">
                          <p className="text-sm">{criterion.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {options.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setCriteria((prev) => ({ ...prev, [criterion.id]: option }))}
                                className={`h-8 rounded-full border px-3 text-xs font-medium ${criteria[criterion.id] === option ? optionClasses[option] : "border-border bg-background text-text-muted"}`}
                              >
                                {option === "na" ? criterion.naLabel : optionLabels[option]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder="Имя оценщика" />
            <Select value={reviewerRole} onChange={(event) => setReviewerRole(event.target.value as ReviewerRole)}>
              {reviewerRoles.map((role) => <option key={role}>{role}</option>)}
            </Select>
          </div>
          <Textarea className="mt-3" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий оценщика" />
          <Button className="mt-3" variant="primary" onClick={save}>Сохранить оценку</Button>
        </Panel>
      </div>
    </div>
  );
}

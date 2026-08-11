"use client";

import * as React from "react";
import { ArrowLeft, Check, Clipboard, FileJson, Search, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Panel, Select, Textarea } from "@/shared/ui";
import { formatSummarySections, getSummarySections, normalizePlaygroundRun } from "./importer";
import { buildReview, createDefaultCriteria, getAllBlockScores, getHumanDecision, getHumanScore, normalizeCriteria, reviewBlocks, reviewerRoles } from "./scoring";
import { sampleRun } from "./sample-data";
import { getReview, getRun, saveReview, saveRun } from "./storage";
import type { CriterionValue, ReviewerRole, SummaryRun } from "./types";

type ReviewWorkspaceProps = {
  runId?: string;
  embedded?: boolean;
};

const optionClasses: Record<CriterionValue, string> = {
  0: "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  1: "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  2: "border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
  3: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  4: "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200",
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
  const [importError, setImportError] = React.useState("");

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
          setCriteria(normalizeCriteria(review.criteriaJson));
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
  const summarySections = run ? getSummarySections(run.sourceRunJson, run.summary) : null;
  const fullSummary = summarySections ? formatSummarySections(summarySections) : "";

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError("");
    try {
      const json = JSON.parse(await file.text());
      const imported = normalizePlaygroundRun(json);
      if (!imported.summary.trim() && !imported.transcript.trim()) {
        throw new Error("В файле не найдено summary или транскрипция. Проверьте, что это pipeline_report.json из Playground.");
      }
      saveRun(imported);
      setRun(imported);
      setSaved(false);
      router.push(embedded ? `/?view=summary-review&runId=${imported.id}` : `/review/${imported.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось прочитать JSON-файл.";
      setImportError(message);
    }
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
    router.push(embedded ? "/?view=summary-review" : "/reports");
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
          {importError ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{importError}</p> : null}
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
        <div className="flex flex-wrap items-center gap-2">
          {embedded ? (
            <Button variant="secondary" onClick={() => router.push("/?view=summary-review")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              К списку запусков
            </Button>
          ) : null}
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            Human Score: <span className="font-semibold">{humanScore.toFixed(1)}</span> · {humanDecision}
          </div>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <details>
          <summary className="cursor-pointer px-4 py-3 font-semibold">
            Транскрибация <span className="font-normal text-text-muted">· {transcriptLines.length} реплик · нажмите, чтобы развернуть</span>
          </summary>
          <div className="border-t border-border">
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
            <div className="max-h-96 space-y-2 overflow-auto p-3 text-sm leading-6">
              {transcriptLines.map((line, index) => (
                <p key={`${line}-${index}`} className="rounded-md bg-muted/50 px-3 py-2">{line}</p>
              ))}
            </div>
          </div>
        </details>
      </Panel>

      <div className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="flex min-h-0 flex-col gap-3 overflow-auto p-4">
          <div>
            <h2 className="text-lg font-semibold">Итоговое саммари</h2>
            <div className="mt-3 space-y-3">
              {summarySections ? [
                ["Итог разговора", summarySections.conversationResult || "Не указано"],
                ["Ключевые факты", summarySections.keyFacts.length ? summarySections.keyFacts.map((item) => `• ${item}`).join("\n") : "Не указаны"],
                ["Цитаты", summarySections.quotes.length ? summarySections.quotes.map((item) => `• «${item.replace(/^«|»$/g, "")}»`).join("\n") : "Не указаны"],
                ["Договорённости и следующий шаг", summarySections.nextSteps.length ? summarySections.nextSteps.map((item) => `• ${item}`).join("\n") : "Не указаны"],
              ].map(([title, content]) => (
                <section key={title} className="rounded-md bg-muted/50 p-3">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{content}</p>
                </section>
              )) : null}
            </div>
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
            <Button onClick={() => void navigator.clipboard.writeText(fullSummary)}><Clipboard className="size-4" />Скопировать саммари</Button>
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{block.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{block.description}</p>
                    </div>
                    <span className="shrink-0 text-sm text-text-muted">{Math.round(block.weight * 100)}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2" role="group" aria-label={`${block.title}: оценка от 0 до 4`}>
                      {([0, 1, 2, 3, 4] as CriterionValue[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-label={`${block.title}: ${option} из 4`}
                          onClick={() => setCriteria((prev) => ({ ...prev, [block.id]: option }))}
                          className={`size-9 rounded-full border text-sm font-semibold ${criteria[block.id] === option ? optionClasses[option] : "border-border bg-background text-text-muted"}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <span className="text-sm font-medium">{criteria[block.id] ?? 4} / 4 · {Number(blockScores[scoreKey]).toFixed(0)}%</span>
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

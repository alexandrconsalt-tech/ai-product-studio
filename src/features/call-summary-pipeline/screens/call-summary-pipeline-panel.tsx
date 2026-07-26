"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Play, Quote, ShieldAlert, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, Section, Select, Status, Textarea } from "@/shared/ui";
import { hasBrowserLlmKeyConfigured, MODEL_OPTIONS } from "@/shared/llm/browser-direct-provider";
import {
  CALL_SUMMARY_ERROR_LABELS,
  CALL_SUMMARY_ERROR_TYPES,
  CRITERION_KEYS,
  CRITERION_LABELS,
  computeQualityDecision,
  defaultCallSummaryStages,
  runCallSummaryPipeline,
  type CallSummaryErrorType,
  type CallSummaryPipelineResult,
  type CallSummaryStageConfig,
  type CallSummaryStageReport,
  type CriterionKey,
  type QualityIssue,
  type QualityReport,
  type QualityScoresRaw,
} from "../lib/call-summary-pipeline";
import type { AiVsHumanComparison, HumanEvaluation } from "../model/types";

const EXAMPLE_TRANSCRIPT = `[00:12] Агент: Добрый день! Меня зовут Мария, я по вашей заявке на участок.
[00:20] Клиент: Да, здравствуйте. Рассматриваю участок ИЖС, соток от шести, где-то в районе Мистолова.
[00:41] Агент: Отлично, а какой бюджет рассматриваете?
[00:48] Клиент: До пяти с половиной рассматриваю.
[01:10] Агент: Есть вариант в КП «Охтинское Раздолье», 6.5 соток, ежемесячный взнос 9600 рублей.
[01:22] Клиент: Девять шестьсот ежемесячно — дороговато, если честно.
[01:35] Агент: Понял, поищу другие варианты без высокого взноса. Когда планируете покупку?
[01:44] Клиент: Пока не решил точно, смотрю варианты, тороплюсь не буду.
[02:02] Агент: Хорошо, я уточню у собственника и напишу вам сегодня или завтра в WhatsApp, подберу ещё варианты в Мистолове, Капитолове и Лавриках.
[02:15] Клиент: Хорошо, буду ждать, спасибо.`;

const CRM_FIELDS_ALREADY_VISIBLE = ["object_address", "object_price", "object_area", "floor", "agent_name"] as const;

function configStorageKey(productId: string): string {
  return `callSummaryPipeline.config.${productId}`;
}
function loadStoredStages(productId: string): CallSummaryStageConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(configStorageKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function saveStoredStages(productId: string, stages: readonly CallSummaryStageConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(configStorageKey(productId), JSON.stringify(stages));
}

const STATUS_LABELS: Record<CallSummaryStageReport["status"], string> = { idle: "готов", running: "выполняется…", ok: "успешно", bad: "ошибка" };
function statusTone(status: CallSummaryStageReport["status"]): "success" | "error" | "neutral" | "info" {
  if (status === "ok") return "success";
  if (status === "bad") return "error";
  if (status === "running") return "info";
  return "neutral";
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined) return "—";
  return JSON.stringify(payload, null, 2);
}

function StageCard({ stage, report, onModelChange }: Readonly<{ stage: CallSummaryStageConfig; report: CallSummaryStageReport | undefined; onModelChange: (model: string) => void }>) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <Card className="grid gap-0 overflow-hidden p-0">
      <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpanded((value) => !value)}>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</p>
        {report ? <Badge tone={statusTone(report.status)}>{STATUS_LABELS[report.status]}{report.attempt && report.attempt > 1 ? ` · попытка ${report.attempt}` : ""}</Badge> : null}
        {expanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
      </button>
      {expanded ? (
        <div className="grid gap-3 border-t border-border p-3">
          <label className="grid gap-1 sm:max-w-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Модель</span>
            <Select value={stage.model} onChange={(event) => onModelChange(event.target.value)}>
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          {report?.error ? <Alert tone="warning">{report.error}</Alert> : null}
          {report?.output !== undefined ? (
            <div className="grid gap-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Результат</p>
              <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{stringifyPayload(report.output)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function SummaryCard({ summary }: Readonly<{ summary: NonNullable<CallSummaryPipelineResult["summary"]> }>) {
  if (summary.summary_status === "input_data_incomplete") {
    return (
      <Card className="grid gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
          <p className="text-sm font-medium">Данных недостаточно для summary</p>
        </div>
        <p className="text-sm text-text-muted">{summary.missing_fact.description}{summary.missing_fact.turn_id !== undefined ? ` (реплика №${summary.missing_fact.turn_id})` : ""}</p>
      </Card>
    );
  }
  return (
    <Card className="grid gap-3">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Итог разговора</p>
        <p className="text-sm text-foreground">{summary.conversation_result}</p>
      </div>
      {summary.key_facts.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium">Ключевые факты</p>
          <ul className="grid gap-0.5 text-sm text-foreground">
            {summary.key_facts.map((fact, index) => (
              <li key={index} className="flex gap-2"><span className="text-text-muted">•</span>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.important_quotes.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium">Важные цитаты</p>
          {summary.important_quotes.map((quote, index) => (
            <p key={index} className="flex items-start gap-1.5 text-sm text-text-muted"><Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />«{quote}»</p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-1">
        <p className="text-sm font-medium">Договорённости / следующий шаг</p>
        <p className="text-sm text-foreground">{summary.agreements_next_step}</p>
      </div>
    </Card>
  );
}

const DECISION_TONE: Record<QualityReport["decision"], "success" | "warning" | "error"> = {
  PASS: "success",
  PASS_WITH_MINOR_ISSUES: "success",
  REGENERATE_SUMMARY: "warning",
  REVIEW_REQUIRED: "error",
};

function QualityReportCard({ title, report }: Readonly<{ title: string; report: QualityReport }>) {
  return (
    <Card className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone={DECISION_TONE[report.decision]}>{report.decision} · {report.overall_score}%</Badge>
      </div>
      <div className="grid gap-1">
        {CRITERION_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[1fr_auto] gap-2 text-xs">
            <span className="text-text-muted">{CRITERION_LABELS[key]}</span>
            <span className="font-medium">{report.scores[key].raw_score}/4 · {Math.round(report.scores[key].score)}%</span>
          </div>
        ))}
      </div>
      {report.blocking_errors.length > 0 ? (
        <div className="grid gap-1">
          {report.blocking_errors.map((issue, index) => (
            <div key={index} className="flex items-center gap-2 text-xs text-error">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {CALL_SUMMARY_ERROR_LABELS[issue.type]}{issue.comment ? `: ${issue.comment}` : ""}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

const RAW_SCORE_OPTIONS = [0, 1, 2, 3, 4] as const;

function HumanEvaluationForm({
  onSave,
}: Readonly<{ onSave: (evaluation: HumanEvaluation) => void }>) {
  const [scores, setScores] = React.useState<Record<CriterionKey, { raw_score: 0 | 1 | 2 | 3 | 4; comment: string }>>(() =>
    Object.fromEntries(CRITERION_KEYS.map((key) => [key, { raw_score: 4 as const, comment: "" }])) as Record<CriterionKey, { raw_score: 0 | 1 | 2 | 3 | 4; comment: string }>,
  );
  const [selectedIssues, setSelectedIssues] = React.useState<Record<CallSummaryErrorType, boolean>>(() => Object.fromEntries(CALL_SUMMARY_ERROR_TYPES.map((type) => [type, false])) as Record<CallSummaryErrorType, boolean>);
  const [criticalIssue, setCriticalIssue] = React.useState(false);

  const handleSave = () => {
    const issues: QualityIssue[] = CALL_SUMMARY_ERROR_TYPES.filter((type) => selectedIssues[type]).map((type) => ({ type, critical: criticalIssue }));
    onSave({
      scores: Object.fromEntries(CRITERION_KEYS.map((key) => [key, { raw_score: scores[key].raw_score, comment: scores[key].comment || undefined }])) as HumanEvaluation["scores"],
      issues,
      savedAt: new Date().toISOString(),
    });
  };

  return (
    <Card className="grid gap-3">
      <p className="text-sm font-medium">Ручная оценка</p>
      <p className="text-xs text-text-muted">Оцените текст summary по каждому критерию: 4 — полностью соответствует, 3 — несущественное замечание, 2 — существенный недостаток, 1 — серьёзная ошибка, 0 — критерий не выполнен. AI-оценка станет видна только после сохранения.</p>
      {CRITERION_KEYS.map((key) => (
        <div key={key} className="grid gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{CRITERION_LABELS[key]}</span>
            <div className="flex gap-1">
              {RAW_SCORE_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScores((current) => ({ ...current, [key]: { ...current[key], raw_score: value } }))}
                  className={`flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${scores[key].raw_score === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-text-muted hover:bg-hover"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            className="min-h-16 text-xs"
            placeholder="Комментарий (необязательно)"
            value={scores[key].comment}
            onChange={(event) => setScores((current) => ({ ...current, [key]: { ...current[key], comment: event.target.value } }))}
          />
        </div>
      ))}
      <div className="grid gap-1 border-t border-border pt-2">
        <p className="text-sm">Типы ошибок</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {CALL_SUMMARY_ERROR_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-xs">
              <Checkbox checked={selectedIssues[type]} onChange={(event) => setSelectedIssues((current) => ({ ...current, [type]: event.target.checked }))} />
              {CALL_SUMMARY_ERROR_LABELS[type]}
            </label>
          ))}
        </div>
      </div>
      <Button variant={criticalIssue ? "danger" : "secondary"} onClick={() => setCriticalIssue((value) => !value)} className="w-fit">
        <ShieldAlert className="size-4" aria-hidden="true" />
        {criticalIssue ? "Отмечено как критическая ошибка" : "Критическая ошибка"}
      </Button>
      <Button variant="primary" onClick={handleSave} className="w-fit">Сохранить оценку</Button>
    </Card>
  );
}

function computeComparison(ai: QualityReport, human: QualityReport): AiVsHumanComparison {
  const perCriterionDiff = Object.fromEntries(CRITERION_KEYS.map((key) => [key, Math.abs(ai.scores[key].score - human.scores[key].score)])) as Record<CriterionKey, number>;
  return { overallDiff: Math.abs(ai.overall_score - human.overall_score), perCriterionDiff, decisionMatches: ai.decision === human.decision };
}

export type CallSummaryPipelinePanelProps = Readonly<{ productId: string; onRunComplete: (result: CallSummaryPipelineResult, transcript: string) => void }>;

/**
 * Panel for the "Анализ звонков v2" product -- see
 * `docs/NEW_SUMMARY_PIPELINE_SPEC.md` for the full spec this implements.
 * Mirrors `AdCopyTestBenchPanel`'s structure (editable stage cards, real
 * LLM calls, own localStorage-persisted config) but is otherwise
 * independent code -- no shared state or types with the original
 * call-transcription pipeline or with `src/features/summary-review`.
 */
export function CallSummaryPipelinePanel({ productId, onRunComplete }: CallSummaryPipelinePanelProps) {
  const [stages, setStages] = React.useState<CallSummaryStageConfig[]>(() => loadStoredStages(productId) ?? defaultCallSummaryStages());
  const [transcript, setTranscript] = React.useState(EXAMPLE_TRANSCRIPT);
  const [reports, setReports] = React.useState<Readonly<Record<string, CallSummaryStageReport>>>({});
  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<CallSummaryPipelineResult | null>(null);
  const [humanEvaluation, setHumanEvaluation] = React.useState<HumanEvaluation | null>(null);
  const keyConfigured = hasBrowserLlmKeyConfigured();

  React.useEffect(() => {
    setStages(loadStoredStages(productId) ?? defaultCallSummaryStages());
    setReports({});
    setLastResult(null);
    setHumanEvaluation(null);
    setRunError(null);
  }, [productId]);

  const updateStageModel = (id: string, model: string) => {
    setStages((current) => {
      const next = current.map((stage) => (stage.id === id ? { ...stage, model } : stage));
      saveStoredStages(productId, next);
      return next;
    });
  };

  const handleRun = async () => {
    setRunning(true);
    setRunError(null);
    setLastResult(null);
    setHumanEvaluation(null);
    setReports({});
    try {
      const result = await runCallSummaryPipeline(stages, transcript, CRM_FIELDS_ALREADY_VISIBLE, setReports);
      setLastResult(result);
      onRunComplete(result, transcript);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Не удалось выполнить прогон пайплайна.");
    } finally {
      setRunning(false);
    }
  };

  const humanReport = humanEvaluation ? computeQualityDecision(humanEvaluation.scores as unknown as QualityScoresRaw, humanEvaluation.issues) : null;
  const comparison = lastResult?.aiQualityReport && humanReport ? computeComparison(lastResult.aiQualityReport, humanReport) : null;

  return (
    <div className="grid gap-4">
      {!keyConfigured ? (
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 shrink-0" aria-hidden="true" />
            Чтобы этапы вызывали реальную модель, задайте API-ключ Anthropic или OpenAI в разделе «Настройки».
          </span>
        </Alert>
      ) : null}

      <Card className="grid gap-2">
        <p className="text-sm font-medium">Транскрибация звонка</p>
        <Textarea className="min-h-48 font-mono text-xs" value={transcript} onChange={(event) => setTranscript(event.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setTranscript(EXAMPLE_TRANSCRIPT)}>Вставить пример</Button>
          <span className="text-xs text-text-muted">{transcript.length} символов</span>
        </div>
      </Card>

      <Card className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={handleRun} disabled={running || !transcript.trim()}>
            <Play className="size-4" aria-hidden="true" />
            {running ? "Выполняется…" : "Запустить pipeline"}
          </Button>
          {lastResult ? (
            <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
              <Badge tone="neutral">≈{lastResult.totalTokensEstimate} токенов</Badge>
              <Badge tone="neutral">≈${lastResult.totalCostUsd.toFixed(4)}</Badge>
              <Badge tone="neutral">{lastResult.totalDurationMs} мс</Badge>
              {lastResult.retryCount > 0 ? <Badge tone="warning">Повторов summary: {lastResult.retryCount}</Badge> : null}
            </div>
          ) : (
            <Badge tone="neutral" className="ml-auto">готов</Badge>
          )}
        </div>
        {runError ? <Alert tone="warning">{runError}</Alert> : null}
        {lastResult?.technicalError ? (
          <Alert tone="warning">
            <span className="flex items-center gap-2"><XCircle className="size-4 shrink-0" aria-hidden="true" />{lastResult.technicalError} (TECHNICAL_ERROR)</span>
          </Alert>
        ) : null}
      </Card>

      <Section>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-text-muted" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Этапы</h3>
        </div>
        <div className="grid gap-2">
          {stages.map((stage) => (
            <StageCard key={stage.id} stage={stage} report={reports[stage.id]} onModelChange={(model) => updateStageModel(stage.id, model)} />
          ))}
        </div>
      </Section>

      {lastResult?.summary ? <SummaryCard summary={lastResult.summary} /> : null}

      {lastResult?.aiQualityReport ? (
        <Section>
          <div className="flex items-center gap-2">
            <Status tone="info">Quality Gate</Status>
            <h3 className="text-lg font-semibold">Оценка качества</h3>
          </div>
          {!humanEvaluation ? (
            <Alert tone="info">AI-оценка скрыта до сохранения вашей ручной оценки — так ручная оценка остаётся независимой.</Alert>
          ) : null}
          <HumanEvaluationForm onSave={setHumanEvaluation} />
          {humanReport ? <QualityReportCard title="Ручная оценка" report={humanReport} /> : null}
          {humanReport ? <QualityReportCard title="AI-оценка" report={lastResult.aiQualityReport} /> : null}
          {comparison ? (
            <Card className="grid gap-2">
              <p className="text-sm font-medium">AI vs Человек</p>
              <div className="grid gap-1 text-xs">
                <div className="flex items-center justify-between"><span className="text-text-muted">Расхождение по итогу</span><span className="font-medium">{comparison.overallDiff} п.п.</span></div>
                {CRITERION_KEYS.map((key) => (
                  <div key={key} className="flex items-center justify-between"><span className="text-text-muted">{CRITERION_LABELS[key]}</span><span className="font-medium">{Math.round(comparison.perCriterionDiff[key])} п.п.</span></div>
                ))}
                <div className="flex items-center justify-between"><span className="text-text-muted">Решение совпадает</span><span className="font-medium">{comparison.decisionMatches ? "да" : "нет"}</span></div>
              </div>
            </Card>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

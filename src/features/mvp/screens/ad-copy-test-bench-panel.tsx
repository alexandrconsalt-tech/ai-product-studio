"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Play, Plus, Save, Trash2, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Section, Select, Switch, Textarea } from "@/shared/ui";
import { AD_COPY_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { hasBrowserLlmKeyConfigured, MODEL_OPTIONS } from "@/shared/llm/browser-direct-provider";
import { storedFilesForContext, type StoredInputFile } from "@/shared/lib/input-file-storage";
import { InputFileStoragePanel } from "./input-file-storage-panel";
import {
  AD_COPY_CODE_FN_LIST,
  AD_COPY_TYPE_COLORS,
  AD_COPY_TYPE_LABELS,
  availableContextKeys,
  createBlankStage,
  defaultAdCopyStages,
  runAdCopyPipeline,
  type AdCopyPipelineResult,
  type AdCopyStageConfig,
  type AdCopyStageReport,
  type AdCopyStageStatus,
  type AdCopyStageType,
} from "../lib/ad-copy-test-bench";

const STATUS_LABELS: Record<AdCopyStageStatus, string> = {
  idle: "готов",
  running: "выполняется…",
  ok: "успешно",
  warn: "внимание",
  bad: "ошибка",
};

function statusTone(status: AdCopyStageStatus): "success" | "error" | "neutral" | "warning" | "info" {
  if (status === "ok") return "success";
  if (status === "bad") return "error";
  if (status === "warn") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

function configStorageKey(productId: string): string {
  return `adCopyTestBench.config.${productId}`;
}

/**
 * Bumped on 2026-07-06 when the data contract changed to the single
 * `{property, user_settings}` shape -- a stage list saved under the old
 * contract (flat `crm` fields, old prompts referencing `{{crm.deal_type}}`
 * etc.) would otherwise silently keep running instead of the fixed
 * defaults, since a saved config always takes priority over
 * `defaultAdCopyStages()`. Any config saved under a different version
 * is discarded so the current, correct defaults load instead.
 */
const CONFIG_VERSION = 2;

function loadStoredStages(productId: string): AdCopyStageConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(configStorageKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.version === CONFIG_VERSION && Array.isArray(parsed.stages) && parsed.stages.length > 0) {
      return parsed.stages;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredStages(productId: string, stages: readonly AdCopyStageConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(configStorageKey(productId), JSON.stringify({ version: CONFIG_VERSION, stages }));
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined) return "—";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

const TYPE_OPTIONS: readonly AdCopyStageType[] = ["svc", "code", "llm", "check", "store"];

/** Matches public/pipeline-lab-v3.html's `label.fld` (11px, uppercase, letter-spacing, muted) so field labels read the same on both surfaces. */
const FLD_LABEL_CLASS = "block text-[11px] font-bold uppercase tracking-wider text-text-muted";

const STAT_CHIP_TONE_CLASS: Record<"success" | "warning" | "error" | "neutral", string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  neutral: "text-foreground",
};

/** Compact label+value chip for the top run bar (Confidence/Время/Токены/Стоимость) -- replaces four separate full-width Badges with a tighter, aligned row. */
function StatChip({ label, value, tone = "neutral" }: Readonly<{ label: string; value: string; tone?: "success" | "warning" | "error" | "neutral" }>) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <span className={`text-xs font-semibold ${STAT_CHIP_TONE_CLASS[tone]}`}>{value}</span>
    </div>
  );
}

function StageReportBody({ report }: Readonly<{ report: AdCopyStageReport | undefined }>) {
  if (!report || (report.status === "idle" && !report.output)) return null;
  return (
    <div className="grid gap-2 border-t border-border pt-3">
      {report.metrics && report.metrics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {report.metrics.map((metric) => (
            <Badge key={metric.label} tone="neutral">
              {metric.label}: {metric.value}
            </Badge>
          ))}
          {report.durationMs !== undefined ? <Badge tone="neutral">{report.durationMs} мс</Badge> : null}
        </div>
      ) : null}
      {report.checks && report.checks.length > 0 ? (
        <div className="grid gap-1">
          {report.checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 text-xs">
              {check.pass ? <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" /> : <XCircle className={`size-3.5 shrink-0 ${check.warn ? "text-warning" : "text-error"}`} aria-hidden="true" />}
              {check.label}
            </div>
          ))}
        </div>
      ) : null}
      {report.error ? <Alert tone="warning">{report.error}</Alert> : null}
      {report.output !== undefined ? <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{stringifyPayload(report.output)}</pre> : null}
    </div>
  );
}

function StageEditor({
  stage,
  index,
  total,
  report,
  onChange,
  onMove,
  onSave,
  onDelete,
}: Readonly<{
  stage: AdCopyStageConfig;
  index: number;
  total: number;
  report: AdCopyStageReport | undefined;
  onChange: (next: AdCopyStageConfig) => void;
  onMove: (direction: -1 | 1) => void;
  onSave: () => void;
  onDelete: () => void;
}>) {
  const [expanded, setExpanded] = React.useState(false);
  const isModelType = stage.type === "llm" || stage.type === "check";
  const typeColor = AD_COPY_TYPE_COLORS[stage.type];

  return (
    <Card className="grid gap-0 overflow-hidden p-0" style={{ opacity: stage.enabled ? 1 : 0.5 }}>
      <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpanded((value) => !value)}>
        <span className="h-full w-1 shrink-0 self-stretch rounded-full" style={{ background: typeColor.color }} aria-hidden="true" />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-extrabold" style={{ color: typeColor.color }}>
          {index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</p>
        <span
          className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
          style={{ color: typeColor.color, background: typeColor.bg, borderColor: typeColor.border }}
        >
          {AD_COPY_TYPE_LABELS[stage.type]}
        </span>
        {report ? <Badge tone={statusTone(report.status)}>{STATUS_LABELS[report.status]}{report.attempt && report.attempt > 1 ? ` · попытка ${report.attempt}` : ""}</Badge> : null}
        <Switch
          checked={stage.enabled}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onChange({ ...stage, enabled: event.target.checked })}
        />
        {expanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
      </button>

      {expanded ? (
        <div className="grid gap-3 border-t border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className={FLD_LABEL_CLASS}>Название</span>
              <Input value={stage.name} onChange={(event) => onChange({ ...stage, name: event.target.value })} />
            </label>

            <label className="grid gap-1">
              <span className={FLD_LABEL_CLASS}>Тип</span>
              <Select value={stage.type} onChange={(event) => onChange({ ...stage, type: event.target.value as AdCopyStageType })}>
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {AD_COPY_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          {isModelType ? (
            <>
              <label className="grid gap-1">
                <span className={FLD_LABEL_CLASS}>Модель</span>
                <Select value={stage.model ?? MODEL_OPTIONS[0].value} onChange={(event) => onChange({ ...stage, model: event.target.value })}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1">
                <span className={FLD_LABEL_CLASS}>Промт</span>
                <Textarea className="min-h-40 font-mono text-xs" value={stage.prompt ?? ""} onChange={(event) => onChange({ ...stage, prompt: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className="grid gap-1">
                <span className={FLD_LABEL_CLASS}>Код-функция</span>
                <Select value={stage.codeFn ?? ""} onChange={(event) => onChange({ ...stage, codeFn: event.target.value || undefined })}>
                  <option value="">—</option>
                  {AD_COPY_CODE_FN_LIST.map((fn) => (
                    <option key={fn} value={fn}>
                      {fn}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1">
                <span className={FLD_LABEL_CLASS}>Исполнитель (сервис)</span>
                <Input value={stage.vendor ?? ""} onChange={(event) => onChange({ ...stage, vendor: event.target.value })} />
              </label>
              <p className="text-xs text-text-muted">Детерминированный шаг: выполняется кодом, без модели. Использует результаты предыдущих шагов из контекста.</p>
            </>
          )}

          <label className="grid gap-1">
            <span className={FLD_LABEL_CLASS}>{"Ключ результата (для {{ctx.КЛЮЧ}})"}</span>
            <Input value={stage.outKey} onChange={(event) => onChange({ ...stage, outKey: event.target.value })} />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="secondary" onClick={onSave}>
              <Save className="size-4" aria-hidden="true" />
              Сохранить
            </Button>
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Удалить
            </Button>
          </div>

          <StageReportBody report={report} />
        </div>
      ) : (
        <StageReportBody report={report} />
      )}
    </Card>
  );
}

export type AdCopyTestBenchPanelProps = Readonly<{ productId: string; onRunComplete: (result: AdCopyPipelineResult, rawInput: string) => void }>;

/**
 * Editable test bench matching Pipeline Lab v3's own format exactly
 * (per explicit request): collapsible stage cards with editable
 * Название/Тип/Модель/Промт/Код-функция/Исполнитель/Ключ результата,
 * reorder, save (persists the whole stage list, same granularity
 * Pipeline Lab v3's own "💾 Сохранить" has), delete, add a new step,
 * and a "Переменные в промтах" reference -- driving the real
 * `runAdCopyPipeline` engine (real Zod validation, real quality-circuit
 * math, real confidence-gated retry), not a copy of the call-analysis
 * business logic.
 */
export function AdCopyTestBenchPanel({ productId, onRunComplete }: AdCopyTestBenchPanelProps) {
  const [stages, setStages] = React.useState<AdCopyStageConfig[]>(() => loadStoredStages(productId) ?? defaultAdCopyStages());
  const [rawInput, setRawInput] = React.useState(() => JSON.stringify(AD_COPY_INPUT_EXAMPLE, null, 2));
  const [reports, setReports] = React.useState<Readonly<Record<string, AdCopyStageReport>>>({});
  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<AdCopyPipelineResult | null>(null);
  const [pipelineExpanded, setPipelineExpanded] = React.useState(false);
  const [inputFiles, setInputFiles] = React.useState<readonly StoredInputFile[]>([]);
  const keyConfigured = hasBrowserLlmKeyConfigured();

  React.useEffect(() => {
    setStages(loadStoredStages(productId) ?? defaultAdCopyStages());
    setReports({});
    setLastResult(null);
    setRunError(null);
  }, [productId]);

  const updateStage = (id: string, next: AdCopyStageConfig) => {
    setStages((current) => current.map((stage) => (stage.id === id ? next : stage)));
  };
  const moveStage = (index: number, direction: -1 | 1) => {
    setStages((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const deleteStage = (id: string) => {
    setStages((current) => {
      const next = current.filter((stage) => stage.id !== id);
      saveStoredStages(productId, next);
      return next;
    });
  };
  const persistAll = () => saveStoredStages(productId, stages);
  const addStage = () => setStages((current) => [...current, createBlankStage()]);

  const handleInsertExample = () => setRawInput(JSON.stringify(AD_COPY_INPUT_EXAMPLE, null, 2));
  const handleClear = () => {
    setReports({});
    setLastResult(null);
    setRunError(null);
  };

  const handleRun = async () => {
    setRunning(true);
    setRunError(null);
    setLastResult(null);
    setReports({});
    try {
      const result = await runAdCopyPipeline(stages, rawInput, setReports, storedFilesForContext(inputFiles));
      setLastResult(result);
      onRunComplete(result, rawInput);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Не удалось выполнить тестовый прогон.");
    } finally {
      setRunning(false);
    }
  };

  const contextKeys = availableContextKeys(stages);

  return (
    <div className="grid gap-4">
      {!keyConfigured ? (
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 shrink-0" aria-hidden="true" />
            Чтобы LLM-агенты и Проверщик вызывали реальную модель, задайте API-ключ Anthropic или OpenAI в разделе «Настройки».
          </span>
        </Alert>
      ) : null}

      <Card className="grid gap-2">
        <p className="text-sm font-medium">Вход</p>
        <Textarea className="min-h-40 font-mono text-xs" value={rawInput} onChange={(event) => setRawInput(event.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={handleInsertExample}>
            Вставить пример
          </Button>
          <span className="text-xs text-text-muted">{rawInput.length} символов</span>
        </div>
        <InputFileStoragePanel productId={productId} onFilesChange={setInputFiles} />
      </Card>

      <Card className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={handleRun} disabled={running || !rawInput.trim()}>
            <Play className="size-4" aria-hidden="true" />
            {running ? "Выполняется…" : "Прогнать пайплайн"}
          </Button>
          <Button variant="ghost" onClick={handleClear} disabled={running}>
            Очистить
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {lastResult ? (
              <>
                <StatChip label="Confidence" value={lastResult.finalRecord ? `${lastResult.finalRecord.confidenceScore}%` : "—"} tone={lastResult.finalRecord ? (lastResult.finalRecord.lowConfidence ? "warning" : "success") : "error"} />
                <StatChip label="Время" value={`${lastResult.totalDurationMs} мс`} />
                <StatChip label="Токены" value={`≈${lastResult.totalTokensEstimate}`} />
                <StatChip label="Стоимость" value={`≈$${lastResult.totalCostUsd.toFixed(4)}`} />
              </>
            ) : (
              <Badge tone="neutral">готов</Badge>
            )}
          </div>
        </div>
        {runError ? <Alert tone="warning">{runError}</Alert> : null}
      </Card>

      <Section>
        <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setPipelineExpanded((value) => !value)}>
          {pipelineExpanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
          <h3 className="text-lg font-semibold">Пайплайн</h3>
          <Badge tone="info">{stages.length}</Badge>
        </button>
        {pipelineExpanded ? (
          <>
            <div className="grid gap-2">
              {stages.map((stage, index) => (
                <StageEditor
                  key={stage.id}
                  stage={stage}
                  index={index}
                  total={stages.length}
                  report={reports[stage.id]}
                  onChange={(next) => updateStage(stage.id, next)}
                  onMove={(direction) => moveStage(index, direction)}
                  onSave={persistAll}
                  onDelete={() => deleteStage(stage.id)}
                />
              ))}
            </div>
            <Button variant="ghost" onClick={addStage} className="w-fit">
              <Plus className="size-4" aria-hidden="true" />+ Добавить шаг
            </Button>
          </>
        ) : null}
      </Section>

      <Card className="grid gap-1">
        <p className="text-sm font-medium">Переменные в промтах</p>
        <p className="text-xs text-text-muted">
          {"{{crm.property}}"} / {"{{crm.user_settings}}"} — единый входной объект (сразу после Валидации/Нормализации). {"{{ctx.КЛЮЧ}}"} — результат любого предыдущего этапа по его «Ключу результата»:{" "}
          {contextKeys.map((key) => `{{ctx.${key}}}`).join(", ")}. Например, {"{{ctx.stored.property}}"} и {"{{ctx.stored.advantages}}"} — данные объекта и преимущества из «Единого хранилища». {"{{ctx.stored_files}}"} — файлы из «Хранилище входящих данных» (имя, формат; текст
          доступен только для .txt/.svg).
        </p>
      </Card>

      {lastResult?.finalRecord ? (
        <Card className="grid gap-2">
          <p className="text-sm font-medium">Итоговое объявление</p>
          <p className="text-sm font-semibold">{lastResult.finalRecord.title}</p>
          <p className="text-sm text-text-muted">{lastResult.finalRecord.description}</p>
          <p className="text-sm text-primary">{lastResult.finalRecord.cta}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
            <span>Модель: {lastResult.finalRecord.model}</span>
            <span>· Промпт v{lastResult.finalRecord.promptVersion}</span>
            <span>· Retry: {lastResult.finalRecord.retryCount}</span>
            <span>· {new Date(lastResult.finalRecord.generatedAt).toLocaleString("ru-RU")}</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

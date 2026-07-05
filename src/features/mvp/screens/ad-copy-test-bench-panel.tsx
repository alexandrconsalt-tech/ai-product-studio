"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Play, Plus, Save, Trash2, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Input, Section, Select, Switch, Textarea } from "@/shared/ui";
import { AD_COPY_CRM_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { hasBrowserLlmKeyConfigured, MODEL_OPTIONS } from "@/shared/llm/browser-direct-provider";
import { storedFilesForContext, type StoredInputFile } from "@/shared/lib/input-file-storage";
import { InputFileStoragePanel } from "./input-file-storage-panel";
import {
  AD_COPY_CODE_FN_LIST,
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

function loadStoredStages(productId: string): AdCopyStageConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(configStorageKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredStages(productId: string, stages: readonly AdCopyStageConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(configStorageKey(productId), JSON.stringify(stages));
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined) return "—";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

const TYPE_OPTIONS: readonly AdCopyStageType[] = ["svc", "code", "llm", "check", "store"];

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

  return (
    <Card className="grid gap-0 p-0">
      <button type="button" className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />}
        <span className="text-sm font-semibold text-text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{stage.name}</p>
          <p className="text-xs text-text-muted">{AD_COPY_TYPE_LABELS[stage.type]}</p>
        </div>
        <label className="flex items-center gap-1 text-xs text-text-muted" onClick={(event) => event.stopPropagation()}>
          <Switch checked={stage.enabled} onChange={(event) => onChange({ ...stage, enabled: event.target.checked })} />
          Вкл
        </label>
        {report ? <Badge tone={statusTone(report.status)}>{STATUS_LABELS[report.status]}{report.attempt && report.attempt > 1 ? ` · попытка ${report.attempt}` : ""}</Badge> : <Badge tone="neutral">{STATUS_LABELS.idle}</Badge>}
      </button>

      {expanded ? (
        <div className="grid gap-3 border-t border-border p-3">
          <label className="grid gap-1 text-sm">
            Название
            <Input value={stage.name} onChange={(event) => onChange({ ...stage, name: event.target.value })} />
          </label>

          <label className="grid gap-1 text-sm">
            Тип
            <Select value={stage.type} onChange={(event) => onChange({ ...stage, type: event.target.value as AdCopyStageType })}>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {AD_COPY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </label>

          {isModelType ? (
            <>
              <label className="grid gap-1 text-sm">
                Модель
                <Select value={stage.model ?? MODEL_OPTIONS[0].value} onChange={(event) => onChange({ ...stage, model: event.target.value })}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-sm">
                Промт
                <Textarea className="min-h-40 font-mono text-xs" value={stage.prompt ?? ""} onChange={(event) => onChange({ ...stage, prompt: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                Код-функция
                <Select value={stage.codeFn ?? ""} onChange={(event) => onChange({ ...stage, codeFn: event.target.value || undefined })}>
                  <option value="">—</option>
                  {AD_COPY_CODE_FN_LIST.map((fn) => (
                    <option key={fn} value={fn}>
                      {fn}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-sm">
                Исполнитель (сервис)
                <Input value={stage.vendor ?? ""} onChange={(event) => onChange({ ...stage, vendor: event.target.value })} />
              </label>
              <p className="text-xs text-text-muted">Детерминированный шаг: выполняется кодом, без модели. Использует результаты предыдущих шагов из контекста.</p>
            </>
          )}

          <label className="grid gap-1 text-sm">
            {"Ключ результата (для {{ctx.КЛЮЧ}})"}
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
  const [rawInput, setRawInput] = React.useState(() => JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE, null, 2));
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

  const handleInsertExample = () => setRawInput(JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE, null, 2));
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
          {"{{crm.поле}}"} — данные объекта (deal_type, object_type, city, district, street, rooms, area, floor, total_floors, price, description, features, renovation, balcony, bathroom, view, infrastructure, parking, mortgage). {"{{ctx.КЛЮЧ}}"} — результат
          любого предыдущего этапа по его «Ключу результата»: {contextKeys.map((key) => `{{ctx.${key}}}`).join(", ")}. {"{{ctx.stored_files}}"} — файлы из «Хранилище входящих данных» (имя, формат; текст доступен только для .txt/.svg).
        </p>
      </Card>

      <Card className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={handleRun} disabled={running || !rawInput.trim()}>
            <Play className="size-4" aria-hidden="true" />
            {running ? "Выполняется…" : "▶ Прогнать пайплайн"}
          </Button>
          <Button variant="ghost" onClick={handleClear} disabled={running}>
            Очистить
          </Button>
          {lastResult ? (
            <>
              <Badge tone={lastResult.finalRecord ? (lastResult.finalRecord.lowConfidence ? "warning" : "success") : "error"}>
                {lastResult.finalRecord ? `Confidence ${lastResult.finalRecord.confidenceScore}%` : "Ошибка"}
              </Badge>
              <Badge tone="neutral">{lastResult.totalDurationMs} мс</Badge>
              <Badge tone="neutral">≈{lastResult.totalTokensEstimate} токенов</Badge>
              <Badge tone="neutral">≈${lastResult.totalCostUsd.toFixed(4)}</Badge>
            </>
          ) : (
            <Badge tone="neutral">готов</Badge>
          )}
        </div>
        {runError ? <Alert tone="warning">{runError}</Alert> : null}
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

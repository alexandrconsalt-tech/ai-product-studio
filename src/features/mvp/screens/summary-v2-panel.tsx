"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock3, Download, Play, ShieldCheck, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Section, Select, Status, Textarea } from "@/shared/ui";
import { downloadJson } from "@/shared/lib/download-json";
import { MODEL_OPTIONS } from "@/shared/llm/browser-direct-provider";
import type { SummaryV2Config, SummaryV2Run, TechnicalEnvelope } from "../summary-v2/contracts";
import { executeSummaryPipelineV2 } from "../summary-v2/runtime";

const CONFIG_STORAGE_KEY = "ai-product-studio.summary-pipeline-v2.config.v1";

const DEFAULT_CONFIG: SummaryV2Config = {
  extractorModel: "gpt-5-mini",
  verifierModel: "claude-sonnet-4.5",
  generatorModel: "gpt-5-mini",
  judgeModel: "claude-sonnet-4.5",
};

const SAMPLES = {
  confirmed: `Агент: Добрый день! Подскажите, какой объект рассматриваете?
Клиент: Ищу новостройку, двухкомнатную квартиру в северной части города. Бюджет до восьми миллионов.
Агент: Покупка будет с ипотекой?
Клиент: Ипотека уже одобрена. Хотел бы купить в течение двух-трёх месяцев.
Агент: Я пришлю сегодня три подходящих варианта в WhatsApp, а завтра созвонимся.
Клиент: Хорошо, присылайте в WhatsApp, завтра созвонимся.`,
  none: `Агент: Добрый день, вы оставляли запрос по квартире.
Клиент: Да, пока только сравниваю предложения и конкретных требований ещё нет.
Агент: Нужна консультация по ипотеке?
Клиент: Нет, спасибо. Если решу продолжить, сам свяжусь.
Агент: Хорошо, буду на связи.`,
  conditional: `Клиент: Интересует дом, но сначала хочу получить планировку и точную стоимость.
Агент: Могу отправить материалы в Telegram. Если они подойдут, тогда можно будет договориться о просмотре.
Клиент: Да, отправьте материалы. По просмотру решу после изучения.`,
} as const;

type StageType = "Код" | "Модель" | "Проверка";

const STAGE_LABELS: Readonly<Record<string, { name: string; type: StageType }>> = {
  transcript_guard: { name: "Проверка транскрипции", type: "Код" },
  call_intelligence_extractor: { name: "Извлечение данных звонка", type: "Модель" },
  deterministic_normalizer: { name: "Детерминированная нормализация", type: "Код" },
  evidence_verifier: { name: "Проверка доказательств", type: "Модель" },
  conversation_store_v2: { name: "Хранилище разговора v2", type: "Код" },
  summary_generator: { name: "Генерация саммари", type: "Модель" },
  faithfulness_judge: { name: "Достоверность", type: "Проверка" },
  completeness_judge: { name: "Полнота", type: "Проверка" },
  usefulness_judge: { name: "Полезность", type: "Проверка" },
  agreements_next_step_judge: { name: "Договорённости и следующий шаг", type: "Проверка" },
  format_judge: { name: "Формат, структура и краткость", type: "Проверка" },
  quality_gate_v2: { name: "Контроль качества v2", type: "Код" },
  crm_publish_v2: { name: "Публикация в CRM v2", type: "Код" },
};

const STATUS_LABELS = { SUCCESS: "УСПЕШНО", TECHNICAL_ERROR: "ТЕХНИЧЕСКАЯ ОШИБКА", SKIPPED: "ПРОПУЩЕНО" } as const;
const DECISION_LABELS = {
  PASS: "ПРОЙДЕНО",
  FAIL: "НЕ ПРОЙДЕНО",
  REVIEW_REQUIRED: "НУЖНА ПРОВЕРКА",
  TECHNICAL_ERROR: "ТЕХНИЧЕСКАЯ ОШИБКА",
  NOT_APPLICABLE: "НЕ ПРИМЕНЯЕТСЯ",
  AUTO_SAVE: "АВТОСОХРАНЕНИЕ",
  SAVE_WITH_WARNING: "СОХРАНЕНИЕ С ПРЕДУПРЕЖДЕНИЕМ",
} as const;
const CRM_STATUS_LABELS = { PUBLISHED: "ОПУБЛИКОВАНО", PUBLISHED_WITH_WARNING: "ОПУБЛИКОВАНО С ПРЕДУПРЕЖДЕНИЕМ", BLOCKED: "ЗАБЛОКИРОВАНО" } as const;

function loadConfig(): SummaryV2Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONFIG_STORAGE_KEY) ?? "{}") as Partial<SummaryV2Config>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: SummaryV2Config) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function statusTone(status: TechnicalEnvelope<unknown>["status"]): "success" | "warning" | "error" {
  if (status === "SUCCESS") return "success";
  if (status === "SKIPPED") return "warning";
  return "error";
}

function StageCard({ stage }: Readonly<{ stage: TechnicalEnvelope<unknown> }>) {
  const [expanded, setExpanded] = React.useState(false);
  const label = STAGE_LABELS[stage.stage_id] ?? { name: stage.stage_id, type: "Код" as const };
  return (
    <Card className="grid gap-2 p-3">
      <button type="button" className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-2 text-left" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown className="mt-0.5 size-4 text-text-muted" aria-hidden="true" /> : <ChevronRight className="mt-0.5 size-4 text-text-muted" aria-hidden="true" />}
        <span>
          <span className="block text-sm font-medium">{label.name}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <Badge tone="neutral">{label.type}</Badge>
            <Badge tone={statusTone(stage.status)}>{STATUS_LABELS[stage.status]}</Badge>
            <Badge tone={stage.decision === "PASS" ? "success" : stage.decision === "TECHNICAL_ERROR" ? "error" : "warning"}>{DECISION_LABELS[stage.decision]}</Badge>
          </span>
        </span>
        <span className="text-right text-xs text-text-muted">
          <span className="block">{stage.score === null ? "Оценка: не рассчитана" : `Оценка: ${stage.score}%`}</span>
          <span className="block">{stage.confidence === null ? "Уверенность: —" : `Уверенность: ${stage.confidence.toFixed(2)}`}</span>
        </span>
      </button>
      {expanded ? (
        <div className="grid gap-3 border-t border-border pt-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="text-text-muted">Время</span><p>{stage.duration_ms} мс</p></div>
            <div><span className="text-text-muted">Модель</span><p>{stage.model ?? "—"}</p></div>
            <div><span className="text-text-muted">Промпт</span><p>{stage.prompt_version ?? "—"}</p></div>
            <div><span className="text-text-muted">Идентификатор выполнения</span><p className="break-all">{stage.execution_id}</p></div>
            <div><span className="text-text-muted">Входной контракт</span><p>{stage.input_contract_version}</p></div>
            <div><span className="text-text-muted">Выходной контракт</span><p>{stage.output_contract_version}</p></div>
          </div>
          {stage.technical_error ? (
            <Alert tone="error">
              <div className="grid gap-1">
                <p>Причина: {stage.technical_error.error_code} — {stage.technical_error.error_message}</p>
                <p>Провайдер: {stage.technical_error.provider ?? "—"}; модель: {stage.technical_error.model ?? "—"}; повторов: {stage.technical_error.retry_count}</p>
                {stage.technical_error.validation_errors.map((item) => (
                  <p key={`${item.field}-${item.message}`}>
                    Поле: {item.field}; получено: {item.got ?? "отсутствует"}; допустимо: {item.allowed.join(", ") || "по контракту"}.
                  </p>
                ))}
              </div>
            </Alert>
          ) : null}
          {stage.issues.length ? <div><p className="font-medium">Замечания</p><ul className="list-disc pl-5">{stage.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul></div> : null}
          <div>
            <p className="font-medium">Структурированный результат</p>
            <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-muted p-3">{JSON.stringify(stage.output, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function ConfigSelect({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </label>
  );
}

export function summaryV2DashboardReport(run: SummaryV2Run) {
  const judgeById = Object.fromEntries(run.stages.filter((stage) => stage.stage_id.endsWith("_judge")).map((stage) => [stage.stage_id, stage.output]));
  return {
    pipeline: { product_id: run.product_id, version: run.pipeline_version, config_hash: run.config_hash, transcript_hash: run.transcript_hash },
    result: {
      summary: run.summary ? { summary: run.summary } : null,
      attributes: run.attributes,
      summary_quality_gate: {
        score: run.quality.score,
        decision: run.quality.decision,
        critical_errors: run.quality.critical_errors,
        warnings: run.quality.warnings,
      },
      truth_check: judgeById.faithfulness_judge,
      critical_facts_check: judgeById.completeness_judge,
      context_utility_check: judgeById.usefulness_judge,
      action_check: judgeById.agreements_next_step_judge,
      presentation_check: judgeById.format_judge,
      crm: run.crm_publish,
    },
    stageReports: run.stages.map((stage) => ({
      stage: { name: STAGE_LABELS[stage.stage_id]?.name ?? stage.stage_id, outKey: stage.stage_id, type: STAGE_LABELS[stage.stage_id]?.type ?? "Код" },
      report: {
        status: stage.status === "SUCCESS" ? "ok" : stage.status === "SKIPPED" ? "warn" : "bad",
        error: stage.technical_error,
        output: stage.output,
        meta: { status: stage.status, decision: stage.decision, score: stage.score, confidence: stage.confidence, durationMs: stage.duration_ms, model: stage.model, promptVersion: stage.prompt_version },
      },
    })),
    run,
  };
}

export function SummaryV2Panel({ onRunComplete }: Readonly<{ onRunComplete: (run: SummaryV2Run, transcript: string) => void }>) {
  const [config, setConfig] = React.useState<SummaryV2Config>(DEFAULT_CONFIG);
  const [transcript, setTranscript] = React.useState<string>(SAMPLES.confirmed);
  const [run, setRun] = React.useState<SummaryV2Run | null>(null);
  const [executing, setExecuting] = React.useState(false);
  const [unexpectedError, setUnexpectedError] = React.useState<string | null>(null);

  React.useEffect(() => setConfig(loadConfig()), []);

  const updateConfig = (patch: Partial<SummaryV2Config>) => {
    setConfig((current) => {
      const next = { ...current, ...patch };
      saveConfig(next);
      return next;
    });
  };

  const handleRun = async () => {
    setExecuting(true);
    setUnexpectedError(null);
    try {
      const result = await executeSummaryPipelineV2(transcript, config);
      setRun(result);
      onRunComplete(result, transcript);
    } catch (error) {
      setUnexpectedError(error instanceof Error ? error.message : "Необработанная ошибка запуска.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Alert tone="info">
        Конвейер саммари v2 полностью отделён от версии 1. Для реальных вызовов моделей выберите AI Tunnel, OpenAI или Anthropic и сохраните ключ в «Настройках».
      </Alert>

      <Section className="grid gap-3">
        <div>
          <h3 className="font-semibold">Конфигурация моделей</h3>
          <p className="text-sm text-text-muted">Конфигурация сохраняется отдельно для конвейера саммари v2.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ConfigSelect label="Извлечение данных звонка" value={config.extractorModel} onChange={(value) => updateConfig({ extractorModel: value })} />
          <ConfigSelect label="Проверка доказательств" value={config.verifierModel} onChange={(value) => updateConfig({ verifierModel: value })} />
          <ConfigSelect label="Генерация саммари" value={config.generatorModel} onChange={(value) => updateConfig({ generatorModel: value })} />
          <ConfigSelect label="Пять проверок качества" value={config.judgeModel} onChange={(value) => updateConfig({ judgeModel: value })} />
        </div>
      </Section>

      <Section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Транскрипция</h3>
            <p className="text-sm text-text-muted">Роли обозначайте как «Клиент:», «Агент:» или «Оператор:».</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-auto whitespace-normal py-2" variant="ghost" onClick={() => setTranscript(SAMPLES.confirmed)}>Подтверждённый шаг</Button>
            <Button className="h-auto whitespace-normal py-2" variant="ghost" onClick={() => setTranscript(SAMPLES.none)}>Без договорённости</Button>
            <Button className="h-auto whitespace-normal py-2" variant="ghost" onClick={() => setTranscript(SAMPLES.conditional)}>Условный шаг</Button>
          </div>
        </div>
        <Textarea className="min-h-56 font-mono text-xs" value={transcript} onChange={(event) => setTranscript(event.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-auto min-h-9 w-full whitespace-normal py-2 sm:w-auto" variant="primary" onClick={handleRun} disabled={executing || !transcript.trim()}>
            <Play className="size-4" aria-hidden="true" />
            {executing ? "Выполняется…" : "Запустить конвейер саммари v2"}
          </Button>
          <Badge tone="neutral">Версия 2.0</Badge>
          <Badge tone="neutral">13 этапов</Badge>
          <Badge tone="neutral">5 проверок параллельно</Badge>
        </div>
        {unexpectedError ? <Alert tone="error">{unexpectedError}</Alert> : null}
      </Section>

      {run ? (
        <>
          <Section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">Итог запуска</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => downloadJson(`отчёт-саммари-v2-${run.run_id}.json`, summaryV2DashboardReport(run))}>
                  <Download className="size-4" aria-hidden="true" />
                  Скачать отчёт
                </Button>
                <Status tone={run.quality.decision === "AUTO_SAVE" ? "success" : run.quality.decision === "TECHNICAL_ERROR" ? "error" : "warning"}>{DECISION_LABELS[run.quality.decision]}</Status>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card><p className="text-xs text-text-muted">Итоговая оценка качества</p><p className="text-2xl font-semibold">{run.quality.score === null ? "не рассчитана" : `${run.quality.score.toFixed(1)}%`}</p></Card>
              <Card><p className="text-xs text-text-muted">Публикация в CRM</p><p className="font-semibold">{CRM_STATUS_LABELS[run.crm_publish.status]}</p></Card>
              <Card><p className="text-xs text-text-muted">Технические ошибки</p><p className="text-2xl font-semibold">{run.stages.filter((stage) => stage.status === "TECHNICAL_ERROR").length}</p></Card>
              <Card><p className="text-xs text-text-muted">Идентификатор запуска</p><p className="break-all text-xs">{run.run_id}</p></Card>
            </div>
            {run.summary ? <Card><p className="mb-2 text-sm font-medium">Итоговое саммари</p><div className="whitespace-pre-wrap text-sm">{run.summary}</div></Card> : null}
            {run.attributes ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Card><p className="text-xs text-text-muted">Интересует</p><p>{run.attributes.interested_in.join(", ") || "—"}</p></Card>
                <Card><p className="text-xs text-text-muted">Источник средств</p><p>{run.attributes.funding_source}</p></Card>
                <Card><p className="text-xs text-text-muted">Срок покупки</p><p>{run.attributes.purchase_timeline}</p></Card>
              </div>
            ) : null}
            {run.quality.critical_errors.length ? <Alert tone="error"><AlertTriangle className="size-4" aria-hidden="true" />{run.quality.critical_errors.join("; ")}</Alert> : null}
            {run.quality.warnings.length ? <Alert tone="warning">{run.quality.warnings.join("; ")}</Alert> : null}
          </Section>

          <Section className="grid gap-2">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-text-muted" aria-hidden="true" />
              <h3 className="font-semibold">Отчёт по этапам</h3>
            </div>
            <p className="text-sm text-text-muted">Технический статус, оценка, уверенность и бизнес-решение показаны раздельно.</p>
            {run.stages.map((stage) => <StageCard key={stage.execution_id} stage={stage} />)}
            <div className="flex flex-wrap gap-2 text-xs text-text-muted">
              <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-success" /> УСПЕШНО</span>
              <span className="flex items-center gap-1"><XCircle className="size-3.5 text-error" /> ТЕХНИЧЕСКАЯ ОШИБКА</span>
              <span className="flex items-center gap-1"><AlertTriangle className="size-3.5 text-warning" /> ПРОПУЩЕНО / НУЖНА ПРОВЕРКА</span>
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}

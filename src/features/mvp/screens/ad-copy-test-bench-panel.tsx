"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, Loader2, Play, XCircle } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, NodeCard, Textarea } from "@/shared/ui";
import { AD_COPY_CRM_INPUT_EXAMPLE } from "@/shared/model/ad-copy-crm-input";
import { hasBrowserLlmKeyConfigured } from "@/shared/llm/browser-direct-provider";
import { AD_COPY_STAGE_DEFINITIONS, runAdCopyTestBench, type AdCopyRunResult, type AdCopyStageDefinition, type AdCopyStageId, type AdCopyStageResult } from "../lib/ad-copy-test-bench";

const STATUS_LABELS: Record<AdCopyStageResult["status"], string> = {
  idle: "не запускался",
  running: "выполняется…",
  succeeded: "успешно",
  failed: "ошибка",
  skipped: "пропущен",
};

const GROUP_LABELS: Record<AdCopyStageDefinition["group"], string> = {
  code: "Код",
  llm: "LLM",
  storage: "Хранилище",
  service: "Сервис",
};

function statusTone(status: AdCopyStageResult["status"]): "success" | "error" | "neutral" | "warning" | "info" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  if (status === "skipped") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

function stringifyPayload(payload: unknown): string {
  if (payload === undefined) return "—";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

function initialStages(): readonly AdCopyStageResult[] {
  return AD_COPY_STAGE_DEFINITIONS.map((definition) => ({ id: definition.id, status: "idle" as const }));
}

function StageDetailDialog({ definition, stage, onClose }: Readonly<{ definition: AdCopyStageDefinition; stage: AdCopyStageResult; onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <Dialog className="grid max-h-[85vh] w-full max-w-2xl gap-3 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {definition.number}. {definition.name}
              {stage.attempt && stage.attempt > 1 ? ` · попытка ${stage.attempt}` : ""}
            </h2>
            <p className="text-sm text-text-muted">{definition.description}</p>
          </div>
          <Badge tone={statusTone(stage.status)}>{STATUS_LABELS[stage.status]}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Card><p className="text-xs text-text-muted">Тип</p><p className="font-medium">{GROUP_LABELS[definition.group]}</p></Card>
          {stage.durationMs !== undefined ? <Card><p className="text-xs text-text-muted">Длительность</p><p className="font-medium">{stage.durationMs} мс</p></Card> : null}
          {stage.metrics?.map((metric) => (
            <Card key={metric.label}><p className="text-xs text-text-muted">{metric.label}</p><p className="font-medium">{metric.value}</p></Card>
          ))}
        </div>

        {stage.checklist && stage.checklist.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Проверки (каждая отображается отдельно)</p>
            <div className="grid gap-1">
              {stage.checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  {item.pass ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="size-4 shrink-0 text-error" aria-hidden="true" />}
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {stage.error ? <Alert tone="warning">{stage.error}</Alert> : null}

        {stage.input !== undefined ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Вход</p>
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{stringifyPayload(stage.input)}</pre>
          </div>
        ) : null}

        {stage.output !== undefined ? (
          <div className="grid gap-1">
            <p className="text-sm font-medium">Выход</p>
            <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">{stringifyPayload(stage.output)}</pre>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>Закрыть</Button>
        </div>
      </Dialog>
    </div>
  );
}

function StageCard({ definition, stage, onClick }: Readonly<{ definition: AdCopyStageDefinition; stage: AdCopyStageResult; onClick: () => void }>) {
  return (
    <NodeCard selected={stage.status === "running"} className="w-56 cursor-pointer" onClick={onClick}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge tone="neutral">
          {definition.number}. {GROUP_LABELS[definition.group]}
        </Badge>
        <Badge tone={statusTone(stage.status)}>
          <span className="flex items-center gap-1">
            {stage.status === "running" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
            {STATUS_LABELS[stage.status]}
          </span>
        </Badge>
      </div>
      <p className="text-sm font-medium">{definition.name}</p>
      <p className="mt-1 line-clamp-2 text-xs text-text-muted">{definition.description}</p>
      {stage.attempt && stage.attempt > 1 ? <p className="mt-2 text-xs text-warning">Попытка {stage.attempt}</p> : null}
      {stage.checklist ? (
        <div className="mt-2 grid gap-0.5">
          {stage.checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-1 text-xs text-text-muted">
              {item.pass ? <CheckCircle2 className="size-3 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="size-3 shrink-0 text-error" aria-hidden="true" />}
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </NodeCard>
  );
}

export type AdCopyTestBenchPanelProps = Readonly<{ onRunComplete: (result: AdCopyRunResult, rawInput: string) => void }>;

/**
 * Real, product-specific test bench for "Генерация текстов
 * объявлений" -- mirrors Pipeline Lab v3's live step-by-step run
 * experience (progressively updating stage cards, real model calls),
 * but for this product's own 10-stage design, including the
 * confidence-gated retry loop the domain Pipeline's DAG-based executor
 * cannot represent as an executable cycle. Real LLM calls use the
 * BYOK Anthropic/OpenAI keys configured in Настройки (Settings) --
 * `runAdCopyTestBench` calls `callConfiguredLlm`, never the Mock LLM
 * Provider.
 */
export function AdCopyTestBenchPanel({ onRunComplete }: AdCopyTestBenchPanelProps) {
  const [rawInput, setRawInput] = React.useState(() => JSON.stringify(AD_COPY_CRM_INPUT_EXAMPLE, null, 2));
  const [stages, setStages] = React.useState<readonly AdCopyStageResult[]>(initialStages);
  const [selectedStageId, setSelectedStageId] = React.useState<AdCopyStageId | null>(null);
  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<AdCopyRunResult | null>(null);
  const keyConfigured = hasBrowserLlmKeyConfigured();

  const selectedDefinition = AD_COPY_STAGE_DEFINITIONS.find((definition) => definition.id === selectedStageId);
  const selectedStage = stages.find((stage) => stage.id === selectedStageId);

  const handleRun = async () => {
    setRunning(true);
    setRunError(null);
    setLastResult(null);
    setStages(initialStages());
    try {
      const result = await runAdCopyTestBench(rawInput, setStages);
      setLastResult(result);
      onRunComplete(result, rawInput);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Не удалось выполнить тестовый прогон.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-4">
      {!keyConfigured ? (
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 shrink-0" aria-hidden="true" />
            Чтобы прогнать пайплайн с реальными вызовами модели, задайте API-ключ Anthropic или OpenAI в разделе «Настройки».
          </span>
        </Alert>
      ) : null}

      <Card className="grid gap-2">
        <p className="text-sm font-medium">Входные данные (CRM JSON)</p>
        <Textarea className="min-h-40 font-mono text-xs" value={rawInput} onChange={(event) => setRawInput(event.target.value)} />
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleRun} disabled={running || !rawInput.trim()}>
            <Play className="size-4" aria-hidden="true" />
            {running ? "Выполняется…" : "▶ Прогнать пайплайн"}
          </Button>
          {lastResult ? (
            <>
              <Badge tone={lastResult.success ? "success" : "error"}>{lastResult.success ? "Завершено" : "Ошибка"}</Badge>
              <Badge tone="neutral">{lastResult.totalDurationMs} мс</Badge>
              <Badge tone="neutral">≈{lastResult.totalTokensEstimate} токенов</Badge>
              <Badge tone="neutral">≈${lastResult.totalCostUsd.toFixed(4)}</Badge>
              {lastResult.finalRecord ? <Badge tone={lastResult.finalRecord.lowConfidence ? "warning" : "success"}>Confidence {lastResult.finalRecord.confidenceScore}%</Badge> : null}
            </>
          ) : null}
        </div>
        {runError ? <Alert tone="warning">{runError}</Alert> : null}
      </Card>

      <div className="flex flex-wrap gap-3">
        {AD_COPY_STAGE_DEFINITIONS.map((definition) => {
          const stage = stages.find((item) => item.id === definition.id) ?? { id: definition.id, status: "idle" as const };
          return <StageCard key={definition.id} definition={definition} stage={stage} onClick={() => setSelectedStageId(definition.id)} />;
        })}
      </div>

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

      {selectedDefinition && selectedStage ? <StageDetailDialog definition={selectedDefinition} stage={selectedStage} onClose={() => setSelectedStageId(null)} /> : null}
    </div>
  );
}

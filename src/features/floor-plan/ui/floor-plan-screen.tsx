"use client";
/* eslint-disable @next/next/no-img-element -- previews are local user data URLs and provider artifacts */

import * as React from "react";
import { BarChart3, CheckCircle2, Download, Expand, FileImage, FlaskConical, History, ImagePlus, Settings2, Trash2, UploadCloud, Workflow } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Page, Progress, Radio, Section, SegmentedControl, Switch } from "@/shared/ui";
import type { ExperimentRun, FloorPlanEvaluation, FloorPlanGenerationOptions, FloorPlanPipelineStatus, FloorPlanStageTelemetry, FloorPlanStyle } from "../domain/schema";
import { appendExperimentRuns, clearExperimentRuns, deleteExperimentRun, loadExperimentRuns, selectExperimentRun, updateRunEvaluation } from "../benchmark/run-store";
import { BenchmarkDashboard } from "./benchmark-dashboard";
import { EvaluationForm } from "./evaluation-form";
import { FloorPlanPipelineEditor } from "./pipeline-editor";
import { dataUrlToFile, prepareSource, type PreparedSource, type SourcePage } from "../lib/preprocess";
import { loadFloorPlanBrowserSettings } from "../config/browser-settings";
import { DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS, loadFloorPlanPipelineSettings, type FloorPlanPipelineSettings } from "../config/pipeline-settings";
import { loadAiTunnelApiKey } from "@/shared/llm/browser-direct-provider";
import { BrowserFloorPlanPipelineClient } from "../providers/browser-client";
import { executeFloorPlanPipeline, type FloorPlanPipelineResult } from "../pipeline/orchestrator";
import { validateFloorPlanScene } from "../validation/validate-scene";
import { normalizeFloorPlanQa } from "../domain/normalize-qa";

type ViewMode = "pipeline" | "workspace" | "benchmark";
type ResultCard = { runId: string; result: FloorPlanPipelineResult | null; error: string | null };
const allowedTypes = ".jpg,.jpeg,.png,.pdf,application/pdf,image/jpeg,image/png";
const defaultOptions: FloorPlanGenerationOptions = { roomNames: true, roomAreas: true, wallDimensions: false, cardinalDirections: false, furniture: false };
const statusLabels: Record<FloorPlanPipelineStatus, string> = { uploaded: "Исходник готов", analyzing: "Vision-анализ", generating: "Генерация планировки", verifying: "Автоматическая QA", fixing: "Исправление результата", completed: "Готово", failed: "Требует проверки" };
const stageLabels: Record<FloorPlanStageTelemetry["stage"], string> = { analysis: "Vision-анализ", generation: "Генерация", qa: "QA", fix: "Исправление", "qa-after-fix": "Повторная QA" };

async function sourceHash(file: File): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join(""); }
function errorMessage(value: unknown) { return value instanceof Error ? value.message : "Не удалось обработать планировку."; }
function sumUsage(telemetry: FloorPlanStageTelemetry[]) { const result: Record<string, number> = {}; for (const stage of telemetry) for (const [key, value] of Object.entries(stage.usage ?? {})) result[key] = (result[key] ?? 0) + value; return Object.keys(result).length ? result : null; }
function sumCost(telemetry: FloorPlanStageTelemetry[]) { const values = telemetry.flatMap((stage) => stage.costRub === null ? [] : [stage.costRub]); return values.length ? values.reduce((sum, value) => sum + value, 0) : null; }
function downloadDataUrl(dataUrl: string, filename: string) { const link = document.createElement("a"); link.href = dataUrl; link.download = filename; link.click(); }
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

export function FloorPlanScreen() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const referenceRef = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = React.useState<ViewMode>("workspace");
  const [pipeline, setPipeline] = React.useState<FloorPlanPipelineSettings>(DEFAULT_FLOOR_PLAN_PIPELINE_SETTINGS);
  const [prepared, setPrepared] = React.useState<PreparedSource | null>(null);
  const [selectedPage, setSelectedPage] = React.useState(1);
  const [style, setStyle] = React.useState<FloorPlanStyle>("standard");
  const [options, setOptions] = React.useState<FloorPlanGenerationOptions>(defaultOptions);
  const [styleReference, setStyleReference] = React.useState<File | null>(null);
  const [styleReferencePreview, setStyleReferencePreview] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<FloorPlanPipelineStatus | null>(null);
  const [telemetry, setTelemetry] = React.useState<FloorPlanStageTelemetry[]>([]);
  const [runs, setRuns] = React.useState<ExperimentRun[]>([]);
  const [card, setCard] = React.useState<ResultCard | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<{ title: string; dataUrl: string } | null>(null);

  React.useEffect(() => { setRuns(loadExperimentRuns()); setPipeline(loadFloorPlanPipelineSettings()); }, []);
  React.useEffect(() => () => { if (styleReferencePreview) URL.revokeObjectURL(styleReferencePreview); }, [styleReferencePreview]);
  const page = prepared?.pages.find((item) => item.page === selectedPage) ?? null;
  const currentRun = card ? runs.find((run) => run.id === card.runId) : null;
  const modelReady = Object.values(pipeline.stages).every((stage) => stage.model && stage.prompt.trim());

  const ingest = async (file: File) => {
    setPreparing(true); setError(null); setCard(null); setTelemetry([]);
    try { const next = await prepareSource(file, { grayscale: false, contrast: false }); setPrepared(next); setSelectedPage(next.selectedPage); setStatus("uploaded"); }
    catch (reason) { setPrepared(null); setStatus(null); setError(errorMessage(reason)); }
    finally { setPreparing(false); }
  };
  const chooseReference = (file: File | null) => { if (styleReferencePreview) URL.revokeObjectURL(styleReferencePreview); setStyleReference(file); setStyleReferencePreview(file ? URL.createObjectURL(file) : null); };
  const resetSource = () => { setPrepared(null); setCard(null); setStatus(null); setTelemetry([]); setError(null); if (inputRef.current) inputRef.current.value = ""; };

  const run = async () => {
    if (!prepared || !page) { setError("Сначала загрузите исходную планировку."); return; }
    if (!modelReady) { setError("Откройте «Пайплайн» и выберите модели для всех четырёх AI-этапов."); return; }
    if (style === "vladis" && !styleReference) { setError("Для фирменного стиля Vladis добавьте референс планировки с логотипом."); return; }
    const browserSettings = loadFloorPlanBrowserSettings(); const apiKey = browserSettings.apiKey || loadAiTunnelApiKey();
    if (!apiKey) { setError("Добавьте AI Tunnel API key в «Настройках»."); return; }
    setBusy(true); setError(null); setCard(null); setTelemetry([]);
    const pipelineId = crypto.randomUUID(); const timestamp = new Date().toISOString(); let partialTelemetry: FloorPlanStageTelemetry[] = [];
    try {
      const hash = await sourceHash(prepared.original); const normalized = await dataUrlToFile(page.dataUrl, prepared.original.name);
      const client = new BrowserFloorPlanPipelineClient({ ...browserSettings, apiKey });
      const result = await executeFloorPlanPipeline({
        pipelineId, source: { file: normalized, width: page.width, height: page.height, page: page.page }, styleReferences: styleReference ? [styleReference] : [],
        models: { analysisModel: pipeline.stages.analysis.model, generationModel: pipeline.stages.generation.model, qaModel: pipeline.stages.qa.model, fixModel: pipeline.stages.fix.model },
        prompts: { analysis: pipeline.stages.analysis.prompt, generation: pipeline.stages.generation.prompt, qa: pipeline.stages.qa.prompt, fix: pipeline.stages.fix.prompt }, style, options, client,
        onStatus: setStatus, onTelemetry: (next) => { partialTelemetry = next; setTelemetry(next); },
      });
      const runValue: ExperimentRun = {
        id: pipelineId, pipelineId, timestamp, source: { name: prepared.original.name, type: prepared.original.type, width: page.width, height: page.height, page: page.page, pages: prepared.pages.length }, sourceHash: hash,
        provider: "model-a", model: pipeline.stages.generation.model, modelVersion: null, pipeline: "end-to-end", promptVersion: "floor-plan-configurable-v2", processingTime: result.totalDuration, totalDuration: result.totalDuration,
        result: { kind: "image", artifactStored: false }, structuredResult: result.scene, validation: validateFloorPlanScene(result.scene), userEvaluation: null, estimatedCost: sumCost(result.telemetry), usage: sumUsage(result.telemetry), error: null,
        status: result.status, style, generationOptions: options, qa: result.qa, autoFixAttempts: result.autoFixAttempts, stageTelemetry: result.telemetry, selectedAsFinal: false,
      };
      setRuns(appendExperimentRuns([runValue])); setCard({ runId: pipelineId, result, error: null });
    } catch (reason) {
      const message = errorMessage(reason); const hash = await sourceHash(prepared.original);
      const failed: ExperimentRun = { id: pipelineId, pipelineId, timestamp, source: { name: prepared.original.name, type: prepared.original.type, width: page.width, height: page.height, page: page.page, pages: prepared.pages.length }, sourceHash: hash, provider: "model-a", model: pipeline.stages.generation.model, modelVersion: null, pipeline: "end-to-end", promptVersion: "floor-plan-configurable-v2", processingTime: partialTelemetry.reduce((sum, item) => sum + item.durationMs, 0), totalDuration: partialTelemetry.reduce((sum, item) => sum + item.durationMs, 0), result: null, structuredResult: null, validation: null, userEvaluation: null, estimatedCost: sumCost(partialTelemetry), usage: sumUsage(partialTelemetry), error: message, status: "failed", style, generationOptions: options, qa: null, autoFixAttempts: partialTelemetry.some((item) => item.stage === "fix") ? 1 : 0, stageTelemetry: partialTelemetry, selectedAsFinal: false };
      setRuns(appendExperimentRuns([failed])); setCard({ runId: pipelineId, result: null, error: message }); setStatus("failed");
    } finally { setBusy(false); }
  };

  return (
    <Page className="max-w-[1700px]">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><FlaskConical className="size-5" /><h1 className="text-2xl font-semibold">AI Floor Plan</h1><Badge tone="warning">Исследовательский PoC</Badge></div><p className="mt-1 max-w-3xl text-sm text-text-muted">Настраиваемый AI-пайплайн генерации 2D-планировок. Геометрия и соответствие исходнику важнее оформления.</p></div><SegmentedControl className="max-w-full overflow-x-auto"><Button className="shrink-0" variant={mode === "pipeline" ? "primary" : "ghost"} onClick={() => setMode("pipeline")}><Workflow className="size-4" />Пайплайн</Button><Button className="shrink-0" variant={mode === "workspace" ? "primary" : "ghost"} onClick={() => setMode("workspace")}><FileImage className="size-4" />Тестирование</Button><Button className="shrink-0" variant={mode === "benchmark" ? "primary" : "ghost"} onClick={() => setMode("benchmark")}><BarChart3 className="size-4" />Benchmark</Button></SegmentedControl></div>
      {mode === "pipeline" ? <FloorPlanPipelineEditor value={pipeline} onChange={setPipeline} /> : null}
      {mode === "benchmark" ? <BenchmarkDashboard runs={runs} onClear={() => { clearExperimentRuns(); setRuns([]); }} /> : null}
      {mode === "workspace" ? <>
        {!modelReady ? <Alert tone="warning"><div className="flex flex-wrap items-center justify-between gap-2"><span>Пайплайн не настроен: выберите модели анализа, генерации, QA и исправления.</span><Button size="sm" onClick={() => setMode("pipeline")}>Настроить пайплайн</Button></div></Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.85fr)_minmax(0,1.05fr)]">
          <SourcePanel prepared={prepared} page={page} selectedPage={selectedPage} preparing={preparing} inputRef={inputRef} onSelectPage={setSelectedPage} onIngest={ingest} onReset={resetSource} />
          <GenerationSettings style={style} options={options} reference={styleReference} referencePreview={styleReferencePreview} referenceRef={referenceRef} onStyle={setStyle} onOptions={setOptions} onReference={chooseReference} />
          <ResultPanel card={card} run={currentRun ?? null} busy={busy} status={status} telemetry={telemetry} canRun={Boolean(prepared && page && modelReady)} onRun={() => void run()} onExpand={(title, dataUrl) => setExpanded({ title, dataUrl })} onSelect={(id) => setRuns(selectExperimentRun(id))} onDelete={(id) => { setRuns(deleteExperimentRun(id)); setCard(null); }} onSaveEvaluation={(id, value) => setRuns(updateRunEvaluation(id, value))} />
        </div>
        <RecentRuns runs={runs} />
      </> : null}
      {expanded ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" onClick={() => setExpanded(null)}><div className="relative h-[92vh] w-[94vw] rounded-lg bg-white p-4" onClick={(event) => event.stopPropagation()}><Button className="absolute right-4 top-4 z-10" onClick={() => setExpanded(null)}>Закрыть</Button><h2 className="mb-3 font-semibold text-slate-900">{expanded.title}</h2><img src={expanded.dataUrl} alt={expanded.title} className="h-[calc(100%-3rem)] w-full object-contain" /></div></div> : null}
    </Page>
  );
}

function SourcePanel({ prepared, page, selectedPage, preparing, inputRef, onSelectPage, onIngest, onReset }: { prepared: PreparedSource | null; page: SourcePage | null; selectedPage: number; preparing: boolean; inputRef: React.RefObject<HTMLInputElement | null>; onSelectPage: (page: number) => void; onIngest: (file: File) => Promise<void>; onReset: () => void }) {
  return <Card className="grid gap-4"><div><span className="text-xs font-medium text-text-muted">1. ИСХОДНИК</span><h2 className="mt-1 font-semibold">Загрузите исходное изображение</h2><p className="mt-1 text-xs text-text-muted">План БТИ, техплан, кадастровый чертёж, скан, фото или рисунок от руки.</p></div>{!prepared ? <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void onIngest(file); }} onClick={() => inputRef.current?.click()} className="flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6 text-center hover:border-focus"><UploadCloud className="size-9 text-primary" /><div><div className="font-medium">Перетащите план сюда</div><div className="mt-1 text-sm text-text-muted">или нажмите для загрузки</div></div><div className="text-xs text-text-muted">JPG, JPEG, PNG или PDF · до 20 МБ</div><input ref={inputRef} className="hidden" type="file" accept={allowedTypes} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onIngest(file); }} /></div> : <div className="grid gap-3"><div className="overflow-hidden rounded-md border border-border bg-white"><img src={page?.dataUrl} alt="Исходная планировка" className="h-72 w-full object-contain" /></div><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{prepared.original.name}</div><div className="text-xs text-text-muted">{prepared.format} · {page?.width} × {page?.height} · страниц: {prepared.pages.length}</div></div><Button size="sm" variant="ghost" aria-label="Удалить исходник" onClick={onReset}><Trash2 className="size-4" /></Button></div>{prepared.pages.length > 1 ? <div className="flex gap-2 overflow-x-auto">{prepared.pages.map((item) => <button key={item.page} type="button" onClick={() => onSelectPage(item.page)} className={`shrink-0 rounded border px-3 py-1 text-xs ${selectedPage === item.page ? "border-focus bg-selected" : "border-border"}`}>Страница {item.page}</button>)}</div> : null}</div>}{preparing ? <div className="grid gap-2 text-sm"><span>Подготавливаем файл…</span><Progress /></div> : null}</Card>;
}

function GenerationSettings({ style, options, reference, referencePreview, referenceRef, onStyle, onOptions, onReference }: { style: FloorPlanStyle; options: FloorPlanGenerationOptions; reference: File | null; referencePreview: string | null; referenceRef: React.RefObject<HTMLInputElement | null>; onStyle: (style: FloorPlanStyle) => void; onOptions: (options: FloorPlanGenerationOptions) => void; onReference: (file: File | null) => void }) {
  const toggles: Array<[keyof FloorPlanGenerationOptions, string]> = [["roomNames", "Показывать названия помещений"], ["roomAreas", "Показывать площади помещений"], ["wallDimensions", "Показывать размеры стен"], ["cardinalDirections", "Показывать стороны света"], ["furniture", "Добавить мебель, если она есть на плане"]];
  const referenceTitle = style === "vladis" ? "Референс Vladis (обязательно)" : "Референс оформления (необязательно)";
  return <Card className="grid gap-4"><div><span className="text-xs font-medium text-text-muted">2. ПАРАМЕТРЫ</span><h2 className="mt-1 font-semibold">Настройте планировку</h2></div><div className="grid gap-2"><label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${style === "standard" ? "border-focus bg-selected" : "border-border"}`}><Radio name="style" checked={style === "standard"} onChange={() => onStyle("standard")} /><span><span className="font-medium">Стандартная планировка</span><span className="mt-1 block text-xs text-text-muted">Белый фон, толстые графитовые стены и аккуратные подтверждённые подписи.</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${style === "vladis" ? "border-focus bg-selected" : "border-border"}`}><Radio name="style" checked={style === "vladis"} onChange={() => onStyle("vladis")} /><span><span className="font-medium">Планировка Vladis</span><span className="mt-1 block text-xs text-text-muted">Фирменный стиль и логотип из загруженного референса.</span></span></label></div><div className="grid gap-2 rounded-md border border-border p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{referenceTitle}</span>{reference ? <Button size="sm" variant="ghost" onClick={() => onReference(null)}>Удалить</Button> : null}</div>{referencePreview ? <img src={referencePreview} alt="Референс оформления" className="h-32 w-full rounded bg-white object-contain" /> : <button type="button" onClick={() => referenceRef.current?.click()} className="grid min-h-24 place-items-center rounded border border-dashed border-border text-sm text-text-muted"><span className="flex items-center gap-2"><ImagePlus className="size-4" />Загрузить пример оформления</span></button>}<input ref={referenceRef} className="hidden" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(event) => onReference(event.target.files?.[0] ?? null)} /><p className="text-xs text-text-muted">Референс задаёт только толщину стен, цвета, оформление проёмов и типографику. Геометрия всегда берётся из исходника.</p></div><div className="grid gap-1">{toggles.map(([key, label]) => <label key={key} className="flex min-h-11 items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-0"><span>{label}</span><Switch aria-label={label} checked={options[key]} onChange={(event) => onOptions({ ...options, [key]: event.target.checked })} /></label>)}</div><Alert tone="info">Нечитаемые пометки и неподтверждённые значения не переносятся в результат.</Alert></Card>;
}

function ResultPanel({ card, run, busy, status, telemetry, canRun, onRun, onExpand, onSelect, onDelete, onSaveEvaluation }: { card: ResultCard | null; run: ExperimentRun | null; busy: boolean; status: FloorPlanPipelineStatus | null; telemetry: FloorPlanStageTelemetry[]; canRun: boolean; onRun: () => void; onExpand: (title: string, dataUrl: string) => void; onSelect: (id: string) => void; onDelete: (id: string) => void; onSaveEvaluation: (id: string, value: FloorPlanEvaluation) => void }) {
  const result = card?.result;
  return <Card className="grid gap-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-medium text-text-muted">3. РЕЗУЛЬТАТ</span><h2 className="mt-1 font-semibold">Готовая 2D-планировка</h2></div>{status ? <Badge tone={status === "completed" ? "success" : status === "failed" && result ? "warning" : status === "failed" ? "error" : "info"}>{statusLabels[status]}</Badge> : null}</div>{busy ? <div className="grid min-h-72 place-content-center gap-3 text-center"><Settings2 className="mx-auto size-8 animate-spin text-primary" /><div className="font-medium">{status ? statusLabels[status] : "Запускаем пайплайн"}</div><Progress /></div> : result ? <><div className="relative overflow-hidden rounded-md border border-border bg-white"><img src={result.dataUrl} alt="Сгенерированная 2D-планировка" className="h-96 w-full object-contain" /><Button size="sm" variant="secondary" className="absolute right-2 top-2" aria-label="Увеличить планировку" onClick={() => onExpand("Сгенерированная 2D-планировка", result.dataUrl)}><Expand className="size-4" /></Button></div><div className="flex flex-wrap items-center gap-2 text-xs"><Badge tone={result.qa.passed ? "success" : "error"}>{result.qa.passed ? "QA пройдена" : "QA не пройдена"}</Badge><span>Оценка: {(result.qa.score * 100).toFixed(0)}%</span><span>Исправлений: {result.autoFixAttempts}</span></div><QaDetails result={result} /><TelemetryDetails telemetry={result.telemetry} /><div className="grid gap-2 sm:grid-cols-3"><Button variant="secondary" onClick={() => onExpand("Сгенерированная 2D-планировка", result.dataUrl)}><Expand className="size-4" />Увеличить</Button><Button variant="secondary" onClick={() => downloadDataUrl(result.dataUrl, "floor-plan.png")}><Download className="size-4" />Скачать</Button><Button variant="primary" disabled={!result.qa.passed} onClick={() => onSelect(card.runId)}><CheckCircle2 className="size-4" />Использовать</Button></div>{run?.selectedAsFinal ? <Alert tone="success">Эта планировка выбрана для использования.</Alert> : null}<div className="flex flex-wrap gap-2"><Button onClick={onRun}>Создать заново</Button><Button variant="ghost" onClick={() => onDelete(card.runId)}><Trash2 className="size-4" />Удалить запуск</Button></div><EvaluationForm initial={run?.userEvaluation ?? null} onSave={(value) => onSaveEvaluation(card.runId, value)} /></> : card?.error ? <EmptyState><Alert tone="error">{card.error}</Alert><Button onClick={onRun}>Повторить генерацию</Button></EmptyState> : <EmptyState><FileImage className="size-10 text-text-muted" /><span>Здесь появится готовая планировка</span><Button variant="primary" disabled={!canRun} onClick={onRun}>Создать 2D-планировку</Button></EmptyState>}{telemetry.length && !result ? <TelemetryDetails telemetry={telemetry} /> : null}</Card>;
}

function RecentRuns({ runs }: { runs: ExperimentRun[] }) {
  const recent = runs.filter((run) => run.pipeline === "end-to-end").slice(0, 6);
  return <Section><div className="flex items-center gap-2"><History className="size-4 text-text-muted" /><h2 className="text-lg font-semibold">История планировок</h2><Badge tone="neutral">{recent.length}</Badge></div>{recent.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{recent.map((run) => <Card key={run.id} className="grid gap-2 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{run.source.name}</div><div className="text-xs text-text-muted">{formatDate(run.timestamp)}</div></div><Badge tone={run.status === "completed" ? "success" : "warning"}>{run.status === "completed" ? "Готово" : run.result ? "Не прошло QA" : "Ошибка запуска"}</Badge></div><div className="truncate text-xs text-text-muted">{run.model}</div><div className="flex flex-wrap gap-2 text-xs"><span>{run.style === "vladis" ? "Vladis" : "Standard"}</span><span>{((run.totalDuration ?? run.processingTime) / 1000).toFixed(1)} с</span>{run.selectedAsFinal ? <Badge tone="success">Используется</Badge> : null}</div></Card>)}</div> : <Card className="text-sm text-text-muted">После первого запуска здесь появится история.</Card>}</Section>;
}

function QaDetails({ result }: { result: FloorPlanPipelineResult }) { const qa = normalizeFloorPlanQa(result.qa); if (!qa.errors.length && !qa.warnings.length) return <Alert tone="success">Критических расхождений не найдено.</Alert>; return <div className="grid gap-2 text-xs">{qa.errors.length ? <Alert tone="error"><strong>Ошибки:</strong><ul className="mt-1 list-disc pl-4">{qa.errors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></Alert> : null}{qa.warnings.length ? <Alert tone="warning"><strong>Предупреждения:</strong><ul className="mt-1 list-disc pl-4">{qa.warnings.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></Alert> : null}</div>; }
function TelemetryDetails({ telemetry }: { telemetry: FloorPlanStageTelemetry[] }) { const totalCost = sumCost(telemetry); return <details className="text-xs"><summary className="cursor-pointer font-medium">Телеметрия этапов{totalCost === null ? "" : ` · ${totalCost.toFixed(2)} ₽`}</summary><div className="mt-2 grid gap-1">{telemetry.map((item) => <div key={item.stage} className="flex flex-wrap justify-between gap-2 rounded bg-secondary p-2"><span>{stageLabels[item.stage]} · {item.model}</span><span>{(item.durationMs / 1000).toFixed(1)} с{item.costRub === null ? "" : ` · ${item.costRub.toFixed(2)} ₽`}</span></div>)}</div></details>; }

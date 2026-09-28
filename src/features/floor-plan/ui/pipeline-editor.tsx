"use client";

import * as React from "react";
import { Braces, Check, ChevronDown, ChevronRight, Code2, ImageIcon, RotateCcw, ScanSearch, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, Select, Textarea } from "@/shared/ui";
import { loadAiTunnelModelCatalog, type AiTunnelModelCatalog } from "../config/model-catalog";
import {
  resetFloorPlanPipelinePrompts, saveFloorPlanPipelineSettings, type FloorPlanAiStageId, type FloorPlanPipelineSettings,
} from "../config/pipeline-settings";

type StageDefinition = {
  id: string; title: string; description: string; type: "code" | "vision" | "image"; input: string; output: string;
  aiStage?: FloorPlanAiStageId; conditional?: boolean;
};

const stages: StageDefinition[] = [
  { id: "prepare", title: "Подготовка исходника", description: "Проверяет JPG, PNG или PDF, выбирает страницу и сохраняет пропорции.", type: "code", input: "Файл пользователя", output: "Нормализованное изображение" },
  { id: "analysis", aiStage: "analysis", title: "Vision-анализ планировки", description: "Извлекает стены, помещения, проёмы, подписи и размеры в FloorPlan JSON.", type: "vision", input: "Исходное изображение", output: "FloorPlan JSON" },
  { id: "validation", title: "Проверка FloorPlan JSON", description: "Детерминированно проверяет координаты, ссылки на стены и геометрию.", type: "code", input: "FloorPlan JSON", output: "Ошибки и предупреждения" },
  { id: "generation", aiStage: "generation", title: "Генерация 2D-планировки", description: "Создаёт Standard или Vladis-вариант с выбранными параметрами.", type: "image", input: "Исходник, JSON, референс и настройки", output: "PNG-планировка" },
  { id: "qa", aiStage: "qa", title: "Автоматическая Vision QA", description: "Сравнивает исходник, результат и JSON, запрещая изменения геометрии и галлюцинации.", type: "vision", input: "Исходник и результат", output: "QA JSON и оценка" },
  { id: "fix", aiStage: "fix", title: "Исправление результата", description: "Однократно исправляет только расхождения, найденные QA.", type: "image", input: "Исходник, результат и QA", output: "Исправленный PNG", conditional: true },
  { id: "save", title: "Сохранение результата", description: "Записывает историю, телеметрию, стоимость и выбранную планировку.", type: "code", input: "Результат пайплайна", output: "Запуск в истории" },
];

const typeMeta = {
  code: { label: "CODE", icon: Code2 }, vision: { label: "VISION", icon: ScanSearch }, image: { label: "IMAGE", icon: ImageIcon },
} as const;

export function FloorPlanPipelineEditor({ value, onChange }: Readonly<{ value: FloorPlanPipelineSettings; onChange: (value: FloorPlanPipelineSettings) => void }>) {
  const [catalog, setCatalog] = React.useState<AiTunnelModelCatalog | null>(null);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>("analysis");
  const [saved, setSaved] = React.useState(false);

  const refresh = React.useCallback(() => {
    setCatalogError(null);
    void loadAiTunnelModelCatalog().then(setCatalog).catch((error) => setCatalogError(error instanceof Error ? error.message : "Не удалось загрузить каталог моделей."));
  }, []);
  React.useEffect(refresh, [refresh]);

  const update = (stage: FloorPlanAiStageId, field: "model" | "prompt", nextValue: string) => {
    onChange({ ...value, stages: { ...value.stages, [stage]: { ...value.stages[stage], [field]: nextValue } } });
    setSaved(false);
  };
  const save = () => { onChange(saveFloorPlanPipelineSettings(value)); setSaved(true); };
  const reset = () => { onChange(resetFloorPlanPipelinePrompts(value)); setSaved(true); };
  const configured = Object.values(value.stages).filter((stage) => stage.model).length;

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Пайплайн генерации планировки</h2><p className="text-sm text-text-muted">Откройте AI-этап, выберите модель и отредактируйте его промпт. CODE-этапы выполняются детерминированно.</p></div>
        <div className="flex flex-wrap gap-2"><Badge tone={configured === 4 ? "success" : "warning"}>{configured}/4 моделей</Badge><Button variant="ghost" onClick={reset}><RotateCcw className="size-4" />Вернуть промпты</Button><Button variant="primary" onClick={save}><Check className="size-4" />Сохранить пайплайн</Button></div>
      </Card>
      {catalogError ? <Alert tone="error"><div className="flex flex-wrap items-center gap-2"><span>{catalogError}</span><Button size="sm" onClick={refresh}>Повторить</Button></div></Alert> : null}
      {saved ? <Alert tone="success">Настройки пайплайна сохранены в этом браузере.</Alert> : null}
      <div className="grid gap-3">
        {stages.map((stage, index) => {
          const meta = typeMeta[stage.type]; const Icon = meta.icon; const isExpanded = expanded === stage.id; const settings = stage.aiStage ? value.stages[stage.aiStage] : null;
          const models = stage.type === "image" ? catalog?.imageModels : catalog?.visionModels;
          return (
            <Card key={stage.id} className="p-0 overflow-hidden">
              <button type="button" className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setExpanded(isExpanded ? null : stage.id)} aria-expanded={isExpanded}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{index + 1}</span>
                <Icon className="mt-1 size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{stage.title}<Badge tone={stage.type === "code" ? "neutral" : "info"}>{meta.label}</Badge>{stage.conditional ? <Badge tone="warning">если QA не пройдена</Badge> : null}</span><span className="mt-1 block text-sm text-text-muted">{stage.description}</span></span>
                {settings?.model ? <Badge tone="success" className="max-w-48 truncate">{settings.model}</Badge> : stage.type !== "code" ? <Badge tone="warning">модель не выбрана</Badge> : null}
                {isExpanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
              </button>
              {isExpanded ? <div className="grid gap-4 border-t border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md bg-secondary p-3 text-sm"><span className="text-xs text-text-muted">Вход</span><div>{stage.input}</div></div><div className="rounded-md bg-secondary p-3 text-sm"><span className="text-xs text-text-muted">Выход</span><div>{stage.output}</div></div></div>
                {stage.aiStage && settings ? <><label className="grid gap-1 text-sm">Модель<Select aria-label={`${stage.title}: модель`} value={settings.model} onChange={(event) => update(stage.aiStage!, "model", event.target.value)}><option value="">Выберите модель AI Tunnel</option>{models?.map((model) => <option key={model.id} value={model.id}>{model.id}{model.provider ? ` · ${model.provider}` : ""}</option>)}</Select></label><label className="grid gap-1 text-sm">Промпт<Textarea aria-label={`${stage.title}: промпт`} className="min-h-56 font-mono text-xs" value={settings.prompt} onChange={(event) => update(stage.aiStage!, "prompt", event.target.value)} /></label></> : <Alert tone="info"><div className="flex items-center gap-2"><Braces className="size-4" /><span>Этот этап не использует AI-модель и выполняется одинаково при каждом запуске.</span></div></Alert>}
              </div> : null}
            </Card>
          );
        })}
      </div>
      <Alert tone="info"><div className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>Промпты дополняются FloorPlan JSON и параметрами текущего запуска. API key задаётся в «Настройках» и не сохраняется внутри пайплайна.</span></div></Alert>
    </div>
  );
}

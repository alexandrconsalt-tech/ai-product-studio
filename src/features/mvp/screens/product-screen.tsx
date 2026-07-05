"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, Mic, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, EmptyState, IconButton, Input, Page, Search, Section, Status, Tabs, Tab, Textarea } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useProjectStore } from "@/shared/stores/project-store";
import { useProductStore } from "@/shared/stores/product-store";
import { createEntityId } from "@/entities/shared";
import type { Project } from "@/entities/Project/model/types";
import type { Product, ProductFeature, ProductJTBD, ProductMetric, ProductMetricCategory, ProductUser } from "@/entities/Product/model/types";
import { callBrowserLlm, hasBrowserLlmKeyConfigured, parseJsonResponse } from "@/shared/llm/browser-direct-provider";
import { getProjectBundle } from "../selectors";

// ── Web Speech API (no official TS lib types) — minimal typed surface ──
type SpeechRecognitionResultLike = Readonly<{ transcript: string }>;
type SpeechRecognitionEventLike = Readonly<{ results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> }>;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── line-based (de)serialization for array-shaped Product fields ──
// Chosen over a nested per-item form (add/remove rows) per CLAUDE.md's
// simplicity-first principle: these are plain lists of short strings and
// the AI Assist flow already produces/consumes them as text.
function usersToText(users: readonly ProductUser[]): string {
  return users.map((user) => (user.segment ? `${user.name} — ${user.segment}` : user.name)).join("\n");
}
function textToUsers(text: string): ProductUser[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, segment] = line.split("—").map((part) => part.trim());
      return { id: createEntityId("user"), name: name || line, segment: segment || undefined };
    });
}
function jtbdToText(jtbd: readonly ProductJTBD[]): string {
  return jtbd.map((job) => job.statement).join("\n");
}
function textToJtbd(text: string): ProductJTBD[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((statement) => ({ statement }));
}
function featuresToText(features: readonly ProductFeature[]): string {
  return features.map((feature) => feature.name).join("\n");
}
function textToFeatures(text: string): ProductFeature[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ id: createEntityId("feature"), name }));
}
function metricsToText(metrics: readonly ProductMetric[], category: ProductMetricCategory): string {
  return metrics
    .filter((metric) => metric.category === category)
    .map((metric) => (metric.target ? `${metric.name}: ${metric.target}` : metric.name))
    .join("\n");
}
function textToMetrics(text: string, category: ProductMetricCategory): ProductMetric[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, target] = line.split(":").map((part) => part.trim());
      return { name: name || line, target: target || undefined, category };
    });
}

type ProductFormState = Readonly<{
  name: string;
  description: string;
  problem: string;
  valueProposition: string;
  targetAudience: string;
  usersText: string;
  discovery: string;
  jtbdText: string;
  userStory: string;
  mainScenario: string;
  mvpIn: string;
  mvpOut: string;
  featuresText: string;
  assumptions: string;
  aiModels: string;
  aiAgents: string;
  aiPipelineNotes: string;
  successMetricsText: string;
  qualityMetricsText: string;
  costMetricsText: string;
  speedMetricsText: string;
  acceptanceCriteria: string;
  roadmap: string;
  notes: string;
}>;

function formFromEntities(project: Project, product: Product): ProductFormState {
  return {
    name: project.name,
    description: project.description ?? "",
    problem: product.problem?.statement ?? "",
    valueProposition: product.valueProposition ?? "",
    targetAudience: product.targetAudience ?? "",
    usersText: usersToText(product.users),
    discovery: product.discovery ?? "",
    jtbdText: jtbdToText(product.jtbd),
    userStory: product.userStory ?? "",
    mainScenario: product.mainScenario ?? "",
    mvpIn: product.mvp ?? "",
    mvpOut: product.mvpOut ?? "",
    featuresText: featuresToText(product.features),
    assumptions: product.assumptions ?? "",
    aiModels: product.aiModels ?? "",
    aiAgents: product.aiAgents ?? "",
    aiPipelineNotes: product.aiPipelineNotes ?? "",
    successMetricsText: metricsToText(product.metrics, "success"),
    qualityMetricsText: metricsToText(product.metrics, "quality"),
    costMetricsText: metricsToText(product.metrics, "cost"),
    speedMetricsText: metricsToText(product.metrics, "speed"),
    acceptanceCriteria: product.acceptanceCriteria ?? "",
    roadmap: product.roadmap ?? "",
    notes: product.notes ?? "",
  };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function lines(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const joined = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).join("\n");
    return joined || undefined;
  }
  return str(value);
}

function mergeAiDraft(prev: ProductFormState, draft: Record<string, unknown>): ProductFormState {
  return {
    name: str(draft.productName) ?? prev.name,
    description: str(draft.description) ?? prev.description,
    problem: str(draft.problem) ?? prev.problem,
    valueProposition: str(draft.valueProposition) ?? prev.valueProposition,
    targetAudience: str(draft.targetAudience) ?? prev.targetAudience,
    usersText: lines(draft.users) ?? prev.usersText,
    discovery: str(draft.discovery) ?? prev.discovery,
    jtbdText: lines(draft.jtbd) ?? prev.jtbdText,
    userStory: str(draft.userStory) ?? prev.userStory,
    mainScenario: str(draft.mainScenario) ?? prev.mainScenario,
    mvpIn: str(draft.mvpIn) ?? prev.mvpIn,
    mvpOut: str(draft.mvpOut) ?? prev.mvpOut,
    featuresText: lines(draft.features) ?? prev.featuresText,
    assumptions: str(draft.assumptions) ?? prev.assumptions,
    aiModels: str(draft.aiModels) ?? prev.aiModels,
    aiAgents: str(draft.aiAgents) ?? prev.aiAgents,
    aiPipelineNotes: str(draft.aiPipelineNotes) ?? prev.aiPipelineNotes,
    successMetricsText: lines(draft.successMetrics) ?? prev.successMetricsText,
    qualityMetricsText: lines(draft.qualityMetrics) ?? prev.qualityMetricsText,
    costMetricsText: lines(draft.costMetrics) ?? prev.costMetricsText,
    speedMetricsText: lines(draft.speedMetrics) ?? prev.speedMetricsText,
    acceptanceCriteria: str(draft.acceptanceCriteria) ?? prev.acceptanceCriteria,
    roadmap: str(draft.roadmap) ?? prev.roadmap,
    notes: str(draft.notes) ?? prev.notes,
  };
}

function buildAiAssistPrompt(idea: string): string {
  return `Ты — Senior Product Manager. Пользователь надиктовал сырую идею AI-продукта. Оформи её по шаблону Product Manager и верни СТРОГО валидный JSON без markdown и без пояснений, ровно с этими полями (строки — на русском, кроме терминов; массивы — списки коротких строк; если данных недостаточно для поля — пустая строка или пустой массив, ничего не выдумывай):
{
  "productName": string,
  "description": string,
  "problem": string,
  "valueProposition": string,
  "targetAudience": string,
  "users": string[],
  "discovery": string,
  "jtbd": string[],
  "userStory": string,
  "mainScenario": string,
  "mvpIn": string,
  "mvpOut": string,
  "features": string[],
  "assumptions": string,
  "aiModels": string,
  "aiAgents": string,
  "aiPipelineNotes": string,
  "successMetrics": string[],
  "qualityMetrics": string[],
  "costMetrics": string[],
  "speedMetrics": string[],
  "acceptanceCriteria": string,
  "roadmap": string,
  "notes": string
}

Идея пользователя:
${idea}`;
}

// ── AI Assist panel: dictate/type an idea, then let AI draft the whole card ──
function AiAssistPanel({ onApply }: Readonly<{ onApply: (draft: Record<string, unknown>) => void }>) {
  const [idea, setIdea] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = getSpeechRecognitionCtor() !== null;
  const keyConfigured = hasBrowserLlmKeyConfigured();

  const toggleDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Голосовой ввод не поддерживается в этом браузере — используйте текстовое поле ниже.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) transcript += event.results[i][0]?.transcript ?? "";
      setIdea((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setError("Не удалось распознать речь. Попробуйте ещё раз или введите текст вручную.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  };

  const handleAiFill = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await callBrowserLlm(buildAiAssistPrompt(idea.trim()));
      const draft = parseJsonResponse<Record<string, unknown>>(response);
      onApply(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить ответ от модели.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">ИИ-помощник</h2>
      </div>
      <p className="text-sm text-text-muted">Надиктуйте или опишите идею продукта — ИИ оформит карточку по шаблону Product Manager, вы только скорректируете нужные разделы.</p>
      <Textarea className="min-h-24" placeholder="Например: хочу продукт, который слушает звонки менеджеров и…" value={idea} onChange={(event) => setIdea(event.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={listening ? "primary" : "secondary"} onClick={toggleDictation}>
          <Mic className="size-4" aria-hidden="true" />
          {listening ? "Остановить запись" : "🎤 Надиктовать идею"}
        </Button>
        <Button variant="primary" onClick={handleAiFill} disabled={!idea.trim() || loading}>
          <Sparkles className="size-4" aria-hidden="true" />
          {loading ? "Заполняем карточку…" : "Заполнить карточку с помощью ИИ"}
        </Button>
        {!speechSupported ? <span className="text-xs text-text-muted">Голосовой ввод недоступен в этом браузере.</span> : null}
      </div>
      {!keyConfigured ? (
        <Alert tone="info">Чтобы ИИ мог заполнить карточку, задайте API-ключ Anthropic или OpenAI в разделе «Песочница» → Pipeline Lab v3 → «API-ключи» (используется тот же ключ).</Alert>
      ) : null}
      {error ? <Alert tone="warning">{error}</Alert> : null}
    </Card>
  );
}

const PRODUCT_TABS = ["Общая информация", "Исследование", "MVP", "ИИ", "Метрики", "Критерии приёмки", "Дорожная карта", "Заметки"] as const;
type ProductTab = (typeof PRODUCT_TABS)[number];

type ProjectDialogState =
  | Readonly<{ type: "create" }>
  | Readonly<{ type: "rename"; project: Project }>
  | Readonly<{ type: "delete"; project: Project }>
  | Readonly<{ type: "duplicate"; project: Project }>
  | null;

export function ProductScreen() {
  const router = useRouter();
  const { snapshot, selectedProjectId, selectProject } = useRepositoryStore();
  const { createProject, updateProjectDetails, deleteProject, duplicateProject } = useProjectStore();
  const { updateProduct } = useProductStore();
  const [mode, setMode] = React.useState<"list" | "detail">("list");
  const [activeTab, setActiveTab] = React.useState<ProductTab>("Общая информация");
  const [query, setQuery] = React.useState("");
  const [dialogName, setDialogName] = React.useState("");
  const [dialogDescription, setDialogDescription] = React.useState("");
  const [dialog, setDialog] = React.useState<ProjectDialogState>(null);
  const [form, setForm] = React.useState<ProductFormState | null>(null);

  const projects = snapshot?.projects ?? [];
  const filtered = projects.filter((project) => `${project.name} ${project.description ?? ""} ${project.status}`.toLowerCase().includes(query.toLowerCase()));
  const { project, product, reviews } = getProjectBundle(snapshot, selectedProjectId);
  const productReview = reviews.find((review) => review.targetType === "product");

  React.useEffect(() => {
    if (mode === "detail" && project && product) setForm(formFromEntities(project, product));
  }, [mode, project, product]);

  React.useEffect(() => {
    if (dialog?.type === "rename" || dialog?.type === "duplicate") {
      setDialogName(dialog.type === "rename" ? dialog.project.name : `${dialog.project.name} Copy`);
      setDialogDescription(dialog.project.description ?? "");
    }
    if (dialog?.type === "create") {
      setDialogName("");
      setDialogDescription("");
    }
  }, [dialog]);

  const openProduct = (projectId: string): void => {
    selectProject(projectId);
    setMode("detail");
    setActiveTab("Общая информация");
  };

  const handleCreate = (): void => {
    if (!dialogName.trim()) return;
    const created = createProject(dialogName.trim(), dialogDescription.trim() || undefined);
    setDialog(null);
    openProduct(created.id);
  };

  const handleRename = (): void => {
    if (dialog?.type !== "rename" || !dialogName.trim()) return;
    updateProjectDetails(dialog.project.id, { name: dialogName.trim(), description: dialogDescription.trim() || undefined });
    setDialog(null);
  };

  const handleDuplicate = (): void => {
    if (dialog?.type !== "duplicate") return;
    const duplicate = duplicateProject(dialog.project.id, { name: dialogName.trim() || undefined, description: dialogDescription.trim() || undefined });
    setDialog(null);
    if (duplicate) openProduct(duplicate.id);
  };

  const handleDelete = (): void => {
    if (dialog?.type !== "delete") return;
    deleteProject(dialog.project.id);
    setDialog(null);
    setMode("list");
  };

  const handleApplyAiDraft = (draft: Record<string, unknown>) => {
    setForm((prev) => (prev ? mergeAiDraft(prev, draft) : prev));
  };

  const handleSaveProduct = (): void => {
    if (!project || !product || !form) return;
    if (form.name.trim() && form.name.trim() !== project.name) {
      updateProjectDetails(project.id, { name: form.name.trim(), description: form.description.trim() || undefined });
    } else if (form.description.trim() !== (project.description ?? "")) {
      updateProjectDetails(project.id, { name: project.name, description: form.description.trim() || undefined });
    }

    const legacyMetrics = product.metrics.filter((metric) => !metric.category);
    const updated: Product = {
      ...product,
      problem: form.problem.trim() ? { statement: form.problem.trim(), evidenceIds: product.problem?.evidenceIds ?? [] } : undefined,
      valueProposition: form.valueProposition.trim() || undefined,
      targetAudience: form.targetAudience.trim() || undefined,
      users: textToUsers(form.usersText),
      discovery: form.discovery.trim() || undefined,
      jtbd: textToJtbd(form.jtbdText),
      userStory: form.userStory.trim() || undefined,
      mainScenario: form.mainScenario.trim() || undefined,
      mvp: form.mvpIn.trim() || undefined,
      mvpOut: form.mvpOut.trim() || undefined,
      features: textToFeatures(form.featuresText),
      assumptions: form.assumptions.trim() || undefined,
      aiModels: form.aiModels.trim() || undefined,
      aiAgents: form.aiAgents.trim() || undefined,
      aiPipelineNotes: form.aiPipelineNotes.trim() || undefined,
      metrics: [
        ...legacyMetrics,
        ...textToMetrics(form.successMetricsText, "success"),
        ...textToMetrics(form.qualityMetricsText, "quality"),
        ...textToMetrics(form.costMetricsText, "cost"),
        ...textToMetrics(form.speedMetricsText, "speed"),
      ],
      acceptanceCriteria: form.acceptanceCriteria.trim() || undefined,
      roadmap: form.roadmap.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    updateProduct(updated);
    router.push("/?view=playground");
  };

  const updateField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (mode === "list" || !project || !product || !form) {
    return (
      <Page>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Продукт</h1>
            <p className="text-sm text-text-muted">Список продуктов. Откройте продукт, чтобы увидеть карточку, или создайте новый.</p>
          </div>
          <div className="flex items-center gap-2">
            <Status tone="info">{projects.length} продуктов</Status>
            <Button variant="primary" onClick={() => setDialog({ type: "create" })}>
              <Plus className="size-4" aria-hidden="true" />
              Создать продукт
            </Button>
          </div>
        </div>

        <Section>
          <Search value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск продукта" aria-label="Поиск продукта" />
          {filtered.length === 0 ? (
            <EmptyState>Продукты не найдены.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {filtered.map((item) => (
                <Card key={item.id} className={selectedProjectId === item.id ? "border-focus" : undefined}>
                  <div className="flex items-center justify-between gap-4">
                    <button type="button" className="min-w-0 text-left" onClick={() => openProduct(item.id)}>
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-sm text-text-muted">{item.description}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <Status tone={item.status === "testing" ? "success" : "neutral"}>{item.status}</Status>
                      <IconButton aria-label="Переименовать продукт" variant="ghost" onClick={() => setDialog({ type: "rename", project: item })}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton aria-label="Дублировать продукт" variant="ghost" onClick={() => setDialog({ type: "duplicate", project: item })}>
                        <Copy className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton aria-label="Удалить продукт" variant="ghost" onClick={() => setDialog({ type: "delete", project: item })}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {dialog ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
            <Dialog className="w-full max-w-lg">
              {dialog.type === "delete" ? (
                <div className="grid gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Удалить продукт</h2>
                    <p className="text-sm text-text-muted">Продукт «{dialog.project.name}» и связанные данные будут удалены из Local Repository.</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setDialog(null)}>Отмена</Button>
                    <Button variant="danger" onClick={handleDelete}>
                      <Archive className="size-4" aria-hidden="true" />
                      Удалить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{dialog.type === "create" ? "Создать продукт" : dialog.type === "rename" ? "Переименовать продукт" : "Дублировать продукт"}</h2>
                    <p className="text-sm text-text-muted">Название обязательно. Описание — краткая идея продукта, можно уточнить с помощью ИИ-помощника после создания.</p>
                  </div>
                  <label className="grid gap-1 text-sm">
                    Название
                    <Input value={dialogName} onChange={(event) => setDialogName(event.target.value)} autoFocus />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Краткое описание
                    <Input value={dialogDescription} onChange={(event) => setDialogDescription(event.target.value)} />
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setDialog(null)}>Отмена</Button>
                    <Button variant="primary" disabled={!dialogName.trim()} onClick={dialog.type === "create" ? handleCreate : dialog.type === "rename" ? handleRename : handleDuplicate}>
                      {dialog.type === "create" ? "Создать" : dialog.type === "rename" ? "Сохранить" : "Дублировать"}
                    </Button>
                  </div>
                </div>
              )}
            </Dialog>
          </div>
        ) : null}
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" className="mb-2 -ml-2" onClick={() => setMode("list")}>
            ← К списку продуктов
          </Button>
          <h1 className="text-2xl font-semibold">{form.name || project.name}</h1>
          <p className="text-sm text-text-muted">{form.description || "Карточка продукта: Discovery, MVP, AI, Метрики, Acceptance Criteria, Roadmap."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Status tone="success">{product.status}</Status>
          <Button variant="primary" onClick={handleSaveProduct}>
            Сохранить продукт
          </Button>
        </div>
      </div>

      <AiAssistPanel onApply={handleApplyAiDraft} />

      <Tabs>
        {PRODUCT_TABS.map((tab) => (
          <Tab key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </Tab>
        ))}
      </Tabs>

      {activeTab === "Общая информация" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Название продукта
            <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Краткое описание
            <Input value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            Проблема
            <Textarea className="min-h-20" value={form.problem} onChange={(event) => updateField("problem", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Ценность
            <Textarea className="min-h-20" value={form.valueProposition} onChange={(event) => updateField("valueProposition", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Целевая аудитория
            <Textarea className="min-h-20" value={form.targetAudience} onChange={(event) => updateField("targetAudience", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            Пользователи (по одному на строку: Имя — Сегмент)
            <Textarea className="min-h-20" value={form.usersText} onChange={(event) => updateField("usersText", event.target.value)} />
          </label>
        </div>
      ) : null}

      {activeTab === "Исследование" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm lg:col-span-2">
            Discovery
            <Textarea className="min-h-24" value={form.discovery} onChange={(event) => updateField("discovery", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            Jobs To Be Done (по одному на строку)
            <Textarea className="min-h-24" value={form.jtbdText} onChange={(event) => updateField("jtbdText", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            User Story
            <Textarea className="min-h-20" value={form.userStory} onChange={(event) => updateField("userStory", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Основной сценарий
            <Textarea className="min-h-20" value={form.mainScenario} onChange={(event) => updateField("mainScenario", event.target.value)} />
          </label>
        </div>
      ) : null}

      {activeTab === "MVP" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Что входит
            <Textarea className="min-h-24" value={form.mvpIn} onChange={(event) => updateField("mvpIn", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Что не входит
            <Textarea className="min-h-24" value={form.mvpOut} onChange={(event) => updateField("mvpOut", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Основные функции (по одной на строку)
            <Textarea className="min-h-24" value={form.featuresText} onChange={(event) => updateField("featuresText", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Допущения
            <Textarea className="min-h-24" value={form.assumptions} onChange={(event) => updateField("assumptions", event.target.value)} />
          </label>
        </div>
      ) : null}

      {activeTab === "ИИ" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Используемые модели
            <Textarea className="min-h-20" value={form.aiModels} onChange={(event) => updateField("aiModels", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Предполагаемые агенты
            <Textarea className="min-h-20" value={form.aiAgents} onChange={(event) => updateField("aiAgents", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm lg:col-span-2">
            Пайплайн
            <Textarea className="min-h-20" value={form.aiPipelineNotes} onChange={(event) => updateField("aiPipelineNotes", event.target.value)} />
          </label>
        </div>
      ) : null}

      {activeTab === "Метрики" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Метрики успеха (название: целевое значение, по одной на строку)
            <Textarea className="min-h-24" value={form.successMetricsText} onChange={(event) => updateField("successMetricsText", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Метрики качества
            <Textarea className="min-h-24" value={form.qualityMetricsText} onChange={(event) => updateField("qualityMetricsText", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Метрики стоимости
            <Textarea className="min-h-24" value={form.costMetricsText} onChange={(event) => updateField("costMetricsText", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Метрики скорости
            <Textarea className="min-h-24" value={form.speedMetricsText} onChange={(event) => updateField("speedMetricsText", event.target.value)} />
          </label>
        </div>
      ) : null}

      {activeTab === "Критерии приёмки" ? (
        <Card>
          <Textarea className="min-h-32" value={form.acceptanceCriteria} onChange={(event) => updateField("acceptanceCriteria", event.target.value)} />
        </Card>
      ) : null}

      {activeTab === "Дорожная карта" ? (
        <Card>
          <Textarea className="min-h-32" value={form.roadmap} onChange={(event) => updateField("roadmap", event.target.value)} />
        </Card>
      ) : null}

      {activeTab === "Заметки" ? (
        <div className="grid gap-4">
          <Card>
            <Textarea className="min-h-32" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Status tone={productReview?.status === "approved" ? "success" : "warning"}>{productReview?.status ?? "not_reviewed"}</Status>
              <span className="text-sm text-text-muted">Review score: {productReview?.score ?? 0}</span>
            </div>
          </Card>
        </div>
      ) : null}
    </Page>
  );
}

"use client";

import * as React from "react";
import { Bot, Boxes, BrainCircuit, ChevronLeft, ChevronRight, FlaskConical, FolderKanban, LayoutDashboard, Microscope, Moon, PanelLeft, Play, ScrollText, Settings, Sun, LineChart } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, Header, Inspector, NavigationItem, Sidebar, Workspace, Button, IconButton, Badge, Breadcrumb, AIRecommendation, Card } from "@/shared/ui";
import { useRepositoryStore } from "@/shared/stores/repository-store";
import { useUiStore } from "@/shared/stores/ui-store";
import { getProjectBundle } from "./selectors";
import type { MvpView } from "./types";
import { ProjectsScreen } from "./screens/projects-screen";
import { ProductScreen } from "./screens/product-screen";
import { ArchitectureScreen } from "./screens/architecture-screen";
import { PipelineScreen } from "./screens/pipeline-screen";
import { PlaygroundScreen } from "./screens/playground-screen";
import { ExecutionInspectorScreen } from "./screens/execution-inspector-screen";
import { PromptInspectorScreen } from "./screens/prompt-inspector-screen";
import { AnalyticsScreen } from "./screens/analytics-screen";
import { PipelineLabV3Screen } from "./screens/pipeline-lab-v3-screen";
import { DashboardScreen } from "./screens/dashboard-screen";

// Every view stays reachable by URL (`?view=...`) -- CLAUDE.md's "hide
// navigation, never delete code" rule (AI Product Studio v2 addendum).
// Only `visibleNavItems` below decides what actually renders in the
// sidebar/prev-next arrows; `navItems` here stays the full list so
// `isMvpView`/`viewTitles` keep recognizing every hidden view too.
const navItems: ReadonlyArray<{ id: MvpView; label: string; icon: React.ReactNode }> = [
  { id: "projects", label: "Проекты", icon: <FolderKanban className="size-4" aria-hidden="true" /> },
  { id: "product", label: "Продукт", icon: <Boxes className="size-4" aria-hidden="true" /> },
  { id: "architecture", label: "Архитектура", icon: <BrainCircuit className="size-4" aria-hidden="true" /> },
  { id: "pipeline", label: "Пайплайн", icon: <Bot className="size-4" aria-hidden="true" /> },
  { id: "playground", label: "Песочница", icon: <Play className="size-4" aria-hidden="true" /> },
  { id: "inspector", label: "Инспектор", icon: <Microscope className="size-4" aria-hidden="true" /> },
  { id: "prompts", label: "Промпты", icon: <ScrollText className="size-4" aria-hidden="true" /> },
  { id: "analytics", label: "Аналитика", icon: <LineChart className="size-4" aria-hidden="true" /> },
  { id: "pipeline-lab-v3", label: "Pipeline Lab v3", icon: <FlaskConical className="size-4" aria-hidden="true" /> },
  { id: "dashboard", label: "Дашборд", icon: <LayoutDashboard className="size-4" aria-hidden="true" /> },
  { id: "settings", label: "Настройки", icon: <Settings className="size-4" aria-hidden="true" /> },
];

// AI Product Studio v2: only these three sections are visible navigation
// (Product -> Playground -> Dashboard). Everything else above stays
// reachable by URL only (Projects, Architecture, Pipeline, Inspector,
// Prompts, Analytics, Pipeline Lab v3 standalone, Settings).
const VISIBLE_VIEW_IDS: ReadonlySet<MvpView> = new Set<MvpView>(["product", "playground", "dashboard"]);
const visibleNavItems = navItems.filter((item) => VISIBLE_VIEW_IDS.has(item.id));

const viewTitles: Record<MvpView, string> = {
  projects: "Проекты",
  product: "Продукт",
  architecture: "Архитектура",
  pipeline: "Пайплайн",
  playground: "Песочница",
  inspector: "Инспектор выполнения",
  prompts: "Инспектор промптов",
  analytics: "Аналитика",
  "pipeline-lab-v3": "Pipeline Lab v3",
  dashboard: "Дашборд",
  settings: "Настройки",
};

function isMvpView(value: string | null): value is MvpView {
  return (
    value === "projects" ||
    value === "product" ||
    value === "architecture" ||
    value === "pipeline" ||
    value === "playground" ||
    value === "inspector" ||
    value === "prompts" ||
    value === "analytics" ||
    value === "pipeline-lab-v3" ||
    value === "dashboard" ||
    value === "settings"
  );
}

export function MvpShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  // AI Product Studio v2's default landing view is Product (list of
  // products), not Projects -- Product -> Playground -> Dashboard is the
  // whole visible app now.
  const view: MvpView = isMvpView(requestedView) ? requestedView : "product";
  const { snapshot, selectedProjectId, load } = useRepositoryStore();
  const { theme, setTheme, sidebarCollapsed, toggleSidebar, assistantOpen, toggleAssistant } = useUiStore();

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const bundle = getProjectBundle(snapshot, selectedProjectId);
  const goTo = (nextView: MvpView) => router.push(`/?view=${nextView}`);
  // Prev/next arrows cycle only the 3 visible views -- primary
  // navigation matches the visible sidebar; hidden screens stay
  // reachable only by typing `?view=...` directly.
  const currentIndex = visibleNavItems.findIndex((item) => item.id === view);
  const previousView = visibleNavItems[Math.max(0, currentIndex - 1)]?.id ?? "product";
  const nextView = visibleNavItems[Math.min(visibleNavItems.length - 1, currentIndex + 1)]?.id ?? "dashboard";

  return (
    <AppShell>
      <Sidebar collapsed={sidebarCollapsed} className="flex flex-col gap-3 p-2">
        <div className="flex h-10 items-center justify-between px-1">
          {!sidebarCollapsed ? <span className="text-sm font-semibold">AI Product Studio</span> : null}
          <IconButton aria-label="Свернуть боковую панель" variant="ghost" onClick={toggleSidebar}>
            <PanelLeft className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <nav className="flex flex-col gap-1">
          {visibleNavItems.map((item) => (
            <NavigationItem key={item.id} active={view === item.id} icon={item.icon} href={`/?view=${item.id}`}>
              {!sidebarCollapsed ? item.label : null}
            </NavigationItem>
          ))}
        </nav>
      </Sidebar>
      <div className="flex min-w-0 flex-col">
        <Header>
          <Breadcrumb className="min-w-0 flex-1">
            <span>{bundle.project?.name ?? "Нет продукта"}</span>
            <span>/</span>
            <span className="text-foreground">{viewTitles[view]}</span>
          </Breadcrumb>
          {bundle.project ? <Badge tone="info">{bundle.project.status}</Badge> : null}
          <IconButton aria-label="Назад" variant="ghost" onClick={() => goTo(previousView)}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Вперед" variant="ghost" onClick={() => goTo(nextView)}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton aria-label="Переключить тему" variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </IconButton>
          <Button variant="secondary" onClick={toggleAssistant}>Панель ИИ</Button>
        </Header>
        <div className="flex min-h-0 flex-1">
          <Workspace>
            {view === "projects" ? <ProjectsScreen /> : null}
            {view === "product" ? <ProductScreen /> : null}
            {view === "architecture" ? <ArchitectureScreen /> : null}
            {view === "pipeline" ? <PipelineScreen /> : null}
            {view === "playground" ? <PlaygroundScreen /> : null}
            {view === "inspector" ? <ExecutionInspectorScreen /> : null}
            {view === "prompts" ? <PromptInspectorScreen /> : null}
            {view === "analytics" ? <AnalyticsScreen /> : null}
            {view === "pipeline-lab-v3" ? <PipelineLabV3Screen /> : null}
            {view === "dashboard" ? <DashboardScreen /> : null}
            {view === "settings" ? <SettingsScreen /> : null}
          </Workspace>
          {assistantOpen ? (
            <Inspector className="p-4">
              <AIRecommendation>
                <p className="mb-2 text-sm font-medium">ИИ-ассистент</p>
                <p className="text-sm text-text-muted">
                  Текущий контекст: {viewTitles[view]}. Следующий шаг определяется правилами Orchestrator и текущими артефактами продукта.
                </p>
              </AIRecommendation>
            </Inspector>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function SettingsScreen() {
  const { reset } = useRepositoryStore();
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>
      <p className="max-w-2xl text-sm text-text-muted">MVP использует Local Storage Repository. Можно сбросить данные к Demo Project.</p>
      <Button className="w-fit" onClick={reset}>Сбросить Demo Repository</Button>

      <Card className="grid max-w-2xl gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Среда выполнения</h2>
          <Badge tone="neutral">Mock LLM Provider</Badge>
        </div>
        <p className="text-sm text-text-muted">
          Песочница, Golden Dataset Evaluation и Benchmark всегда выполняются реальным Pipeline Executor, но LLM-вызовы сейчас идут через Mock LLM Provider (без сети, без реальной модели) — поэтому оценки в Аналитике честно показывают низкий pass rate.
        </p>
        <p className="text-sm text-text-muted">
          Это не переключается конфигурацией в UI: `configureFromEnv()` (`src/shared/llm/provider-registry.ts`) умеет собрать реальный `OpenAiCompatibleProvider` из `OPENAI_API_KEY`, но каждый экран, вызывающий Runtime (Песочница, Аналитика), — клиентский компонент, а Next.js не пробрасывает серверные переменные окружения (без префикса `NEXT_PUBLIC_`) в клиентский бандл. Включить реальный provider сегодня означало бы либо публично раскрыть API-ключ в браузере (нарушает CLAUDE.md §49 SEC-1), либо перенести LLM-вызовы за серверный API route — этого пока нет в репозитории (§10 SB-1).
        </p>
      </Card>
    </div>
  );
}

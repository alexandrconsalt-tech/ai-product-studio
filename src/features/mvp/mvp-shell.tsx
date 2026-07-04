"use client";

import * as React from "react";
import { Bot, Boxes, BrainCircuit, ChevronLeft, ChevronRight, FlaskConical, FolderKanban, Microscope, Moon, PanelLeft, Play, ScrollText, Settings, Sun, LineChart } from "lucide-react";
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

const navItems: ReadonlyArray<{ id: MvpView; label: string; icon: React.ReactNode }> = [
  { id: "projects", label: "Projects", icon: <FolderKanban className="size-4" aria-hidden="true" /> },
  { id: "product", label: "Product", icon: <Boxes className="size-4" aria-hidden="true" /> },
  { id: "architecture", label: "Architecture", icon: <BrainCircuit className="size-4" aria-hidden="true" /> },
  { id: "pipeline", label: "Pipeline", icon: <Bot className="size-4" aria-hidden="true" /> },
  { id: "playground", label: "Playground", icon: <Play className="size-4" aria-hidden="true" /> },
  { id: "inspector", label: "Inspector", icon: <Microscope className="size-4" aria-hidden="true" /> },
  { id: "prompts", label: "Prompts", icon: <ScrollText className="size-4" aria-hidden="true" /> },
  { id: "analytics", label: "Analytics", icon: <LineChart className="size-4" aria-hidden="true" /> },
  { id: "pipeline-lab-v3", label: "Pipeline Lab v3", icon: <FlaskConical className="size-4" aria-hidden="true" /> },
  { id: "settings", label: "Settings", icon: <Settings className="size-4" aria-hidden="true" /> },
];

const viewTitles: Record<MvpView, string> = {
  projects: "Projects",
  product: "Product",
  architecture: "Architecture",
  pipeline: "Pipeline",
  playground: "Playground",
  inspector: "Execution Inspector",
  prompts: "Prompt Inspector",
  analytics: "Analytics",
  "pipeline-lab-v3": "Pipeline Lab v3",
  settings: "Settings",
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
    value === "settings"
  );
}

export function MvpShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: MvpView = isMvpView(requestedView) ? requestedView : "projects";
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
  const currentIndex = navItems.findIndex((item) => item.id === view);
  const previousView = navItems[Math.max(0, currentIndex - 1)]?.id ?? "projects";
  const nextView = navItems[Math.min(navItems.length - 1, currentIndex + 1)]?.id ?? "settings";

  return (
    <AppShell>
      <Sidebar collapsed={sidebarCollapsed} className="flex flex-col gap-3 p-2">
        <div className="flex h-10 items-center justify-between px-1">
          {!sidebarCollapsed ? <span className="text-sm font-semibold">AI Product Studio</span> : null}
          <IconButton aria-label="Свернуть Sidebar" variant="ghost" onClick={toggleSidebar}>
            <PanelLeft className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavigationItem key={item.id} active={view === item.id} icon={item.icon} href={`/?view=${item.id}`}>
              {!sidebarCollapsed ? item.label : null}
            </NavigationItem>
          ))}
        </nav>
      </Sidebar>
      <div className="flex min-w-0 flex-col">
        <Header>
          <Breadcrumb className="min-w-0 flex-1">
            <span>{bundle.project?.name ?? "No Project"}</span>
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
          <Button variant="secondary" onClick={toggleAssistant}>AI Panel</Button>
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
            {view === "settings" ? <SettingsScreen /> : null}
          </Workspace>
          {assistantOpen ? (
            <Inspector className="p-4">
              <AIRecommendation>
                <p className="mb-2 text-sm font-medium">AI Assistant</p>
                <p className="text-sm text-text-muted">
                  Текущий контекст: {viewTitles[view]}. Следующий шаг определяется Orchestrator gates и текущими artifacts проекта.
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
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="max-w-2xl text-sm text-text-muted">MVP использует Local Storage Repository. Можно сбросить данные к Demo Project.</p>
      <Button className="w-fit" onClick={reset}>Сбросить Demo Repository</Button>

      <Card className="grid max-w-2xl gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Runtime</h2>
          <Badge tone="neutral">Mock LLM Provider</Badge>
        </div>
        <p className="text-sm text-text-muted">
          Playground, Golden Dataset Evaluation и Benchmark всегда выполняются реальным Pipeline Executor, но LLM-вызовы сейчас идут через Mock LLM Provider (без сети, без реальной модели) — поэтому оценки в Analytics честно показывают низкий pass rate.
        </p>
        <p className="text-sm text-text-muted">
          Это не переключается конфигурацией в UI: `configureFromEnv()` (`src/shared/llm/provider-registry.ts`) умеет собрать реальный `OpenAiCompatibleProvider` из `OPENAI_API_KEY`, но каждый экран, вызывающий Runtime (Playground, Analytics), — клиентский компонент, а Next.js не пробрасывает серверные переменные окружения (без префикса `NEXT_PUBLIC_`) в клиентский бандл. Включить реальный provider сегодня означало бы либо публично раскрыть API-ключ в браузере (нарушает CLAUDE.md §49 SEC-1), либо перенести LLM-вызовы за серверный API route — этого пока нет в репозитории (§10 SB-1).
        </p>
      </Card>
    </div>
  );
}

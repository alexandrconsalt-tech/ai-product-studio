"use client";

import * as React from "react";
import { BarChart3, Bot, Boxes, BrainCircuit, ChevronLeft, ChevronRight, ClipboardCheck, FlaskConical, FolderKanban, LayoutDashboard, Microscope, Moon, PanelLeft, Play, ScrollText, Settings, Sun, LineChart } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, Header, NavigationItem, Sidebar, Workspace, IconButton, Badge, Breadcrumb } from "@/shared/ui";
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
import { SettingsScreen } from "./screens/settings-screen";
import { SummaryReviewScreen } from "./screens/summary-review-screen";
import { SummaryReportScreen } from "./screens/summary-report-screen";

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
  { id: "summary-review", label: "Оценка Summary", icon: <ClipboardCheck className="size-4" aria-hidden="true" /> },
  { id: "summary-report", label: "Отчёт Summary", icon: <BarChart3 className="size-4" aria-hidden="true" /> },
  { id: "inspector", label: "Инспектор", icon: <Microscope className="size-4" aria-hidden="true" /> },
  { id: "prompts", label: "Промпты", icon: <ScrollText className="size-4" aria-hidden="true" /> },
  { id: "analytics", label: "Аналитика", icon: <LineChart className="size-4" aria-hidden="true" /> },
  { id: "pipeline-lab-v3", label: "Pipeline Lab v3", icon: <FlaskConical className="size-4" aria-hidden="true" /> },
  { id: "dashboard", label: "Дашборд", icon: <LayoutDashboard className="size-4" aria-hidden="true" /> },
  { id: "settings", label: "Настройки", icon: <Settings className="size-4" aria-hidden="true" /> },
];

// AI Product Studio v2: only these four sections are visible navigation
// (Product -> Playground -> Dashboard, plus Settings for the shared
// API keys). Everything else above stays reachable by URL only
// (Projects, Architecture, Pipeline, Inspector, Prompts, Analytics,
// Pipeline Lab v3 standalone).
const VISIBLE_VIEW_IDS: ReadonlySet<MvpView> = new Set<MvpView>(["product", "playground", "summary-review", "summary-report", "dashboard", "settings"]);
const visibleNavItems = navItems.filter((item) => VISIBLE_VIEW_IDS.has(item.id));

const viewTitles: Record<MvpView, string> = {
  projects: "Проекты",
  product: "Продукт",
  architecture: "Архитектура",
  pipeline: "Пайплайн",
  playground: "Песочница",
  "summary-review": "Оценка качества Summary",
  "summary-report": "Отчёт по оценке",
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
    value === "summary-review" ||
    value === "summary-report" ||
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
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUiStore();

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
        </Header>
        <div className="flex min-h-0 flex-1">
          <Workspace>
            {view === "projects" ? <ProjectsScreen /> : null}
            {view === "product" ? <ProductScreen /> : null}
            {view === "architecture" ? <ArchitectureScreen /> : null}
            {view === "pipeline" ? <PipelineScreen /> : null}
            {view === "playground" ? <PlaygroundScreen /> : null}
            {view === "summary-review" ? <SummaryReviewScreen /> : null}
            {view === "summary-report" ? <SummaryReportScreen /> : null}
            {view === "inspector" ? <ExecutionInspectorScreen /> : null}
            {view === "prompts" ? <PromptInspectorScreen /> : null}
            {view === "analytics" ? <AnalyticsScreen /> : null}
            {view === "pipeline-lab-v3" ? <PipelineLabV3Screen /> : null}
            {view === "dashboard" ? <DashboardScreen /> : null}
            {view === "settings" ? <SettingsScreen /> : null}
          </Workspace>
        </div>
      </div>
    </AppShell>
  );
}

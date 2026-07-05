# Component Library

## Layout

- AppShell
- Sidebar
- Header
- Workspace
- Panel
- Inspector
- SplitView
- ResizablePanel
- Toolbar
- Section
- Page

## Navigation

- NavigationItem
- Breadcrumb
- Tabs
- Tab
- CommandPalette
- Search
- ContextMenu
- Dropdown

## Form

- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Button
- IconButton
- SegmentedControl
- Slider

## Feedback

- Badge
- Status
- Alert
- Toast
- Progress
- Skeleton
- EmptyState
- Loading
- ErrorState

## Containers

- Card
- Accordion
- Dialog
- Drawer
- Popover
- Tooltip
- Sheet

## AI Components

- AIResponse
- AIMessage
- AIThinking
- AIStatus
- AIRecommendation
- AIExplanation
- AIConfidence
- FrameworkBadge
- KnowledgeBadge

## Pipeline Components

- NodeCard
- ConnectionHandle
- PropertyPanel
- CanvasToolbar
- MiniMap
- ZoomControls
- ExecutionStatus
- ValidationBadge

## Chart Components (добавлено 2026-07-05, AI Product Studio v2 -- `src/shared/ui/charts.tsx`)

- LineChart -- inline SVG value-over-time line, `points: {label, value}[]`, `stroke` CSS color, `formatValue` for the aria-label. No charting dependency added (repo's dependency set is deliberately small).
- Sparkline -- thin wrapper over LineChart for a bare `number[]`.

Used by Dashboard for Accuracy/Cost/Speed/Confidence-over-time. Honest empty state ("Нет данных") when `points` is empty, never a fabricated flat line.

## Component Rules

Каждый компонент должен иметь:

- назначение;
- typed props;
- states;
- variants, если нужны;
- accessibility behavior;
- keyboard support;
- ограничения.

Shared UI компоненты не знают о Project, Product, Pipeline lifecycle и Orchestrator decisions.


# Global Layout

## Назначение

Документ описывает общий layout AI Product Studio.

## Layout Structure

```text
Sidebar | Main Area
          ├── Header
          └── Workspace | Right AI Assistant Panel
```

## Sidebar

Width:

- expanded: 248 px;
- collapsed: 64 px.

Behavior:

- collapsible;
- persistent across sessions;
- keyboard navigable;
- не содержит вложенных деревьев на MVP.

## Header

Height: 56 px.

Content:

- breadcrumb;
- project status;
- gate status;
- primary action;
- secondary actions menu.

Behavior:

- sticky внутри main area;
- не должен занимать роль dashboard;
- primary action зависит от текущего screen и lifecycle.

## Workspace

Workspace занимает всю доступную ширину.

Минимальные отступы:

- desktop: 24 px;
- dense tool screens: 16 px;
- canvas screens: 0-12 px в зависимости от toolbar.

Behavior:

- Product и Architecture используют split/tabs;
- Pipeline использует canvas-first layout;
- Playground использует split input/output layout.

## Right AI Assistant Panel

Optional.

Default width: 360 px.

Min width: 320 px.

Max width: 520 px.

Behavior:

- collapsible;
- resizable;
- context-aware;
- не открывается автоматически поверх workspace;
- показывает questions, explanations, next actions, review issues.

## Responsive Behavior

MVP target: desktop-first.

Minimum supported width: 1280 px.

При меньшей ширине:

- sidebar collapses;
- right panel hidden by default;
- workspace сохраняет primary flow.

## Resize Rules

- Sidebar: fixed expanded/collapsed.
- Right panel: user-resizable.
- Split views: resizable с min width для обеих частей.
- Canvas: занимает всё доступное пространство.


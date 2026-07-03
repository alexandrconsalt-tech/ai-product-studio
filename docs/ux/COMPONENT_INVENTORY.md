# Component Inventory

## Назначение

Документ описывает будущий component inventory AI Product Studio без реализации компонентов.

Компоненты должны быть построены после UX specification и Domain Model.

## Components

### Page

Назначение: верхний контейнер screen.

Используется: Projects, Product, Architecture, Pipeline, Playground, Settings.

Требования: управляет page-level spacing, header relation и loading/error states.

### Section

Назначение: логический блок внутри workspace.

Требования: имеет title, optional description, actions, content.

### Panel

Назначение: боковая или внутренняя область для secondary context.

Варианты: Right AI Assistant Panel, Property Panel, Review Panel.

### Sidebar

Назначение: глобальная navigation.

Содержит только: Projects, Product, Architecture, Pipeline, Playground, Settings.

### Toolbar

Назначение: команды workspace.

Используется: Pipeline, Playground, document-like workspaces.

### Canvas

Назначение: визуальная рабочая область Pipeline.

Не должен зависеть напрямую от Domain Model implementation details. UI adapter преобразует `Pipeline`, `Node`, `Edge` в render model.

### Property Panel

Назначение: редактирование selected entity.

Используется: Node, Edge, Pipeline settings.

### Node

Назначение: визуальное представление доменной сущности `Node`.

Типы: Agent, LLM, Function, Router, Tool, Store, Validation, Human Review, Input, Output.

### Card

Назначение: compact summary entity.

Используется: Project card, review issue, model summary.

Не использовать cards для всего layout.

### Dialog

Назначение: modal flow для focused action.

Используется: create Project, archive confirmation, duplicate Project.

### Tabs

Назначение: переключение между разделами одного workspace.

Используется: Product, Architecture, Playground.

### Status

Назначение: показать lifecycle state.

Примеры: draft, ready, review, blocked, completed.

### Badge

Назначение: компактный semantic marker.

Примеры: AI, Review, Blocking, Cost, Latency.

### Search

Назначение: поиск по текущему scope.

Используется: Projects, Frameworks, Models, Runs.

### Breadcrumb

Назначение: показать location внутри Project.

Пример: Project / Product / PRD.

### Command Palette

Назначение: keyboard-first глобальные действия.

Команды: navigation, create Project, next action, review issues, search.

### Split View

Назначение: две рабочие области с resizable divider.

Используется: Playground input/output, Product editor/review, Architecture overview/details.

## Общие состояния компонентов

Каждый interactive component должен учитывать:

- default;
- hover;
- focus;
- active;
- disabled;
- loading;
- error;
- empty;
- readonly.

## Accessibility

Требования:

- keyboard focus visible;
- buttons have accessible names;
- icons need tooltips or labels;
- color is not the only status signal;
- dialogs trap focus.

## Domain Alignment

Компоненты не создают собственные сущности.

UI components отображают или редактируют:

- `Project`;
- `Product`;
- `Architecture`;
- `Pipeline`;
- `Node`;
- `Edge`;
- `Run`;
- `Review`;
- `Prompt`;
- `Framework`;
- `KnowledgeModule`;
- `Model`.

## Запрещено

- добавлять business logic в UI component;
- хранить Project lifecycle в component local state как источник правды;
- использовать React Flow model как Domain Model;
- создавать новый component type без обновления inventory, если он становится reusable.


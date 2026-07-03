# Pipeline Workspace

## Назначение

Pipeline workspace показывает и редактирует Visual Pipeline на основе Architecture.

Это canvas-first рабочая область, но доменная модель не зависит от React Flow.

## Layout

```text
Toolbar
Canvas | Property Panel
Mini Map
```

## Canvas

Цель: визуально представить Pipeline nodes и edges.

Поведение:

- pan;
- zoom;
- select node/edge;
- multi-select;
- keyboard navigation;
- snap optional.

Состояния:

- empty pipeline;
- generated draft;
- validation errors;
- ready for review.

## Типы Node

- Agent
- LLM
- Function
- Router
- Tool
- Store
- Validation
- Human Review
- Input
- Output

Каждый Node должен показывать:

- type icon;
- name;
- status;
- validation state;
- optional model/prompt indicator.

## Property Panel

Цель: редактировать selected Node или Edge.

Содержит:

- name;
- type;
- description;
- input ports;
- output ports;
- validation;
- retry/fallback;
- telemetry.

Behavior:

- открывается при выборе Node/Edge;
- collapsible;
- не перекрывает canvas.

## Mini Map

Цель: навигация по большому Pipeline.

Behavior:

- visible by default for large canvas;
- collapsible;
- не содержит редактирования.

## Toolbar

Команды:

- add node;
- validate pipeline;
- zoom in;
- zoom out;
- fit view;
- undo;
- redo;
- run in Playground, если gate доступен.

## Context Menu

Для Node:

- duplicate;
- delete;
- connect;
- open properties.

Для Edge:

- delete;
- edit condition.

Для Canvas:

- add node;
- paste;
- fit view.

## Undo / Redo

MVP behavior:

- undo/redo действует на pipeline editing actions;
- не распространяется на Project lifecycle transitions;
- history scoped to current Pipeline session.

## Ошибки

- orphan node;
- invalid edge;
- missing input/output;
- no fallback for critical node;
- validation node missing after AI output;
- circular dependency.

## Связь с Domain Model

Использует:

- `Pipeline`;
- `Node`;
- `Edge`;
- `Architecture`;
- `Review`.


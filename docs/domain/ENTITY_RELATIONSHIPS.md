# Entity Relationships

## Назначение

Документ описывает связи между доменными сущностями AI Product Studio.

## Relationship Map

```text
Project
  ├── productId -> Product
  ├── architectureId -> Architecture
  ├── pipelineId -> Pipeline
  ├── playgroundRunIds -> Run[]
  └── reviewIds -> Review[]

Product
  ├── projectId -> Project
  └── frameworkIds -> Framework[]

Architecture
  ├── projectId -> Project
  ├── productId -> Product
  └── modelIds -> Model[]

Pipeline
  ├── projectId -> Project
  ├── architectureId -> Architecture
  ├── nodes -> Node[]
  └── edges -> Edge[]

Run
  └── pipelineId -> Pipeline

Review
  ├── targetId -> Product | Architecture | Pipeline | Run | Project | Prompt
  └── reviewerModuleId -> KnowledgeModule

Prompt
  └── ownerModuleId -> KnowledgeModule

KnowledgeModule
  └── frameworkIds -> Framework[]
```

## Вложенные сущности

Вложенными являются:

- Node внутри Pipeline;
- Edge внутри Pipeline;
- Product value objects: Idea, Problem, Users, JTBD, Features, Metrics;
- Architecture value objects: Capabilities, AI Components, Data Flow, Quality, Evaluation;
- Run metrics и logs;
- Review issues.

## Ссылочные сущности

Ссылками являются:

- Project -> Product;
- Project -> Architecture;
- Project -> Pipeline;
- Project -> Run;
- Project -> Review;
- Product -> Framework;
- Architecture -> Model;
- Review -> KnowledgeModule;
- Prompt -> KnowledgeModule.

## Правила

- Если сущность имеет независимый lifecycle, она хранится отдельно.
- Если объект не имеет самостоятельного lifecycle, он встраивается как value object.
- UI не должен создавать собственную модель связей.
- React Flow graph должен адаптироваться из Pipeline, Node и Edge, а не наоборот.

## PlaygroundTestRun (добавлено 2026-07-05, AI Product Studio v2)

`PlaygroundTestRun` -- новая сущность, не входящая в `RepositorySnapshot`. Ссылается
на `Project.id` (`projectId`) однонаправленно, без обратного массива на `Project`
(в отличие от `Run`, у которого есть `Project.playgroundRunIds`). Причина: она
не создаётся мутацией внутри React-дерева приложения, а приходит через
`postMessage` от `public/pipeline-lab-v3.html`, поэтому хранится отдельно, в
`usePlaygroundTestRunStore` (localStorage, см. DDD README сущности). Dashboard
читает историю именно через `projectId`, так же как `getProjectBundle` везде
использует `selectedProjectId`.


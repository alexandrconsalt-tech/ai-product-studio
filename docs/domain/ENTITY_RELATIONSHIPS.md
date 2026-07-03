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
  ├── targetId -> Product | Architecture | Pipeline | Run | Project
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


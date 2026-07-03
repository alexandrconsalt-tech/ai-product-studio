# Entity Lifecycle

## Назначение

Документ описывает жизненный цикл основных сущностей.

## Project

```text
draft -> discovery -> product_ready -> architecture_ready -> pipeline_ready -> testing -> completed -> archived
```

## Product

```text
draft -> in_progress -> review -> ready -> completed -> archived
```

## Architecture

```text
draft -> in_progress -> review -> ready -> completed -> archived
```

## Pipeline

```text
draft -> in_progress -> review -> ready -> completed -> archived
```

## Run

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
```

## Review

```text
not_reviewed -> approved
not_reviewed -> requires_changes
not_reviewed -> rejected
requires_changes -> approved
```

## KnowledgeModule, Framework, Prompt, Model

Эти сущности имеют version lifecycle:

```text
created -> versioned -> deprecated
```

В текущей MVP-модели статус deprecated не добавлен в типы, чтобы не усложнять Domain Layer до появления реального требования.

## Правила переходов

- Project не переходит в `architecture_ready` без Product.
- Project не переходит в `pipeline_ready` без Architecture.
- Project не переходит в `testing` без Pipeline.
- Run не может быть `succeeded` и `failed` одновременно.
- Review score не управляет lifecycle напрямую; решение принимает Orchestrator через Quality Gates.


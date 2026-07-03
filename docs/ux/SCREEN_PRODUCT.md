# Product Workspace

## Назначение

Product workspace помогает пройти путь от Idea до PRD и Product Review.

Разделы:

1. Idea
2. Discovery
3. Frameworks
4. PRD
5. Review
6. History

## Общий User Flow

```text
Idea -> Discovery -> Frameworks -> PRD -> Review -> Product Complete
```

## Idea

Цель: зафиксировать исходную идею и превратить ее в product problem hypothesis.

Основной сценарий:

- пользователь вводит idea;
- AI Assistant задает уточняющие questions;
- Orchestrator определяет readiness for Discovery.

Компоненты:

- Section;
- text editor;
- assumptions panel;
- primary action;
- AI questions panel.

Состояния:

- empty idea;
- draft;
- questions required;
- ready for discovery.

Ошибки:

- idea слишком общая;
- отсутствует target user;
- idea описывает technology, но не problem.

Действия:

- сохранить idea;
- ответить на questions;
- перейти к Discovery.

## Discovery

Цель: собрать и структурировать evidence, problem, users, JTBD.

Основной сценарий:

- пользователь добавляет discovery inputs;
- AI применяет Senior Product Manager Knowledge System;
- формируется Product Analysis.

Компоненты:

- evidence list;
- problem statement panel;
- users section;
- JTBD section;
- opportunity notes.

Состояния:

- no evidence;
- evidence gap;
- in progress;
- ready for PRD.

Ошибки:

- evidence contradicts problem;
- users undefined;
- assumptions presented as facts.

Действия:

- добавить evidence;
- уточнить users;
- сформировать Product Analysis.

## Frameworks

Цель: показать, какие frameworks используются и почему.

Основной сценарий:

- Orchestrator показывает selected frameworks;
- пользователь видит rationale;
- пользователь может открыть details.

Компоненты:

- framework list;
- rationale panel;
- source links;
- applicability status.

Состояния:

- no framework selected;
- selected;
- framework conflict warning.

Ошибки:

- framework не подходит к task;
- слишком много frameworks.

Действия:

- просмотреть rationale;
- принять selection;
- запросить пересмотр.

## PRD

Цель: сформировать PRD на основе validated Product Analysis.

Основной сценарий:

- пользователь проверяет PRD sections;
- AI заполняет structured artifact;
- Orchestrator проверяет completeness.

Компоненты:

- PRD outline;
- requirements table;
- metrics section;
- open questions;
- non-goals;
- linked evidence.

Состояния:

- draft;
- incomplete;
- ready for review;
- locked after approval.

Ошибки:

- requirements не связаны с evidence;
- metrics missing;
- AI capabilities not justified.

Действия:

- сгенерировать PRD draft;
- отредактировать section;
- отправить на Review.

## Review

Цель: проверить качество Product artifact.

Основной сценарий:

- Reviewer оценивает Product;
- пользователь видит score, blocking issues, required changes;
- при score >= 85 gate проходит.

Компоненты:

- score panel;
- issue list;
- gate status;
- required changes;
- review history.

Состояния:

- not reviewed;
- reviewing;
- approved;
- requires changes;
- rejected.

Ошибки:

- Product Review failed;
- missing required artifact;
- unresolved blocking issue.

Действия:

- запустить Review;
- исправить issues;
- перейти к Architecture.

## History

Цель: показать изменения Product artifact.

Компоненты:

- timeline;
- artifact versions;
- review entries;
- decision records.

Действия:

- открыть версию;
- сравнить версии;
- восстановление версии не входит в MVP.

## Связь с Domain Model

Использует:

- `Product`;
- `Framework`;
- `KnowledgeModule`;
- `Review`;
- `Project`.


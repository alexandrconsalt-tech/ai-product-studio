# Architecture Workspace

## Назначение

Architecture workspace преобразует Product artifacts в production-ready AI Architecture.

Разделы:

1. Overview
2. Capabilities
3. AI Components
4. Models
5. Data Flow
6. Evaluation
7. Review

## Overview

Цель: показать architecture summary, AI necessity decision и next action.

Компоненты:

- architecture status;
- AI necessity decision;
- selected architecture pattern;
- quality gates;
- primary action.

Состояния:

- waiting for Product Complete;
- draft;
- ready for review;
- approved.

Ошибки:

- Product artifact missing;
- Product Review score ниже порога;
- AI Readiness Low.

## Capabilities

Цель: показать AI Capabilities и non-AI boundaries.

Компоненты:

- capability list;
- required/not required marker;
- rationale;
- linked product requirement.

Ошибки:

- capability не связана с PRD;
- AI используется без необходимости.

## AI Components

Цель: описать architecture components.

Компоненты:

- component list;
- component type;
- responsibility;
- input/output summary;
- failure mode.

Состояния:

- no components;
- incomplete component;
- validated components.

## Models

Цель: показать model selection и trade-offs.

Компоненты:

- model list;
- model capability tags;
- cost/latency/quality indicators;
- fallback model;
- routing rationale.

Ошибки:

- model selected without evaluation;
- large model used without justification;
- no fallback for critical step.

## Data Flow

Цель: описать движение данных.

Компоненты:

- data flow table;
- source;
- target;
- data type;
- retention;
- access notes.

Ошибки:

- sensitive data without policy;
- no lineage;
- missing evaluation data.

## Evaluation

Цель: показать quality и evaluation plan.

Компоненты:

- metrics;
- thresholds;
- eval dataset requirements;
- regression policy;
- human review triggers.

Ошибки:

- no evaluation strategy;
- thresholds undefined;
- no failure taxonomy.

## Review

Цель: проверить architecture production readiness.

Основной сценарий:

- Reviewer оценивает Architecture;
- score >= 90 открывает Pipeline;
- issues возвращают пользователя к нужному section.

Компоненты:

- score;
- criteria breakdown;
- blocking issues;
- required changes;
- transition status.

## Связь с Domain Model

Использует:

- `Architecture`;
- `Product`;
- `Model`;
- `Review`;
- `KnowledgeModule`.


# MODULES.md

## Назначение

Документ описывает контракт взаимодействия между Orchestrator и интеллектуальными модулями.

## Module Contract Format

Каждый модуль имеет:

- Input;
- Output;
- Preconditions;
- Postconditions;
- Validation Rules;
- Failure Modes.

## `senior-product-manager`

Ответственность: Idea Analysis, Discovery, Product Design, PRD, AI Capabilities, Product Review input preparation.

Input:

- idea;
- user answers;
- constraints;
- existing evidence;
- previous review issues.

Output:

- Idea Analysis;
- Product Analysis;
- PRD;
- AI Capabilities;
- Architecture Brief;
- Product Review-ready artifact.

Preconditions:

- project exists;
- idea statement exists;
- current state: `draft`, `idea_analyzed`, `discovery`, `product_design`.

Postconditions:

- Product artifacts versioned;
- assumptions separated from facts;
- required open questions listed.

Validation Rules:

- PRD has problem, goals, non-goals, requirements, success metrics;
- AI Capabilities are justified;
- Product artifacts follow Senior Product Manager Knowledge System.

Failure Modes:

- insufficient data;
- contradictory product requirements;
- weak evidence;
- AI capability not justified.

## `senior-ai-solution-architect`

Ответственность: AI Architecture, Model Selection, Data Architecture, Quality Layer, Evaluation Strategy.

Input:

- PRD;
- Product Analysis;
- AI Capabilities;
- Product Review;
- Architecture Brief;
- constraints.

Output:

- Architecture Decision;
- AI Necessity Decision;
- AI Pattern Selection;
- Model Selection;
- Pipeline Requirements;
- Data Architecture;
- Evaluation Strategy.

Preconditions:

- Product Review score >= 85;
- Product Complete gate passed;
- AI Readiness is not Low.

Postconditions:

- Architecture artifacts versioned;
- AI/non-AI boundaries explicit;
- Evaluation Strategy defined.

Validation Rules:

- Architecture follows Senior AI Solution Architect Knowledge System;
- every AI step has evaluation;
- every critical step has fallback;
- model selection has rationale.

Failure Modes:

- insufficient PRD detail;
- AI Readiness Low;
- architecture constraints missing;
- product assumptions block architecture.

## `pipeline-builder`

Ответственность: Pipeline Specification и Visual Pipeline model.

Input:

- Architecture Decision;
- Pipeline Requirements;
- Model Selection;
- Data Architecture;
- Quality Layer;
- Evaluation Strategy.

Output:

- Pipeline Specification;
- pipeline nodes;
- pipeline edges;
- validation rules;
- runtime configuration draft.

Preconditions:

- Architecture Review score >= 90;
- Architecture Complete gate passed.

Postconditions:

- every node has input/output contract;
- edges define data/control flow;
- validation and fallback paths exist.

Validation Rules:

- no orphan nodes;
- all required architecture steps represented;
- every AI node has quality check;
- state and telemetry defined.

Failure Modes:

- architecture artifact incomplete;
- unsupported pattern;
- missing data contract;
- pipeline validation failed.

## `reviewer`

Ответственность: independent quality review для Product, Architecture, Pipeline и Final readiness.

Input:

- artifact under review;
- relevant context;
- applicable Quality Gate;
- scoring rubric;
- previous review issues.

Output:

- review score;
- status;
- blocking issues;
- required changes;
- recommendations;
- approval decision.

Preconditions:

- artifact exists;
- applicable rubric exists;
- artifact has version.

Postconditions:

- review result stored;
- blocking issues linked to source artifact;
- next transition recommendation produced.

Validation Rules:

- Product Review uses Senior Product Manager Knowledge System;
- Architecture Review uses Senior AI Solution Architect Knowledge System;
- Pipeline Review uses Pipeline Gate criteria;
- Final Review uses all artifacts.

Failure Modes:

- artifact incomplete;
- rubric missing;
- score below threshold;
- unresolved contradiction.

## `orchestrator`

Ответственность: module routing, state transitions, context passing, gates, error handling.

Input:

- current Context Object;
- module output;
- user input;
- gate results.

Output:

- next state;
- next module;
- transition reason;
- user questions;
- orchestration decision.

Preconditions:

- project exists;
- current state valid.

Postconditions:

- state transition recorded;
- context updated;
- next action defined.

Validation Rules:

- transition allowed by `STATE_MACHINE.md`;
- gate passed before forward transition;
- errors handled through `ERROR_HANDLING.md`.

Failure Modes:

- invalid transition;
- missing required artifact;
- cyclic return loop;
- module unavailable.

## Взаимосвязь

- Context rules: `CONTEXT.md`.
- State transitions: `STATE_MACHINE.md`.
- Decision rules: `DECISION_ENGINE.md`.
- Quality Gates: `QUALITY_GATES.md`.

## Критерии качества

- Каждый модуль имеет Input, Output, Preconditions, Postconditions, Validation Rules и Failure Modes.
- Нет дублирования ответственности между модулями.
- Orchestrator координирует, но не создает domain artifacts вместо модулей.
- Module output можно проверить Quality Gate или Review.

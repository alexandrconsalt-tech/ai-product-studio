# RULES.md

## Назначение

Документ задает нормативные правила работы Knowledge System. Эти правила обязательны для человека и AI-модулей.

## Ответственность

RULES отвечает за:

- Single Source of Truth;
- Separation of Concerns;
- AI-readability;
- decision integrity;
- quality gates;
- запрет недопустимых практик.

## Нормативные правила

### R-001. Single Source of Truth

Каждый framework определяется только в `FRAMEWORKS.md`.

Почему: дублирование приводит к расхождениям между AI-модулями.

Когда применяется: всегда.

### R-002. No Framework Invention

Запрещено создавать внутренний framework, если существует признанный industry framework.

Почему: продукт должен опираться на мировые практики.

Когда применяется: при добавлении новых методов.

### R-003. Evidence Before PRD

PRD нельзя создавать как финальный артефакт без Product Discovery evidence.

Почему: PRD без discovery фиксирует assumptions как requirements.

Когда применяется: перед этапом `prd-creation`.

### R-004. AI Justification Required

Любая AI capability должна иметь обоснование, почему AI лучше non-AI alternative.

Почему: AI добавляет uncertainty, cost, latency и governance.

Когда применяется: для всех AI features.

### R-005. Evaluation Before Playground

Playground не создается без evaluation strategy.

Почему: без evaluation невозможно понять, работает ли AI Pipeline.

Когда применяется: перед Playground.

### R-006. Human Oversight for High Risk

High-risk AI outputs требуют `human-in-the-loop`.

Почему: automation без oversight может привести к harmful decisions.

Когда применяется: для safety-sensitive и business-critical workflows.

### R-007. Traceability

Каждое requirement должно быть связано с problem, evidence и success metric.

Почему: traceability предотвращает scope drift.

Когда применяется: в PRD и AI Architecture input.

### R-008. Decision Records

Каждое significant decision фиксируется в `DECISION_RECORDS.md` format.

Почему: долгосрочное сопровождение требует rationale и history.

Когда применяется: при изменении scope, priority, architecture direction, model strategy, release gate.

### R-009. Russian by Default

Все человеко-читаемые формулировки пишутся на русском языке, кроме профессиональных терминов и аббревиатур.

Почему: продукт создается для русскоязычного рабочего контекста.

Когда применяется: во всех UI, docs и knowledge artifacts.

### R-010. No Mock Knowledge

Запрещены фиктивные данные, вымышленные evidence и placeholder conclusions.

Почему: Knowledge System должна быть пригодна для реальных decisions.

Когда применяется: всегда.

## Взаимосвязь с другими документами

- `FRAMEWORKS.md` реализует R-001.
- `PROCESS.md` реализует R-003, R-004, R-005.
- `DECISION_ENGINE.md` реализует R-007 и R-008.
- `REVIEW.md` проверяет соблюдение всех правил.

## Обязательные разделы для новых правил

- Rule ID
- Rule statement
- Why
- When applied
- Enforcement method
- Related documents

## Рекомендации

- Добавлять правила только при повторяющемся риске.
- Формулировать правила так, чтобы AI мог проверить compliance.
- Не смешивать rule и recommendation.

## Пример

Если AI-модуль предлагает сразу Visual Pipeline без PRD и evaluation strategy, он нарушает R-003 и R-005.

## Критерии качества

- Правило проверяемо.
- Правило не дублирует другое правило.
- Есть объяснение why и when.

## Ссылки на framework

`prd`, `customer-discovery`, `ai-readiness-assessment`, `evaluation-strategy`, `human-in-the-loop`, `safety`.


# CHECKLIST.md

## Назначение

Документ задает Definition of Ready и Definition of Done для продуктовых артефактов AI Product Studio.

## Ответственность

CHECKLIST отвечает за:

- readiness gates;
- completion gates;
- blocking issues;
- minimum quality bar.

## Definition of Ready

Артефакт готов к следующему этапу, если:

- problem statement сформулирован;
- customer segment определен;
- selected framework указаны через `framework_id`;
- evidence или evidence gap явно зафиксированы;
- assumptions отделены от facts;
- risks определены;
- next actions понятны;
- owner и decision scope указаны.

## Definition of Ready для PRD

PRD готов к работе, если:

- есть validated или explicitly bounded problem;
- goals и non-goals указаны;
- requirements связаны с evidence;
- success metrics определены;
- dependencies и constraints указаны;
- AI considerations заполнены, если есть AI capability;
- open questions не блокируют core scope.

## Definition of Ready для AI Architecture

AI Architecture input готов, если:

- AI capability map определена;
- data и context sources указаны;
- expected output schema определена;
- evaluation strategy задана;
- hallucination risk оценен;
- safety risk оценен;
- human-in-the-loop policy определена при необходимости;
- cost, quality, latency targets указаны.

## Definition of Done

Работа считается завершенной, если:

- output соответствует `OUTPUT_SCHEMA.md`;
- все blocking issues решены;
- decision зафиксирован;
- review status: `approved`;
- next actions имеют owner или rationale why owner is not assigned;
- нет нарушений `RULES.md`.

## Взаимосвязь с другими документами

- `PROCESS.md` вызывает checklist на gates.
- `OUTPUT_SCHEMA.md` задает required fields.
- `REVIEW.md` использует checklist как вход.
- `RULES.md` задает mandatory constraints.

## Обязательные разделы checklist item

- item;
- applies_to;
- pass_condition;
- fail_condition;
- severity.

## Рекомендации

- Blocking item должен быть бинарно проверяемым.
- Не смешивать quality recommendation и gate requirement.
- Для AI work всегда проверять evaluation и safety до launch.

## Пример

Checklist item: "Every AI output has evaluation criteria".

Pass condition: в artifact есть metrics, thresholds и evaluation dataset или план его создания.

Fail condition: AI output описан, но критерии качества отсутствуют.

Severity: blocking.

## Критерии качества

- Checklist предотвращает переход незрелых артефактов дальше.
- Items не дублируют друг друга.
- Gate conditions проверяемы AI.

## Ссылки на framework

`prd`, `customer-discovery`, `evaluation-strategy`, `ai-readiness-assessment`, `human-in-the-loop`, `safety`.


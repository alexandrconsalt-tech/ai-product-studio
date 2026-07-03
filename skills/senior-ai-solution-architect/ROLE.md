# ROLE.md

## Назначение

Документ описывает роль Principal AI Solution Architect в AI Product Studio.

## Ответственность

Principal AI Solution Architect отвечает за:

- преобразование PRD в AI Architecture;
- проверку необходимости AI;
- decomposition AI Capabilities;
- selection architecture pattern;
- model selection и model routing;
- pipeline, data flow, quality layer и evaluation design;
- runtime reliability, observability, security и cost;
- architecture review.

Роль не подменяет:

- Product Manager в выборе customer problem и product outcome;
- ML Researcher в разработке новых models;
- Security/Legal в финальном compliance approval;
- Pipeline Engineer в реализации production code.

## Структура компетенций

| Компетенция | Ожидаемый уровень |
|---|---|
| AI System Design | Проектирует modular, reliable и scalable AI systems |
| LLM Architecture | Понимает RAG, tools, structured outputs, agents, routing |
| Evaluation | Проектирует offline, online и human evaluation |
| Cost Engineering | Управляет unit economics AI Pipeline |
| Reliability | Проектирует retry, fallback, idempotency, observability |
| Safety | Встраивает guardrails, human review и risk controls |
| Product Alignment | Связывает architecture с PRD и success metrics |

## Взаимосвязь с другими документами

- `PROCESS.md` задает workflow.
- `ARCHITECTURE_PATTERNS.md` и `AI_PATTERNS.md` задают pattern library.
- `MODEL_SELECTION.md` выбирает models.
- `DECISION_ENGINE.md` фиксирует trade-offs.
- `REVIEW.md` оценивает architecture quality.

## Обязательные разделы роли в output

- architecture context;
- AI necessity decision;
- selected patterns;
- model strategy;
- pipeline design;
- data architecture;
- quality and evaluation;
- runtime requirements;
- risks;
- review status.

## Рекомендации

- Начинать с "AI нужен или нет", а не с выбора model.
- Сравнивать Rules Engine, Workflow, LLM и Agent.
- Для production избегать agentic complexity без clear need.
- Каждый компонент проектировать с input, output, owner, failure mode.

## Пример

Если PRD требует "автоматически назначать приоритет тикета", архитектор сначала проверяет: можно ли сделать rule-based scoring. LLM используется только если входы неструктурированы, язык вариативен или требуется semantic reasoning.

## Критерии качества

- Архитектура минимально достаточна.
- AI применяется только там, где дает measurable value.
- Quality и cost проверяемы.
- Runtime имеет fallback, monitoring и review path.

## Ссылки на используемые практики

NIST AI RMF, Well-Architected reliability/cost principles, LLM System Design, Human-in-the-loop, AI Evaluation.


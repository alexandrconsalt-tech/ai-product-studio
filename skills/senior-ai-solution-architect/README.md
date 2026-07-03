# Senior AI Solution Architect Knowledge System v1.0

## Назначение

`senior-ai-solution-architect` — Enterprise Knowledge System для преобразования PRD, Product Analysis, AI Capabilities, Product Review и Architecture Brief в промышленную AI Architecture.

Модуль не является prompt, AI Agent или генератором схем. Это инженерная система знаний, которая определяет, где AI нужен, где AI не нужен, какой architecture pattern выбрать, какие models использовать, как построить AI Pipeline, Data Flow, Quality Layer, Evaluation и Runtime.

## Ответственность

Модуль отвечает за:

- анализ PRD и AI Capabilities;
- выбор минимально достаточной architecture;
- выбор AI Pattern и model strategy;
- проектирование AI Pipeline и Data Architecture;
- Quality Engine и Evaluation Strategy;
- cost, latency, reliability, observability и safety;
- production-ready architecture review.

Модуль не отвечает за:

- Product Discovery и PRD creation;
- UX/UI specification;
- реализацию кода;
- vendor-specific procurement;
- legal approval.

## Структура

| Документ | Ответственность |
|---|---|
| `ROLE.md` | Компетенции и границы роли Principal AI Architect |
| `PROCESS.md` | End-to-end workflow архитектурного проектирования |
| `ARCHITECTURE_PATTERNS.md` | Single Source of Truth для architecture patterns |
| `AI_PATTERNS.md` | Single Source of Truth для AI engineering patterns |
| `MODEL_SELECTION.md` | Система выбора models и model routing |
| `DECISION_ENGINE.md` | Правила архитектурных решений |
| `PIPELINE_DESIGN.md` | Стандарты AI Pipeline |
| `DATA_ARCHITECTURE.md` | Стандарты хранения и Data Flow |
| `QUALITY_ENGINE.md` | Правила проверки качества architecture |
| `EVALUATION.md` | Evaluation Strategy и eval lifecycle |
| `COST_OPTIMIZATION.md` | Cost optimization для AI systems |
| `REVIEW.md` | Оценка architecture 0-100 |
| `CHECKLIST.md` | Definition of Ready и Done |
| `GLOSSARY.md` | Единый словарь |
| `ANTI_PATTERNS.md` | Типовые архитектурные ошибки |

## Взаимосвязь с Senior Product Manager

Входы из `skills/senior-product-manager`:

- PRD;
- Product Analysis;
- AI Capabilities;
- Product Review;
- Architecture Brief;
- Evaluation requirements;
- Risk и safety constraints.

Выходы этого модуля:

- AI Architecture Decision;
- AI Pattern selection;
- Model Selection;
- Pipeline Design;
- Data Architecture;
- Quality и Evaluation Strategy;
- Runtime и Observability requirements;
- Architecture Review.

## Обязательные разделы для новых документов

- назначение;
- ответственность;
- структура;
- взаимосвязь с другими документами;
- обязательные разделы;
- рекомендации;
- примеры;
- критерии качества;
- ссылки на используемые практики.

## Рекомендации

- Если задача решается без AI, рекомендовать non-AI architecture.
- Использовать минимально достаточную architecture.
- Не выбирать model до определения task, quality threshold, cost и latency constraints.
- Любая AI-функция должна иметь Evaluation Strategy.
- Любой high-risk AI output должен иметь Human Review.

## Пример

Input: PRD требует классифицировать обращения пользователей и сформировать summary.

Architecture reasoning:

1. Classification может быть Rules Engine, small model или LLM в зависимости от variability.
2. Summary требует LLM, structured output и hallucination controls.
3. Low-risk cases могут идти auto-processing.
4. High-risk или low-confidence outputs идут в Human Review.
5. Evaluation включает accuracy для classification, factuality и coverage для summary.

## Критерии качества

- Architecture объясняет, где AI нужен и где не нужен.
- Решения traceable к PRD и AI Capabilities.
- Cost, latency, quality и reliability имеют explicit thresholds.
- Pipeline modular, observable и testable.
- Evaluation встроена до Playground и production.

## Ссылки на используемые практики

- NIST AI Risk Management Framework;
- Google Cloud Architecture Framework и AI/ML reliability practices;
- AWS Well-Architected и Machine Learning Lens;
- OpenAI Structured Outputs, Function Calling и evaluation practices;
- отраслевые практики LLM System Design, RAG, Guardrails, AI Observability.


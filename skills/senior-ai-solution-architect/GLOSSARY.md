# GLOSSARY.md

## Назначение

Документ задает единый словарь терминов Senior AI Solution Architect Knowledge System.

## Ответственность

GLOSSARY отвечает за терминологическую согласованность и machine readability.

## Термины

### Agent

AI runtime pattern, где model выбирает действия, tools или intermediate steps в зависимости от context и результатов.

### AI Gateway

Единый слой доступа к AI providers/models для routing, policy, logging, cost и governance.

### AI Pattern

Повторяемый AI engineering mechanism, например RAG, structured outputs, function calling или guardrails.

### Architecture Pattern

System-level design pattern, например Workflow Orchestration, RAG System, AI Gateway или Human Review Queue.

### Fallback

Контролируемый переход к alternative path при failure, low confidence или policy block.

### Guardrails

Validation и policy controls, которые ограничивают unsafe, invalid или unwanted AI behavior.

### Human Review

Процесс проверки AI output человеком перед downstream action или final approval.

### LLM

Large Language Model, используемая для language understanding, generation, reasoning или tool use.

### Model Routing

Выбор model/provider/path на основе task, complexity, risk, cost, latency или confidence.

### RAG

Retrieval-Augmented Generation: pattern, где external knowledge сначала извлекается, затем используется model для grounded output.

### Runtime

Production environment и execution layer, где выполняется AI Pipeline.

### Structured Outputs

AI output, соответствующий заданной schema и пригодный для machine handoff.

### Telemetry

События, traces, metrics и logs, используемые для observability, debugging, cost и quality monitoring.

## Взаимосвязь с другими документами

- `ARCHITECTURE_PATTERNS.md` определяет architecture pattern IDs.
- `AI_PATTERNS.md` определяет AI pattern IDs.
- `PIPELINE_DESIGN.md` использует runtime и telemetry terms.
- `REVIEW.md` использует criteria terms.

## Обязательные разделы для нового термина

- term;
- definition;
- related documents;
- do not confuse with.

## Рекомендации

- Не переводить устойчивые аббревиатуры: LLM, RAG, AI, API, SLA, SLO.
- Добавлять термин только при повторном использовании.
- Не создавать два термина для одной сущности.

## Пример

Agent не равен Workflow. Workflow следует заранее заданным steps, Agent выбирает steps динамически.

## Критерии качества

- Определения не противоречат Senior Product Manager glossary.
- Термины короткие и пригодны для машинной обработки.
- Профессиональные аббревиатуры сохранены.

## Ссылки на используемые практики

LLM System Design, RAG, Function Calling, AI Observability, Well-Architected terminology.


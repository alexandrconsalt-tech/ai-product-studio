# AI_PATTERNS.md

## Назначение

Документ является Single Source of Truth для AI engineering patterns.

## Ответственность

Документ отвечает за `ai_pattern_id`, назначение, применимость, ограничения и quality controls для AI mechanisms.

## Структура

- `ai_pattern_id`
- назначение;
- когда применять;
- риски;
- controls;
- evaluation criteria.

## Patterns

### `structured-outputs`

Назначение: получать model output в проверяемой структуре.

Когда применять: extraction, classification, routing, system-to-system handoff.

Риски: schema mismatch, partial extraction, overconfidence.

Controls: JSON schema, validation, retry with repair, rejection path.

Evaluation: schema validity rate, field accuracy, missing field rate.

### `function-calling`

Назначение: позволить model выбирать и вызывать tools/functions через controlled interface.

Когда применять: tool use, retrieval, calculations, external actions.

Риски: wrong tool, unsafe arguments, unintended side effects.

Controls: allowlist, argument validation, permissions, dry-run for high-risk operations.

Evaluation: tool selection accuracy, argument validity, task completion.

### `context-engineering`

Назначение: управлять instructions, knowledge, retrieval, memory, tools и runtime context.

Когда применять: любые LLM-based workflows.

Риски: context bloat, stale knowledge, instruction conflict.

Controls: source hierarchy, context budget, relevance filtering, versioning.

Evaluation: answer quality by context variant, citation support, latency.

### `rag`

Назначение: retrieval-augmented generation с grounding на knowledge sources.

Когда применять: ответы зависят от enterprise knowledge или документации.

Риски: retrieval miss, irrelevant chunks, stale documents.

Controls: chunking strategy, metadata filters, reranking, citations, freshness checks.

Evaluation: retrieval recall, answer factuality, citation precision.

### `model-routing`

Назначение: направлять запросы к разным models по task, complexity, risk, cost или latency.

Когда применять: разные task classes требуют разных capabilities.

Риски: wrong route, inconsistent quality, debugging complexity.

Controls: routing rules, confidence thresholds, fallback, telemetry.

Evaluation: route accuracy, cost per successful task, quality by route.

### `guardrails`

Назначение: предотвращать unsafe, invalid или policy-breaking outputs/actions.

Когда применять: user-facing AI, tool use, regulated or high-risk workflows.

Риски: false positives, false negatives, degraded UX.

Controls: input/output validation, policy checks, safety classifiers, allow/deny rules.

Evaluation: violation detection, false positive rate, bypass tests.

### `human-in-the-loop`

Назначение: включить human review, approval или correction.

Когда применять: high-risk, low-confidence или irreversible actions.

Риски: reviewer overload, slow SLA, inconsistent reviews.

Controls: sampling, priority queue, rubric, calibration, feedback loop.

Evaluation: review agreement, correction rate, SLA, post-review error rate.

### `ai-observability`

Назначение: мониторить prompts, context, model calls, latency, cost, quality signals и errors.

Когда применять: все production AI systems.

Риски: privacy leakage, incomplete traces.

Controls: redaction, trace IDs, sampling, dashboards, alerts.

Evaluation: trace completeness, incident detection time, cost attribution.

### `fallback`

Назначение: безопасно перейти на alternative model, cached response, rules или human review.

Когда применять: model error, timeout, low confidence, policy failure.

Риски: silent quality degradation.

Controls: explicit fallback hierarchy, user-visible status where needed, logging.

Evaluation: fallback rate, recovery success, quality after fallback.

### `parallel-execution`

Назначение: выполнять independent AI steps параллельно для latency reduction или ensemble quality.

Когда применять: независимые extractions, multiple evaluators, ranking.

Риски: cost increase, synchronization complexity.

Controls: concurrency limits, aggregation rules, timeout budget.

Evaluation: latency reduction, cost impact, aggregate quality.

## Взаимосвязь с другими документами

- `ARCHITECTURE_PATTERNS.md` задает system-level patterns.
- `MODEL_SELECTION.md` использует `model-routing`.
- `PIPELINE_DESIGN.md` применяет AI patterns в steps.
- `QUALITY_ENGINE.md` проверяет controls.

## Обязательные разделы

Новый AI pattern должен иметь ID, applicability, risks, controls и evaluation criteria.

## Рекомендации

- Structured outputs использовать по умолчанию для machine handoff.
- Function calling не должен выполнять unsafe actions без validation.
- Guardrails и observability являются production baseline.

## Пример

Extraction pipeline: `structured-outputs` + `guardrails` + `fallback` + `ai-observability`.

## Критерии качества

- Каждый AI pattern имеет evaluation criteria.
- Risks имеют controls.
- Pattern применим в production.

## Ссылки на используемые практики

OpenAI Structured Outputs и Function Calling, RAG practice, AI Observability, NIST AI RMF, Human-centered AI.


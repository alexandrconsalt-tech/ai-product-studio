# Simulation Engine

## Назначение

Simulation Engine заменяет настоящий AI Runtime в MVP.

Он не подключает OpenAI или другие providers.

## Flow

```text
Input -> Pipeline Nodes -> Output -> Logs -> Metrics -> Run History
```

## Output

Simulation создает:

- structured output;
- execution logs;
- tokens;
- cost;
- latency;
- duration.

## Учёт конфигурации Node (добавлено 2026-07-03)

Раньше Simulation Engine полностью игнорировал `Node.promptId`/`modelId`/`temperature` (см. CLAUDE.md §63 пункт 11). Теперь:

- если в Pipeline есть `llm`-node с `promptId === "prompt_call_summary"`, output формируется по структурной схеме `CallAnalysisSummarySchema` (`src/shared/model/call-analysis-summary.ts`, CLAUDE.md §14.3), а не по generic-объекту `{summary, needs, risks, nextAction}`;
- `confidence` больше не hardcoded `0.86` — вычисляется из `temperature` этого node (выше temperature → ниже confidence);
- `modelId` этого node влияет на симулируемые cost/latency через простой multiplier (`model_fast` дешевле/быстрее `model_reasoning`).

Это остаётся симуляцией, а не настоящим вызовом модели — эффект детерминированный и эвристический, не основан на реальном inference.

## Замена (2026-07-03)

`playground-screen.tsx` больше не вызывает `simulatePipelineRun()` — вместо неё используется `executePipeline()` из `src/shared/runtime/pipeline-executor.ts` (Production Pipeline Runtime), с реальным исполнением графа по узлам, Stage Registry и Prompt Registry. По умолчанию используется mock LLM provider (без реального AI-вызова), но сам executor — не симуляция: настоящий обход графа, настоящие retry/ошибки, настоящие условные переходы по `Edge.condition`.

`simulatePipelineRun()` и этот файл сохранены как исторический артефакт и для регрессионных тестов домена; сам модуль `src/shared/simulation/` больше не используется ни одним экраном.


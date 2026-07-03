# Senior Product Manager Knowledge System v1.0

## Назначение

`senior-product-manager` — Enterprise Knowledge System для AI Product Studio. Модуль задает единый источник знаний для продуктовых решений на пути:

Идея -> Product Discovery -> PRD -> AI Architecture -> Visual Pipeline -> Playground -> готовый AI Pipeline.

Модуль не является prompt, AI Agent или генератором документации. Он описывает знания, правила, критерии качества и схемы результата, которые могут использовать человек, AI-модуль и машинная обработка.

## Ответственность

Модуль отвечает за:

- единый Product Management vocabulary;
- выбор Product Framework под тип задачи;
- принятие воспроизводимых продуктовых решений;
- структуру выходных артефактов;
- проверку качества продуктовой работы;
- фиксацию решений и rationale.

Модуль не отвечает за:

- UI-компоненты;
- хранение пользовательских данных;
- реализацию AI Pipeline;
- выбор конкретного LLM-provider;
- генерацию финального продукта без review.

## Структура

| Документ | Ответственность |
|---|---|
| `ROLE.md` | Компетенции и границы роли Principal Product Manager |
| `PROCESS.md` | End-to-end процесс работы над продуктом |
| `FRAMEWORKS.md` | Single Source of Truth для Product Framework |
| `FRAMEWORK_ROUTER.md` | Правила выбора framework |
| `DECISION_ENGINE.md` | Правила принятия решений |
| `RULES.md` | Нормативные правила Knowledge Module |
| `OUTPUT_SCHEMA.md` | Единая структура результата |
| `CHECKLIST.md` | Definition of Ready и Definition of Done |
| `REVIEW.md` | Система оценки качества |
| `GLOSSARY.md` | Единый словарь терминов |
| `ANTI_PATTERNS.md` | Типовые ошибки Product Manager |
| `DECISION_RECORDS.md` | Шаблон фиксации решений |
| `MATURITY_MODEL.md` | Модель зрелости продукта |

## Взаимосвязь документов

- `FRAMEWORKS.md` определяет все framework и их `framework_id`.
- `FRAMEWORK_ROUTER.md` выбирает framework по типу задачи, используя только `framework_id` из `FRAMEWORKS.md`.
- `PROCESS.md` задает порядок применения framework на этапах lifecycle.
- `DECISION_ENGINE.md` задает правила trade-off и принятия решений.
- `OUTPUT_SCHEMA.md` задает машинно-читаемую структуру результата.
- `CHECKLIST.md` и `REVIEW.md` проверяют готовность и качество результата.
- `DECISION_RECORDS.md` фиксирует решения, rationale и evidence.
- `GLOSSARY.md` нормализует термины для всех документов.

## Обязательные разделы для новых документов

Каждый новый документ внутри Knowledge System должен содержать:

- назначение;
- ответственность;
- структуру;
- взаимосвязь с другими документами;
- обязательные разделы;
- рекомендации;
- примеры;
- критерии качества;
- ссылки на используемые framework.

## Рекомендации

- Использовать русские формулировки, сохраняя профессиональные термины и аббревиатуры: `Product Discovery`, `PRD`, `JTBD`, `OKR`, `HEART`, `AARRR`, `AI Pipeline`.
- Не дублировать определения framework вне `FRAMEWORKS.md`.
- Любое решение сопровождать rationale, assumptions, evidence и confidence level.
- Для AI-продуктов всегда проверять `ai-readiness`, `evaluation-strategy`, `human-in-the-loop`, `cost-quality-latency`, `safety`.

## Пример использования

Задача: определить, стоит ли строить AI feature для автоматического анализа пользовательских интервью.

Корректный путь:

1. `FRAMEWORK_ROUTER.md` выбирает `customer-discovery`, `jtbd`, `opportunity-solution-tree`, `ai-readiness-assessment`.
2. `PROCESS.md` задает порядок: discovery -> synthesis -> solution shaping -> PRD.
3. `DECISION_ENGINE.md` оценивает evidence, риск, value, feasibility.
4. `OUTPUT_SCHEMA.md` формирует результат в единой структуре.
5. `REVIEW.md` проверяет качество.

## Критерии качества

- Все framework имеют стабильные `framework_id`.
- Нет двух документов, которые независимо определяют один и тот же framework.
- Любой AI-модуль может получить одинаковое решение при одинаковых inputs.
- Каждый output содержит evidence, assumptions, risks, decision и next actions.
- Product и AI Engineering решения связаны через единый reasoning chain.

## Ссылки на framework

Полный список находится в `FRAMEWORKS.md`. В этом документе используются ссылки на:

- `customer-discovery`
- `customer-development`
- `jtbd`
- `lean-startup`
- `design-thinking`
- `value-proposition-canvas`
- `business-model-canvas`
- `opportunity-solution-tree`
- `prd`
- `ai-readiness-assessment`
- `evaluation-strategy`

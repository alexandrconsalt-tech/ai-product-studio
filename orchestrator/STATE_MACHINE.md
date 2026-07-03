# STATE_MACHINE.md

## Назначение

Документ описывает конечный автомат проекта AI Product Studio.

## Состояния

| State ID | Название | Описание |
|---|---|---|
| `draft` | Draft | Проект создан, идея еще не проанализирована |
| `idea_analyzed` | Idea Analyzed | Идея разобрана на assumptions и initial context |
| `discovery` | Discovery | Идет Product Discovery |
| `product_design` | Product Design | Формируется PRD и AI Capabilities |
| `product_review` | Product Review | Проверяется качество продуктового решения |
| `product_ready` | Product Ready | PRD и Product Review прошли gate |
| `architecture_design` | Architecture Design | Проектируется AI Architecture |
| `architecture_review` | Architecture Review | Проверяется production-readiness архитектуры |
| `architecture_ready` | Architecture Ready | Architecture Review прошел gate |
| `pipeline_generation` | Pipeline Generation | Формируется Pipeline Specification |
| `pipeline_review` | Pipeline Review | Проверяется Pipeline |
| `pipeline_ready` | Pipeline Ready | Pipeline прошел validation |
| `testing` | Testing | Проект готов к Playground |
| `final_review` | Final Review | Итоговая проверка |
| `completed` | Completed | Проект завершен |
| `archived` | Archived | Проект закрыт и больше не активен |
| `blocked` | Blocked | Нужны данные пользователя или внешнее решение |

## Допустимые переходы

| From | To | Условие |
|---|---|---|
| `draft` | `idea_analyzed` | Idea Analysis завершен |
| `idea_analyzed` | `discovery` | Есть discovery questions |
| `discovery` | `product_design` | Discovery gate пройден |
| `product_design` | `product_review` | PRD draft создан |
| `product_review` | `product_ready` | Product Review >= 85, нет blocking issues |
| `product_ready` | `architecture_design` | Architecture inputs complete |
| `architecture_design` | `architecture_review` | Architecture draft создан |
| `architecture_review` | `architecture_ready` | Architecture Review >= 90, нет blocking issues |
| `architecture_ready` | `pipeline_generation` | Pipeline inputs complete |
| `pipeline_generation` | `pipeline_review` | Pipeline Specification создан |
| `pipeline_review` | `pipeline_ready` | Pipeline Validation Passed |
| `pipeline_ready` | `testing` | Ready For Testing gate пройден |
| `testing` | `final_review` | Playground results доступны |
| `final_review` | `completed` | Ready For Production или approved no-production decision |
| `completed` | `archived` | Пользователь или policy архивирует проект |

## Допустимые возвраты

| From | To | Причина |
|---|---|---|
| `product_review` | `product_design` | PRD неполный или Product Review < 85 |
| `product_review` | `discovery` | Недостаточно evidence |
| `architecture_design` | `product_design` | AI Capabilities противоречат PRD |
| `architecture_review` | `architecture_design` | Architecture Review < 90 |
| `architecture_review` | `product_design` | Product assumptions блокируют architecture |
| `pipeline_generation` | `architecture_design` | Architecture inputs неполные |
| `pipeline_review` | `pipeline_generation` | Pipeline Validation Failed |
| `testing` | `pipeline_generation` | Playground setup failed |
| `final_review` | `architecture_design` | Production risks require architecture changes |
| `final_review` | `pipeline_generation` | Pipeline quality insufficient |

## Blocked transitions

Любое активное состояние может перейти в `blocked`, если:

- недостаточно данных;
- нужен ответ пользователя;
- обнаружены противоречивые требования;
- отсутствует обязательный артефакт;
- external dependency не готова.

Из `blocked` проект возвращается в последнее активное состояние после resolution.

## Запрещенные переходы

- `draft` -> `architecture_design`
- `draft` -> `pipeline_generation`
- `discovery` -> `architecture_design`
- `product_design` -> `pipeline_generation`
- `architecture_design` -> `testing`
- `pipeline_generation` -> `completed`

## Инварианты

- Проект имеет ровно одно текущее состояние.
- Каждый переход имеет reason и timestamp.
- Переход вперед требует Quality Gate.
- Возврат требует explicit issue list.
- `archived` является terminal state.

## Взаимосвязь

- Этапы workflow описаны в `WORKFLOW.md`.
- Decision rules описаны в `DECISION_ENGINE.md`.
- Quality Gates описаны в `QUALITY_GATES.md`.
- Error handling описан в `ERROR_HANDLING.md`.

## Критерии качества

- Все forward transitions идут последовательно.
- Нет переходов, обходящих Product Review, Architecture Review или Pipeline Review.
- Возвраты не создают бесконечный цикл без `blocked`.
- Terminal state только `archived`.

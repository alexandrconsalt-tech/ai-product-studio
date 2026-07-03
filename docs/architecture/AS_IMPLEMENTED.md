# As-Implemented Architecture

## Назначение

Этот документ — точка входа в архитектуру репозитория. Он не дублирует уже существующие документы, а связывает их: что из целевой архитектуры (`knowledge-import/`) уже реализовано в `src/`, что нет, и где искать детали.

Полная, наиболее подробная и часто обновляемая версия этой информации — [`CLAUDE.md`](../../CLAUDE.md) (§7 Architecture Discovery, §8 Software Architecture, §9 Domain Driven Design, §11 AI Communication Platform Architecture). Этот файл — короткая карта для тех, кто предпочитает начать с `docs/`, а не с корневого `CLAUDE.md`.

## Слои (как реализовано)

```text
src/
├── app/          Next.js App Router entry point
├── entities/     Чистый domain-слой — 12 сущностей, без React/Zustand/React Flow
├── features/     Только features/mvp реализован; 6 остальных — пустые заглушки
├── shared/       ui/, stores/, repositories/, simulation/, config/, model/
└── widgets/      Пусто (зарезервировано)
```

Подробное описание слоёв, правил зависимостей и entity-структуры — `docs/domain/*.md` (доменная модель) и CLAUDE.md §8/§9.

## Целевая архитектура vs реализованная

| Компонент из `knowledge-import/19_System_Architecture.md` | Статус в `src/` |
|---|---|
| Product Studio | Частично — `product-screen.tsx`, read-mostly |
| Prompt Studio | Не реализован — `Prompt` entity есть, редактора нет |
| AI Agent System / Orchestrator | Не реализован — только спецификация в `orchestrator/` |
| Pipeline Builder | Реализован — `pipeline-screen.tsx` + `@xyflow/react` |
| Pipeline Lab | Не реализован — упрощённый Playground вместо него |
| Test Analytics | Не реализован |
| Knowledge Base | Не реализован — `KnowledgeModule` это только каталожная запись |
| Version Control | Не реализован — только поле `version: string` без истории |

Технологический стек фронтенда (Next.js, TypeScript, Zod, Zustand) совпадает с целевым из `knowledge-import/19_System_Architecture.md`. Backend-часть целевого стека (PostgreSQL, Redis, Kubernetes, OpenTelemetry) отсутствует полностью — см. `docs/mvp/KNOWN_LIMITATIONS.md`.

## Реальный референсный кейс

В отличие от `knowledge-import/` (обобщённое видение "AI Product OS"), у репозитория есть один конкретный, просчитанный бизнес-кейс — модуль транскрибации и AI-анализа звонков (детали в `CLAUDE.md` §3.3, первоисточник — `pdf-notes.txt`). Демо-данные (`src/shared/repositories/demo-data.ts`) уже смоделированы вокруг этого кейса. Согласно `CLAUDE.md` §3.4, это canonical reference implementation target для дальнейшей разработки пайплайнов.

## Известные архитектурные решения (ADR)

Формальные решения, зафиксированные в ходе Engineering Roadmap — `docs/decisions/`:
- `DEC-001` — каноническое имя продукта.
- `DEC-002` — шкала confidence (0–1).
- `DEC-003` — пороги Product/Architecture Review gate (Accepted, `gate_product_complete` поднят до ≥90).

## Известный технический долг

Полный, поддерживаемый в актуальном состоянии список — `CLAUDE.md` §63. На момент написания этого документа (2026-07-03) главные открытые пункты: рендеринг edges на Pipeline canvas (частично исправлено), нетипизированный `Node.metadata`, отсутствие runtime-гейта для `Prompt.status`/`Review`.

## Куда смотреть дальше

| Вопрос | Документ |
|---|---|
| Как устроена доменная модель | `docs/domain/DOMAIN_MODEL.md`, `ENTITY_GUIDELINES.md`, `ENTITY_LIFECYCLE.md`, `ENTITY_RELATIONSHIPS.md` |
| Что реализовано в MVP | `docs/mvp/MVP_ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md` |
| Дизайн-система | `docs/design/*.md` |
| UX-спецификация экранов | `docs/ux/*.md` |
| Целевая enterprise-архитектура | `knowledge-import/19_System_Architecture.md` |
| Паттерны AI-архитектуры | `skills/senior-ai-solution-architect/ARCHITECTURE_PATTERNS.md`, `AI_PATTERNS.md` |
| Оркестрация (пока только спецификация) | `orchestrator/*.md`, CLAUDE.md §23 |

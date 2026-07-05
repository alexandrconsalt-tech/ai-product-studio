# Product

Product хранит результат работы Senior Product Manager.

Включает Idea, Discovery, Problem, Users, JTBD, Features, MVP, Metrics и PRD.

**AI Product Studio v2 (2026-07-05, см. CLAUDE.md addendum "Product -> Playground -> Dashboard")**
добавил PM-template поля, все опциональные (additive, DDD-1) -- Product screen редактирует их
через функциональные Tabs-секции:

- Общая информация: `valueProposition`, `targetAudience` (`problem`/`users` уже существовали)
- Discovery: `userStory`, `mainScenario` (`jtbd`/`discovery` уже существовали)
- MVP: `mvpOut` ("что не входит", комплементарно существующему `mvp` = "что входит"), `assumptions`
- AI: `aiModels`, `aiAgents`, `aiPipelineNotes` -- пока обычные текстовые поля, не структурированный config
- Метрики: `ProductMetric.category` (`success | quality | cost | speed`), опционально
- `acceptanceCriteria`, `roadmap`, `notes` -- текстовые поля

Эти поля не участвуют в Quality Gates (§23.3 CLAUDE.md) и не имеют отдельного review -- они
описывают продукт для человека, не для orchestrator.

Storage:

- Product является дочерним агрегатом Project;
- Framework хранится отдельно и подключается через `frameworkIds`;
- Review хранится отдельно и ссылается на Product.

Lifecycle:

`draft -> in_progress -> review -> ready -> completed -> archived`


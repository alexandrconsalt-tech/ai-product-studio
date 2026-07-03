# FRAMEWORKS.md

## Назначение

Документ является Single Source of Truth для Product Framework и AI Product Management framework, используемых AI Product Studio.

## Ответственность

Документ отвечает за:

- уникальные `framework_id`;
- назначение каждого framework;
- условия применения;
- ограничения;
- ожидаемые outputs;
- quality criteria;
- ссылки на признанные источники.

Другие документы не должны повторно определять framework. Они должны ссылаться на `framework_id`.

## Структура записи framework

Каждый framework описывается по единому формату:

- `framework_id`
- `название`
- `категория`
- `назначение`
- `когда применять`
- `почему этот подход`
- `inputs`
- `outputs`
- `ограничения`
- `критерии качества`
- `primary_sources`

## Product Framework Library

### `customer-discovery`

Название: Customer Discovery.

Категория: Product Discovery.

Назначение: проверить, существует ли значимая customer problem, кто является customer, насколько проблема острая и как она решается сейчас.

Когда применять: в начале работы с идеей, перед PRD, перед design solution, при слабом evidence.

Почему этот подход: Customer Discovery снижает риск создания продукта на основании внутренних предположений. Подход связан с работами Steve Blank и Customer Development.

Inputs: idea, target segment hypothesis, problem hypothesis, interview plan.

Outputs: validated problems, invalidated assumptions, customer segments, evidence map.

Ограничения: интервью не доказывают willingness to pay без дополнительных сигналов поведения.

Критерии качества: есть реальные customer quotes, сегменты разделены, assumptions отделены от facts, нет преждевременного pitching.

Primary sources: Steve Blank, `The Four Steps to the Epiphany`; Steve Blank, `The Startup Owner's Manual`; официальный сайт Steve Blank.

### `customer-development`

Название: Customer Development.

Категория: Product Development Lifecycle.

Назначение: системно пройти путь от поиска customer и problem до validation, creation и scaling.

Когда применять: при разработке нового продукта, нового рынка или существенной product bet.

Почему этот подход: Customer Development дополняет product development процессом проверки рынка и снижает риск building without market.

Inputs: problem hypotheses, solution hypotheses, business model hypotheses.

Outputs: validated customer, validated problem, validated business model signals, go/no-go decision.

Ограничения: требует дисциплины и реальных контактов с customers.

Критерии качества: каждая гипотеза имеет test method, evidence и decision.

Primary sources: Steve Blank, `The Four Steps to the Epiphany`; Steve Blank and Bob Dorf, `The Startup Owner's Manual`.

### `jtbd`

Название: Jobs To Be Done.

Категория: Problem Framing.

Назначение: описать прогресс, которого customer хочет достичь в конкретной ситуации.

Когда применять: когда feature ideas разрознены, сегменты описаны демографически, а не через мотивацию, или нужно понять switching behavior.

Почему этот подход: JTBD помогает фокусироваться на customer progress, context и struggling moments, а не на внутренней классификации features.

Inputs: customer interviews, current alternatives, trigger situations, desired progress.

Outputs: job statement, circumstances, desired outcomes, forces of progress.

Ограничения: плохо работает как механическая анкета без качественного исследования.

Критерии качества: job не содержит solution, описывает situation и progress, связан с evidence.

Primary sources: Clayton Christensen, `Competing Against Luck`; Tony Ulwick, Outcome-Driven Innovation.

### `lean-startup`

Название: Lean Startup.

Категория: Experimentation.

Назначение: строить продукт через Build-Measure-Learn, MVP и validated learning.

Когда применять: при высокой неопределенности и необходимости быстро проверить critical assumptions.

Почему этот подход: Lean Startup снижает waste через короткие циклы обучения.

Inputs: leap-of-faith assumptions, MVP concept, metric hypothesis.

Outputs: experiment design, learning metrics, pivot/persevere decision.

Ограничения: MVP не должен превращаться в низкокачественный production substitute.

Критерии качества: experiment проверяет конкретную гипотезу, learning измерим, decision заранее определен.

Primary sources: Eric Ries, `The Lean Startup`.

### `design-thinking`

Название: Design Thinking.

Категория: Human-Centered Design.

Назначение: решать complex human problems через empathy, definition, ideation, prototyping и testing.

Когда применять: при неясной user experience, сложном workflow, множестве stakeholders.

Почему этот подход: Design Thinking помогает раскрыть latent needs и быстро проверить solution concepts.

Inputs: research insights, user journey, constraints.

Outputs: problem statement, prototypes, usability feedback.

Ограничения: ideation без validation не является product evidence.

Критерии качества: problem definition основан на research, prototype проверяет конкретный question.

Primary sources: Stanford d.school; IDEO design thinking materials.

### `value-proposition-canvas`

Название: Value Proposition Canvas.

Категория: Value Design.

Назначение: сопоставить customer jobs, pains, gains с products, pain relievers и gain creators.

Когда применять: при формировании value proposition, messaging, solution scope.

Почему этот подход: canvas обеспечивает явную связку между customer profile и value map.

Inputs: customer jobs, pains, gains, solution capabilities.

Outputs: value proposition fit, gaps, high-priority pains/gains.

Ограничения: canvas не заменяет validation у customers.

Критерии качества: каждый pain reliever связан с конкретным pain, нет unsupported claims.

Primary sources: Alexander Osterwalder et al., Strategyzer, `Value Proposition Design`.

### `business-model-canvas`

Название: Business Model Canvas.

Категория: Business Model Design.

Назначение: описать ключевые элементы business model: segments, value propositions, channels, relationships, revenue, resources, activities, partners, cost.

Когда применять: при оценке жизнеспособности продукта и business model assumptions.

Почему этот подход: canvas дает общую структуру для проверки взаимосвязанных business assumptions.

Inputs: product concept, market assumptions, operating model assumptions.

Outputs: business model map, risk areas, validation plan.

Ограничения: статичный canvas быстро устаревает без decision records.

Критерии качества: каждый блок имеет assumptions и validation status.

Primary sources: Alexander Osterwalder and Yves Pigneur, `Business Model Generation`; Strategyzer.

### `opportunity-solution-tree`

Название: Opportunity Solution Tree.

Категория: Continuous Discovery.

Назначение: связать desired outcome, opportunities, solutions и experiments.

Когда применять: когда есть много идей и нужно сохранить traceability от outcome к experiments.

Почему этот подход: OST предотвращает jumping to solutions и делает discovery системным.

Inputs: desired outcome, customer insights, solution ideas, experiment ideas.

Outputs: opportunity map, solution candidates, experiment plan.

Ограничения: дерево требует постоянного обновления на основе learning.

Критерии качества: каждая solution связана с opportunity, каждая opportunity связана с evidence.

Primary sources: Teresa Torres, `Continuous Discovery Habits`.

### `kano-model`

Название: Kano Model.

Категория: Customer Satisfaction.

Назначение: классифицировать attributes по влиянию на satisfaction: basic, performance, excitement, indifferent, reverse.

Когда применять: при анализе customer expectations и feature investment.

Почему этот подход: Kano различает must-have и delighting factors, что помогает избежать неверной приоритизации.

Inputs: feature attributes, customer responses, satisfaction/dissatisfaction data.

Outputs: attribute category, satisfaction implication, prioritization signal.

Ограничения: категории меняются со временем и рынком.

Критерии качества: используется customer data, а не мнение команды.

Primary sources: Noriaki Kano quality model publications.

### `rice`

Название: RICE.

Категория: Prioritization.

Назначение: оценить инициативы через Reach, Impact, Confidence, Effort.

Когда применять: при сравнении product initiatives с разной аудиторией и effort.

Почему этот подход: RICE явно учитывает confidence и effort, снижая bias громких stakeholders.

Inputs: initiatives, reach estimate, impact estimate, confidence, effort.

Outputs: RICE score, ranked backlog, confidence gaps.

Ограничения: score не заменяет strategy и constraints.

Критерии качества: confidence обоснован evidence, effort оценен совместно с engineering.

Primary sources: Intercom RICE prioritization model.

### `ice`

Название: ICE.

Категория: Prioritization.

Назначение: быстро оценить ideas через Impact, Confidence, Ease.

Когда применять: для раннего triage большого числа идей.

Почему этот подход: ICE быстрее RICE и полезен на ранней стадии, когда reach и effort еще приблизительны.

Inputs: ideas, impact estimate, confidence, ease.

Outputs: initial ranking, ideas for deeper analysis.

Ограничения: подвержен субъективности и должен уступать RICE/WSJF для крупных bets.

Критерии качества: используется только как предварительный filter.

Primary sources: Sean Ellis growth practices; growth experimentation literature.

### `moscow`

Название: MoSCoW.

Категория: Scope Management.

Назначение: разделить требования на Must, Should, Could, Won't.

Когда применять: при согласовании release scope и ожиданий stakeholders.

Почему этот подход: MoSCoW помогает отделить обязательное от желательного.

Inputs: requirements, release constraints, stakeholder expectations.

Outputs: prioritized scope categories.

Ограничения: без жестких правил все быстро становится Must.

Критерии качества: Must действительно является release-blocking requirement.

Primary sources: DSDM Agile Project Framework.

### `wsjf`

Название: Weighted Shortest Job First.

Категория: Economic Prioritization.

Назначение: приоритизировать work items по Cost of Delay и job size.

Когда применять: при portfolio или program-level prioritization, особенно в сложных delivery environments.

Почему этот подход: WSJF делает экономику задержки явной.

Inputs: user-business value, time criticality, risk reduction/opportunity enablement, job size.

Outputs: WSJF ranking.

Ограничения: требует согласованной шкалы и зрелости команды.

Критерии качества: Cost of Delay компоненты оценены прозрачно.

Primary sources: Donald Reinertsen, `The Principles of Product Development Flow`; Scaled Agile WSJF guidance.

### `north-star-metric`

Название: North Star Metric.

Категория: Product Strategy Metrics.

Назначение: определить главный metric, отражающий delivered customer value и business growth.

Когда применять: при настройке product strategy, alignment и outcome-based roadmap.

Почему этот подход: North Star Metric помогает избежать фрагментированных local metrics.

Inputs: product value hypothesis, customer lifecycle, business model.

Outputs: North Star Metric, input metrics, metric tree.

Ограничения: один metric не описывает всю систему качества и risk.

Критерии качества: metric отражает customer value, leading behavior и business relevance.

Primary sources: Amplitude North Star Framework; product strategy practice.

### `okr`

Название: Objectives and Key Results.

Категория: Goal Setting.

Назначение: связать качественную цель с измеримыми key results.

Когда применять: для quarterly alignment, strategic bets, cross-functional execution.

Почему этот подход: OKR переводит strategy в measurable outcomes.

Inputs: strategy, objectives, measurable outcomes.

Outputs: objective, key results, confidence, initiatives.

Ограничения: OKR не является task list.

Критерии качества: key results измеримы, outcome-oriented и проверяемы.

Primary sources: Andy Grove, Intel management practice; John Doerr, `Measure What Matters`.

### `heart`

Название: HEART.

Категория: UX Metrics.

Назначение: измерить user experience через Happiness, Engagement, Adoption, Retention, Task Success.

Когда применять: для UX quality measurement и product experience review.

Почему этот подход: HEART связывает UX outcomes с метриками и goals-signals-metrics.

Inputs: UX goals, user behavior, survey или product analytics data.

Outputs: HEART metric set, signals, measurement plan.

Ограничения: не все категории нужны для каждого продукта.

Критерии качества: metrics связаны с explicit goals и не перегружают dashboard.

Primary sources: Kerry Rodden, Hilary Hutchinson, Xin Fu, Google HEART framework.

### `aarrr`

Название: AARRR.

Категория: Growth Funnel.

Назначение: анализировать growth funnel через Acquisition, Activation, Retention, Referral, Revenue.

Когда применять: для диагностики growth bottlenecks.

Почему этот подход: AARRR помогает увидеть слабые места customer lifecycle.

Inputs: funnel data, lifecycle events, revenue data.

Outputs: funnel diagnosis, bottlenecks, growth experiments.

Ограничения: не должен заменять product value discovery.

Критерии качества: events определены одинаково, cohorts используются корректно.

Primary sources: Dave McClure, Pirate Metrics.

### `product-market-fit`

Название: Product-Market Fit.

Категория: Market Validation.

Назначение: оценить, насколько продукт удовлетворяет сильную потребность конкретного рынка.

Когда применять: перед масштабированием, при оценке retention, demand, pull from market.

Почему этот подход: PMF отделяет ранний interest от устойчивого market pull.

Inputs: retention, usage, qualitative pull, sales signals, willingness to pay.

Outputs: PMF assessment, gaps, scale readiness decision.

Ограничения: нет одного универсального PMF metric для всех продуктов.

Критерии качества: используются behavioral и business signals, а не только survey.

Primary sources: Marc Andreessen PMF essay; Sean Ellis PMF survey; startup literature.

### `prd`

Название: Product Requirements Document.

Категория: Product Specification.

Назначение: зафиксировать problem, goals, scope, requirements, constraints, metrics и launch criteria.

Когда применять: после достаточного discovery и перед detailed design/engineering.

Почему этот подход: PRD обеспечивает alignment между product, design, engineering, data и stakeholders.

Inputs: validated problem, customer segment, goals, constraints, requirements, metrics.

Outputs: PRD, open questions, decision log.

Ограничения: PRD не должен маскировать отсутствие discovery.

Критерии качества: traceability от problem к requirements и success metrics.

Primary sources: product management practice at technology companies; Marty Cagan product discovery/product delivery distinction.

### `user-story-mapping`

Название: User Story Mapping.

Категория: Product Planning.

Назначение: организовать user activities, tasks и stories в карту, помогающую определить release slices.

Когда применять: при разложении workflow и planning MVP/release.

Почему этот подход: story map сохраняет пользовательский контекст лучше плоского backlog.

Inputs: user journey, activities, tasks, stories.

Outputs: story map, release slices, gaps.

Ограничения: story map не заменяет validation.

Критерии качества: карта отражает user workflow, а не внутреннюю архитектуру.

Primary sources: Jeff Patton, `User Story Mapping`.

### `user-personas`

Название: User Personas.

Категория: User Modeling.

Назначение: описать archetypal users на основе research, чтобы улучшить empathy и decision consistency.

Когда применять: когда разные user types имеют разные goals, constraints и contexts.

Почему этот подход: personas помогают команде держать user context, если основаны на evidence.

Inputs: interviews, analytics, segmentation, behavior patterns.

Outputs: evidence-based personas, goals, pains, context, behaviors.

Ограничения: fictional personas без research вредны.

Критерии качества: persona основана на data, не является demographic caricature.

Primary sources: Alan Cooper personas practice; user research literature.

## AI Product Management Library

### `ai-readiness-assessment`

Название: AI Readiness Assessment.

Категория: AI Product Feasibility.

Назначение: определить, готова ли проблема, организация, данные и workflow к AI-решению.

Когда применять: до выбора model и AI Architecture.

Почему этот подход: AI часто добавляет cost, latency, uncertainty и governance burden; readiness снижает риск building AI where deterministic automation is enough.

Inputs: problem definition, data availability, workflow, user tolerance for errors, compliance constraints.

Outputs: readiness score, blockers, required preparation, go/no-go recommendation.

Ограничения: readiness не гарантирует business value.

Критерии качества: оцениваются data, task suitability, user workflow, risk, operations, evaluation.

Primary sources: NIST AI Risk Management Framework; Google People + AI Guidebook; Microsoft Responsible AI Standard.

### `ai-product-evaluation`

Название: AI Product Evaluation.

Категория: AI Quality.

Назначение: оценить AI capability в контексте product outcomes, user experience и risk.

Когда применять: для AI features, model-based workflows, generated content, classification, extraction и recommendation.

Почему этот подход: model metrics без product context не показывают user value и operational risk.

Inputs: task definition, ground truth или reference set, success criteria, failure taxonomy.

Outputs: evaluation report, quality score, failure modes, release recommendation.

Ограничения: evaluation set должен обновляться при изменении domain и data.

Критерии качества: есть dataset, metrics, qualitative review, regression checks, human review policy.

Primary sources: NIST AI RMF; OpenAI Evals concepts; ML evaluation practice.

### `ai-capability-assessment`

Название: AI Capability Assessment.

Категория: AI Feasibility.

Назначение: определить, какие AI capabilities действительно нужны: classification, extraction, generation, reasoning, retrieval, tool use, orchestration.

Когда применять: перед architecture design и model selection.

Почему этот подход: capability decomposition предотвращает выбор model до понимания task.

Inputs: user task, desired output, constraints, quality requirements.

Outputs: capability map, capability risks, architecture implications.

Ограничения: capability map не является system architecture.

Критерии качества: capabilities связаны с user value и evaluation criteria.

Primary sources: AI engineering practice; NIST AI RMF; LLM application architecture practice.

### `human-in-the-loop`

Название: Human-in-the-loop.

Категория: AI Governance and Operations.

Назначение: определить, где нужен human review, approval, escalation или correction.

Когда применять: при high-impact decisions, uncertain outputs, safety-sensitive workflows, low tolerance for errors.

Почему этот подход: human oversight снижает harm, повышает trust и улучшает feedback loop.

Inputs: risk level, error tolerance, user role, workflow, escalation rules.

Outputs: review policy, escalation path, correction workflow, audit trail.

Ограничения: human review не масштабируется без triage и sampling strategy.

Критерии качества: clear ownership, thresholds, SLA, auditability.

Primary sources: NIST AI RMF; Microsoft Responsible AI; human-centered AI practice.

### `evaluation-strategy`

Название: Evaluation Strategy.

Категория: AI Quality System.

Назначение: определить, как AI Pipeline будет измеряться до launch и после launch.

Когда применять: до Playground и перед production release.

Почему этот подход: без evaluation strategy невозможно воспроизводимо улучшать AI quality.

Inputs: task, expected outputs, failure taxonomy, test data, business metrics.

Outputs: eval plan, metrics, datasets, thresholds, regression process.

Ограничения: strategy должна обновляться при изменении users, data и model.

Критерии качества: есть offline eval, online monitoring, human review, regression gates.

Primary sources: ML evaluation practice; NIST AI RMF; OpenAI Evals concepts.

### `model-selection`

Название: Model Selection.

Категория: AI Architecture Decision.

Назначение: выбрать model или model class на основе task fit, quality, cost, latency, context, safety и operational constraints.

Когда применять: после capability assessment и evaluation criteria.

Почему этот подход: model должен выбираться по measurable task performance, а не по popularity.

Inputs: capability map, eval set, constraints, provider requirements.

Outputs: model decision, alternatives, trade-off analysis.

Ограничения: выбор model устаревает и требует periodic review.

Критерии качества: сравнение минимум двух viable options, documented trade-offs.

Primary sources: AI engineering practice; provider model documentation; ML system design practice.

### `cost-quality-latency`

Название: Cost vs Quality vs Latency.

Категория: AI Product Trade-off.

Назначение: явно управлять trade-off между quality, cost и latency.

Когда применять: для любых AI Pipeline, особенно в interactive workflows.

Почему этот подход: AI-продукты часто терпят failure не из-за capability, а из-за unit economics или response time.

Inputs: quality target, cost budget, latency target, usage volume.

Outputs: trade-off matrix, thresholds, routing policy.

Ограничения: оптимизация одного параметра может ухудшить остальные.

Критерии качества: thresholds измеримы, связаны с user experience и business model.

Primary sources: AI product operations practice; ML systems engineering.

### `hallucination-risk`

Название: Hallucination Risk.

Категория: AI Risk.

Назначение: оценить риск недостоверных, fabricated или unsupported AI outputs.

Когда применять: при generation, summarization, extraction, recommendations и decision support.

Почему этот подход: hallucination может разрушить trust и привести к harmful decisions.

Inputs: task type, source availability, grounding method, output criticality.

Outputs: risk rating, mitigation plan, evidence requirements.

Ограничения: полностью устранить риск невозможно; его нужно снижать и контролировать.

Критерии качества: outputs grounded, citations/evidence required where applicable, human review threshold defined.

Primary sources: NIST AI RMF; LLM reliability research; AI safety practice.

### `safety`

Название: Safety.

Категория: Responsible AI.

Назначение: определить product, user, business, legal и societal risks AI-системы.

Когда применять: для всех AI features до launch.

Почему этот подход: AI-системы могут создавать harm даже при правильной технической работе.

Inputs: use case, user groups, risk context, compliance constraints, failure modes.

Outputs: safety assessment, mitigations, launch constraints.

Ограничения: safety review требует актуализации при изменении context.

Критерии качества: harm scenarios identified, mitigations assigned, owner defined.

Primary sources: NIST AI RMF; Microsoft Responsible AI Standard; Google AI Principles.

### `context-engineering`

Название: Context Engineering.

Категория: AI System Design.

Назначение: проектировать, какие instructions, knowledge, memory, tools, retrieval и runtime context получает AI-система.

Когда применять: для LLM-based features, AI agents, RAG, tool-using pipelines.

Почему этот подход: качество AI outputs зависит не только от model, но и от управляемого context.

Inputs: task, knowledge sources, user state, tools, policies, output schema.

Outputs: context design, source hierarchy, context budget, grounding policy.

Ограничения: больше context не всегда лучше; нужен relevance и governance.

Критерии качества: context traceable, minimal sufficient, policy-aware, testable.

Primary sources: LLM application engineering practice; retrieval-augmented generation literature.

## Взаимосвязь с другими документами

- `FRAMEWORK_ROUTER.md` выбирает framework из этой библиотеки.
- `PROCESS.md` использует framework на этапах lifecycle.
- `DECISION_ENGINE.md` применяет framework для trade-off.
- `CHECKLIST.md` и `REVIEW.md` проверяют качество применения.
- `GLOSSARY.md` нормализует термины.

## Обязательные разделы

Новые framework должны добавляться только в этот документ и только с уникальным `framework_id`.

## Рекомендации

- Не добавлять internal framework, если есть признанный industry framework.
- Для нескольких viable approaches указывать recommended default в `FRAMEWORK_ROUTER.md`, а не в определении framework.
- Для AI framework всегда указывать risk и evaluation implications.

## Пример

Если задача звучит как "понять, нужен ли пользователям AI-review PRD", сначала используются `customer-discovery`, `jtbd`, `opportunity-solution-tree`, затем `ai-readiness-assessment`.

## Критерии качества

- Все framework имеют уникальные `framework_id`.
- Определения не противоречат друг другу.
- AI framework совместимы с Product Framework.
- Источники относятся к признанным мировым практикам.

## Ссылки на framework

Этот документ является источником определений для всех `framework_id`. Внешние ссылки на framework должны вести сюда, а не создавать повторные определения.

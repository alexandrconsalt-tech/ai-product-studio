# CLAUDE.md — AI Product Studio Engineering Constitution

> Canonical engineering source of truth for this repository. Supersedes any other document when they conflict, except where this document explicitly defers.

## 0. About This Document

**0.1 Status.** This file is the constitution of the repository. It is not a prompt, not a README, not a style guide. It is the operating system for autonomous and human engineering work on this codebase, effective 2026-07-03.

**0.2 Relationship to other documents.** This repository already contains three other bodies of engineering knowledge, all of which remain in force and are **not superseded, moved, or edited** by this document:

| Location | Nature | Authority |
|---|---|---|
| `knowledge-import/` (20 numbered files + README + CLAUDE.md) | Aspirational Enterprise SRS for a platform called "AI Product OS" | Long-term target-state vision. Not yet implemented in `src/`. |
| `orchestrator/` (8 files + README) | Runtime specification for a lifecycle coordinator | Design spec for orchestration logic. Not yet implemented in `src/`. |
| `skills/senior-ai-solution-architect/`, `skills/senior-product-manager/` | AI-role "knowledge systems" consumed at runtime by the app via `KnowledgeModule.path` (see `src/shared/repositories/demo-data.ts:29,37`) | **Live application data.** Treat as semi-runtime content, not pure documentation. Do not move or restructure without updating `demo-data.ts`. |
| `docs/design/`, `docs/ux/`, `docs/domain/`, `docs/mvp/` | Descriptive specs for the implemented MVP | Describes what exists today in `src/`. |
| `pdf-notes.txt` (repository root) | Raw dump of real business/product material about a call-transcription-and-analysis product | The only concrete, numbers-backed business case in the repository. Currently disconnected from all of the above. |

This document sits above all of them: where they agree, it cites them; where they conflict or are silent, it makes a binding decision and says so explicitly, flagged as **[CANONICAL DECISION]**. Every such decision should eventually be ratified as a formal ADR (§41) — until then, this document is the interim authority.

**0.3 How to use this document.** Read top to bottom once. After that, use it as a reference: jump to the chapter matching your task before writing code. Every chapter follows the same internal shape where applicable: Purpose → Principles → Mandatory Rules → Recommendations → Anti-Patterns → Examples → Checklist → Quality Criteria → Decision Rules → Definition of Done. Chapters about process or non-code topics omit sections that don't apply.

**0.4 Audience.** Any engineer or autonomous agent (including Claude) working on this repository, now or years from now, without further verbal briefing.

---

## 1. Mission

**Purpose.** State why this repository exists and what "success" means, so every other decision in this document can be traced back to it.

This repository is building **AI Product Studio** (`package.json` name: `ai-product-studio`; page title: "AI Product Studio"; folder name on disk: "AI Communication Studio") — a professional IDE-like environment in which a Product Manager collaborates with AI specialist roles to take an idea through Product Discovery, PRD, AI Architecture, Pipeline design, and Playground validation, ending in a production-ready AI pipeline.

**[RATIFIED — naming, see `docs/decisions/DEC-001-canonical-product-naming.md`].** The repository is referred to by three different names across its own documents: "AI Product OS" (`knowledge-import/`), "AI Communication Platform" (`knowledge-import/CLAUDE.md`), and "AI Communication Studio" / "AI Product Studio" (the actual folder, `package.json`, and rendered UI). Going forward:
- **"AI Product Studio"** is the product name for the *application implemented in `src/`* — use it in code, UI strings, and this document.
- **"AI Product OS"** is the name for the *long-term platform vision* described in `knowledge-import/` — use it only when specifically discussing that aspirational SRS.
- **"AI Communication Platform/Studio"** is the *umbrella/stakeholder-facing term* used loosely for the whole initiative; do not use it in code or schemas.
Any new document, commit message, or UI string SHOULD use "AI Product Studio" unless it is specifically about the `knowledge-import/` vision. This decision is formally ratified as DEC-001 (Accepted, 2026-07-03, §41).

**Mission statement** (adapted from `knowledge-import/01_Vision_and_Product_Philosophy.md` and `knowledge-import/README.md`, scoped to what this repo actually builds): reduce the time and specialist headcount required to take an AI product idea to a validated, evaluable pipeline, by having AI specialist roles (Product Manager, Solution Architect, Prompt Engineer, Reviewer) do most of the discovery, architecture, and prompt-engineering work, with the human Product Manager acting as reviewer and decision-maker rather than primary author.

**What "done" looks like for this repository long-term**, synthesizing the roadmap in `knowledge-import/16_Development_Roadmap.md` with the actually-implemented slice in `src/`:
1. The current MVP vertical slice (`Projects → Product → Architecture → Pipeline → Playground`, Local-Storage-backed) is replaced by a real backend behind the existing `ProjectRepository` interface (`src/shared/repositories/types.ts`) without UI changes.
2. The `orchestrator/` specification is implemented in code (today it is documentation only).
3. At least one real AI pipeline is built end-to-end using the domain model — the natural first candidate is the concrete call-transcription-and-analysis case in `pdf-notes.txt` (§3.3), because it is the only business case in the repository with real numbers, real constraints, and a real evaluation plan.
4. Golden Dataset, Evaluation Framework, and Prompt Versioning move from concept (`knowledge-import/07_Pipeline_Lab.md`, `10`, `11`) to actual code and CI-enforced gates.

**Mandatory rules.**
- **M-1.1.** Every non-trivial change SHOULD be traceable to one of: a Feature Specification (§37), an ADR (§41), or a bug/incident (§57). Do not make sweeping architectural changes "because it seemed cleaner."
- **M-1.2.** When the Mission and a narrower document conflict (e.g., a skill file suggests scope the Mission doesn't need yet), the Mission wins. Building the AI Product OS in full is not a near-term goal; building a working, evaluable slice of AI Product Studio is.

**Definition of Done for this chapter's guidance:** any engineer or agent, on first read, can state in one sentence what this repository is, what it is not yet, and which of the four documents in §0.2 to consult for a given question.

---

## 2. Engineering Philosophy

**Purpose.** Establish the non-negotiable values that resolve ambiguity when specific rules run out.

**Principles**, inherited and made binding from `knowledge-import/CLAUDE.md` (which remains valid but is superseded in authority by this document):

1. **Understand before changing.** Never edit a file, entity, or store you have not read in full. Given this repo's extensive but occasionally self-contradictory documentation (see §31 for the terminology conflicts already found), "understanding" explicitly includes checking whether a doc's claim still matches the code in `src/`.
2. **Solve the underlying problem, not the ticket text.** If a requested change reveals a deeper gap (e.g., a missing entity relationship), say so before patching around it.
3. **Prefer architecture over shortcuts.** The domain layer (`src/entities/`) is intentionally decoupled from React, Zustand, and React Flow (`docs/domain/ENTITY_GUIDELINES.md`). Do not break that isolation to save time.
4. **Evidence over assumption.** Cite a file and line, a schema, or a passing test — not "I think this is how it works." This document itself follows that rule: every concrete claim below is sourced from a real file in this repository.
5. **No hallucinated repository facts.** Never invent a file, export, script, or endpoint that does not exist. If unsure, grep first (§5).
6. **Simplicity first.** `skills/senior-ai-solution-architect/DECISION_ENGINE.md` rule D-001 ("Non-AI First") generalizes: default to the simplest mechanism that satisfies the requirement — plain function over Zustand store, Zustand store over new entity, new entity over new subsystem.
7. **Production-ready by default**, scoped to what "production" means for the layer you're touching: the domain layer should always be production-grade (it is small and load-bearing); the Playground's simulation engine is explicitly a throwaway demo layer (§12.4) and does not need production rigor until it is replaced by a real runtime.
8. **Minimize technical debt; leave the repository better than you found it.** Concretely: if you touch a file with a known inconsistency (documented in §31), fix it or file it — do not silently work around it a second time.
9. **Russian by default for product/domain documentation.** `skills/senior-product-manager/RULES.md` rule R-009 states: "Все человеко-читаемые формулировки пишутся на русском языке, кроме профессиональных терминов и аббревиатур." This convention is repo-wide — all 36 files under `orchestrator/` and `skills/` and most of `docs/` are in Russian prose with English technical identifiers. New product/domain/UX documentation SHOULD follow the same convention. Code (identifiers, comments, commit messages) stays in English.

**Anti-patterns:**
- Writing generic advice that could apply to any Next.js project instead of grounding it in this repo's actual entities, gates, and thresholds.
- "Fixing" a documented inconsistency (§31) by unilaterally editing one side of it without an ADR — that just moves the disagreement.
- Adding a dependency, entity, or abstraction "for later" without a concrete near-term consumer (violates M-1.1 and DDD boundary discipline, §9).

**Definition of Done:** a decision made under this chapter's guidance can always answer "which principle made me choose this?" in one sentence.

---

## 3. Product Vision

**Purpose.** Give every engineer/agent the same mental model of what is being built and why, reconciling the two competing visions found in the repository.

### 3.1 The long-term platform vision (`knowledge-import/`)

`knowledge-import/01_Vision_and_Product_Philosophy.md` through `20_Glossary_and_Enterprise_Standards.md` describe **AI Product OS**: an enterprise operating system with 8 platform components (Product Studio, Prompt Studio, Pipeline Builder, Pipeline Lab, Test Analytics, Knowledge Base, Version Control, AI Orchestrator), an 8-role AI team (Product Manager, Business Analyst, Solution Architect, Prompt Engineer, AI Engineer, QA Engineer, Technical Reviewer, Knowledge Manager), and a mission to "reduce AI product development time by more than 80%." It specifies a canonical data model (`12_Data_Model.md`), Postgres schema sketch (`13_Database_Schema.md`), API-first architecture (`14_API_Architecture.md`), and a named tech stack — Next.js, TypeScript, PostgreSQL, Redis, Kubernetes, OpenTelemetry, Object Storage, Vector Database (`19_System_Architecture.md`) — which is the only knowledge-import file that names actual implementation technology, and it matches this repo's real stack for the frontend half (Next.js + TypeScript).

This is real, well-structured requirements material — but it is currently **100% documentation, 0% implementation**. Nothing under `src/` implements Prompt Studio, Pipeline Lab, Test Analytics, or Knowledge Base as described.

### 3.2 The implemented slice (`src/`, `docs/mvp/`)

What actually exists today is a single-tenant, Local-Storage-backed MVP implementing one path: `Projects → Product → Architecture → Pipeline → Playground`, seeded with one demo project, **"AI Call Analysis"** (`src/shared/repositories/demo-data.ts`). This name is not a coincidence — see §3.3.

### 3.3 The real business case (`pdf-notes.txt`)

`pdf-notes.txt` is a text dump of real planning material (Miro board export dated 2026-06-22/23, workstream **"ИИ в заявке" (VT)**) about an actual product: a **call transcription and AI analysis module** for a sales/CRM platform. Concretely:

- **Problem it solves**: agents lose call context (can't log details while driving), call outcomes are subjective ("client is thinking" means nothing), sales managers can't review 1000 calls to find the 10 that matter, and context is lost when a lead changes hands.
- **Scale**: ~50,000 target communications/month, ~150,000 minutes, split ~24,090 connected-to-agent vs ~20,783 not-connected.
- **Three MVP features**: (1) accurate first-contact detection tied to actual contact-center connection, (2) context recovery for the agent via structured summary, (3) lead prioritization from solvency + purchase timeline + system-computed "hotness."
- **As-is pipeline**: `Audio → Transcription (Nexara, ~1₽) → Enhancement (GPT-5 mini, 0.96₽, one 315-line prompt V3) → routing (КЦ/Agent, disputed 70/30 vs 40/60) → Summary (V5 for КЦ, V6 for Agent, free text)`. Cost ≈ 450,000₽/month at 150,000 calls (300k enhancement + 150k summary).
- **To-be pipeline** (§12.5 covers this in architectural terms): diarization from the transcription service itself (not LLM guesswork) → deterministic regex normalization for phones/prices/codes/profanity (explicitly **not** LLM) → narrow LLM pass only for boundaries/roles the service missed, grounded in quotes → explicit КЦ/Agent router → structured LLM summary (shared core + per-type profile) with schema `{кто, тип_контакта, потребность, бюджет, срок, способ_оплаты, вопросы[], статус, действие, цитаты[]}` → separate verifier-agent pass (reject/rewrite gate) → write-back to the CRM lead record.
- **Evaluation plan**: a golden set of 40 real calls, deterministic scorers (no leaked PII in КЦ summaries, phone/code normalization, profanity masking, length caps, action-present) plus a model-judge scorer with citation grounding, staged rollout Этап 0–5 with named owners, a milestone at end of June and a final delivery target of **15 июля** (July 15).
- **Dangling references**: the plan cites `reference/miro-as-is/открытые-вопросы.md` and `research/…frame-1…` for the full G1–G9 gap analysis and golden examples — **neither path exists in this repository.** Treat any future reference to these paths as needing to be re-sourced from whoever authored the Miro board, not assumed to exist.

### 3.4 [CANONICAL DECISION] — how the two visions relate

Nothing in the repository explicitly connects §3.1 and §3.3. This document makes the connection explicit: **the call-transcription-and-analysis case in §3.3 is the reference implementation target for the AI Product Studio pipeline layer.** The demo data already seeds a "Call Analysis" pipeline with 8 nodes (Input → Router → LLM → Tool → Validation → Human Review → Store → Output, `demo-data.ts`) that structurally mirrors the to-be pipeline in §3.3 — this was clearly intentional even though no document says so outright. When designing pipeline features, evaluation criteria, or agent contracts, prefer scenarios drawn from §3.3 over invented generic examples; it is the only source of real numbers, real constraints, and a real evaluation methodology in this repository.

**Decision rule:** if a new pipeline/prompt/agent example is needed for documentation or tests, use the call-analysis domain (transcripts, needs, budget, timeline, action) rather than a generic placeholder — it is both realistic and already partially modeled in `demo-data.ts`.

**Definition of Done:** anyone reading this chapter can explain, without looking anything else up, what AI Product OS is, what AI Product Studio actually does today, what the call-analysis business case is, and why the two are treated as connected.

---

## 4. Autonomous Development

**Purpose.** Define precisely how Claude (or any autonomous agent) should operate on this repository without a human in the loop for every decision.

**Mandatory workflow, in order, for every task:**
1. **Inspect** — read every file you are about to touch, in full, plus its immediate neighbors (same directory, same entity's sibling files). Never edit a Zod schema without reading its `types.ts` and `factory.ts` counterparts (`docs/domain/ENTITY_GUIDELINES.md` requires the three to stay in sync).
2. **Understand architecture** — confirm which FSD layer (`entities`/`features`/`shared`/`widgets`, §8) the change belongs to before writing anything.
3. **Search for reusable code** — this repo already has 7 Zustand stores, 12 entities, and a full `shared/ui` primitive set (§44.4). Adding a new one without checking these first is a defect, not a stylistic choice.
4. **Design the solution** — for anything touching more than one file outside a single component, write a one-paragraph plan before editing (mentally or in the PR description); for anything touching the domain model, check §9 (DDD) boundaries first.
5. **Implement.**
6. **Test** — run `npm test` (Vitest). Domain-layer entities have partial coverage (§19); most of the codebase (stores, UI, simulation) still has none. Do not assume coverage exists beyond what §19 documents; do not silently skip adding tests for new domain logic either.
7. **Refactor** only what you touched; do not drive-by refactor unrelated code (violates M-1.1).
8. **Self-review** using §65 before considering the task complete.
9. **Update documentation** — if you change an entity, its `README.md` and the relevant `docs/domain/*.md` must change in the same unit of work. If you change orchestrator/skill logic that doesn't exist in code yet, do not retroactively edit those spec files to match a code shortcut — fix the code.

**Mandatory behavioral rules:**
- **AD-1.** Never invent a repository fact (a file, an export, a schema field, a passing CI check) that you have not verified exists. If you need to state something you're not sure of, say "not verified" rather than presenting a guess as fact — the entire value of this document comes from its claims being checked against real files (see the extraction work behind §31).
- **AD-2.** Ask the user only when a decision requires information that cannot be inferred from the repository and materially changes the outcome (e.g., "should the real backend be Postgres, given `knowledge-import/13_Database_Schema.md` assumes it, or something else?"). Do not ask about things resolvable by reading one more file.
- **AD-3.** When two repository documents conflict (§31 catalogs known ones), do not silently pick one. State the conflict, apply the resolution this document gives if one exists, otherwise apply the Decision Rules in §31.9, and note that an ADR is owed.
- **AD-4.** Proactively flag technical debt you encounter even if it's outside your task's scope (see the `spawn_task`-equivalent behavior expected of any agent working here) — but do not fix unrelated debt inline without being asked.
- **AD-5.** Never use `--no-verify`, force-push, or destructive git operations without explicit user confirmation for that specific action.
- **AD-6.** Never fabricate evaluation results, benchmark numbers, or "it works" claims without having actually run something. `skills/senior-product-manager/RULES.md` R-010 ("No Mock Knowledge") applies to autonomous agents doubly: "Запрещены фиктивные данные, вымышленные evidence и placeholder conclusions."

**Anti-patterns:**
- Silently "completing" a task by writing plausible-looking code that was never run.
- Treating `knowledge-import/`'s aspirational SRS as if it already describes running code.
- Re-deriving architecture context that a previous agent turn (or this very document) already established.

**Definition of Done:** an autonomous session on this repository leaves behind code that matches what it claims to have done, documentation that matches the code, and an explicit note of anything it could not verify.

---

## 5. Repository Intelligence

**Purpose.** Give a fast, reliable map for "where do I look first" before starting any task — this is the difference between grepping blindly and knowing exactly which of ~150 files matters.

**Fast lookup table:**

| I need to... | Look here first |
|---|---|
| Understand a domain entity's shape | `src/entities/<Name>/model/{types,schema,factory}.ts` + `src/entities/<Name>/README.md` |
| Understand cross-entity relationships | `docs/domain/ENTITY_RELATIONSHIPS.md` (§9.3) |
| Understand a status/lifecycle | `docs/domain/ENTITY_LIFECYCLE.md` (§9.2) — but verify against the actual `*StatusSchema` in code, they can drift |
| Find how state is held client-side | `src/shared/stores/*.ts` (§8.5) |
| Find how data persists | `src/shared/repositories/{types,local-storage-repository,demo-data}.ts` (§8.6) |
| Find a UI primitive | `src/shared/ui/{ai,containers,feedback,form,layout,navigation,pipeline}.tsx`, barrel `index.ts` (§44.4) |
| Find a design token | `src/shared/config/design-tokens.ts` + `docs/design/DESIGN_TOKENS.md` |
| Understand a screen's intended behavior | `docs/ux/SCREEN_*.md` — then verify against `src/features/mvp/screens/*.tsx`, since at least two screens (`product-screen.tsx`, `architecture-screen.tsx`) render decorative, non-interactive tabs that don't match the interactive intent implied by the UX spec (§31.10) |
| Understand orchestration logic | `orchestrator/*.md` — **specification only, not implemented in `src/`** |
| Understand an AI role's behavior contract | `skills/senior-ai-solution-architect/*.md` or `skills/senior-product-manager/*.md` — **live data**, loaded via `KnowledgeModule.path` |
| Find the real business case | `pdf-notes.txt` (§3.3) |
| Find the platform-scale vision | `knowledge-import/*.md` |

**Mandatory rules:**
- **RI-1.** Before creating any new file, run a search for an existing equivalent. This repo has empty scaffold directories (`framework-library/*`, `templates/*`, `skills/ai-engineering/`, `skills/evaluation/`, `skills/product-management/`, `docs/product/`, `src/widgets/`) that look like they contain something but don't (all `.gitkeep` only, verified). `docs/decisions/` and `docs/architecture/` are exceptions — both populated 2026-07-03 (DEC-001/002/003, §41; `AS_IMPLEMENTED.md`, §7). Do not assume any *other* directory in this list is populated just because its name suggests it should.
- **RI-2.** Before adding a dependency, check `package.json` — the dependency set is deliberately small (React 19, Next 15, Zustand 5, Zod 4, `@xyflow/react` 12, Tailwind 3, `framer-motion`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`). No test runner, no ORM, no HTTP client, no state-sync library beyond Zustand are present — adding one is an architectural decision, not a routine `npm install`.
- **RI-3.** Git was initialized 2026-07-03 as the first step of the Engineering Roadmap (§63 debt item 2, now closed) — `git log`/`git blame` are now valid sources of history, but only from that date forward. Do not assume any history predates the baseline commit; the repository's actual age and prior authorship are not recoverable from git.

**Definition of Done:** you can name the exact file(s) relevant to a request before writing any code, and you have confirmed via `ls`/`find`/`grep` — not memory of this document — that they still exist in the shape described.

---

## 6. Repository Discovery

**Purpose.** The concrete procedure for building the mental model described in §5, for a task that touches unfamiliar territory.

**Mandatory procedure:**
1. `find` the directory tree scoped to the area of the task (exclude `node_modules`, `.next`, `.npm-cache`).
2. Read every file in that area in full — not headers-only — before editing any of them. Partial reads produce the exact kind of drift documented in §31 (multiple documents each describing "the same" concept with subtly different names/thresholds because no one read the sibling document in full).
3. Cross-check code against docs, not the other way around: code is ground truth for *what runs*, docs are ground truth for *intent*. When they disagree, say which is which — do not average them.
4. For anything involving the orchestrator/skills knowledge systems, check `src/shared/repositories/demo-data.ts` for the literal string `path:` references before assuming a `skills/*` file is "just documentation" — some of them are load-bearing application data.

**Anti-patterns:**
- Reading only `README.md` of a directory and extrapolating the rest.
- Assuming a `docs/*` file describes current behavior without checking the corresponding `src/` code (two screens are documented as fully interactive per-tab but are implemented as static, non-switching sections — §31.10).

**Definition of Done:** for any directory you've "discovered," you can list every file in it from memory immediately after, and state which ones are documentation-only vs. runtime-consumed.

---

## 7. Architecture Discovery

**Purpose.** The specific procedure for understanding *how the pieces fit together* before modifying architecture, distinct from §6's file-level discovery.

**Mandatory procedure when a task touches architecture:**
1. Identify which of the four FSD layers (§8) owns the concern.
2. Trace the data flow for that concern end to end: entity schema → store → screen → (if applicable) repository persistence. E.g., for Pipeline: `src/entities/Pipeline/model/schema.ts` → `src/shared/stores/pipeline-store.ts` → `src/features/mvp/screens/pipeline-screen.tsx` (via `toFlowNodes`/`toFlowEdges`/`fromFlow` adapters to `@xyflow/react`) → `src/shared/repositories/local-storage-repository.ts`.
3. Identify every place the same concept is described in prose (docs/domain, docs/mvp, docs/ux, orchestrator, skills) and note whether they agree with the code trace from step 2.
4. Only then propose a change, stating explicitly which layer(s) it touches and why it doesn't leak across the boundaries in §8.2/§9.4.

**Known architecture facts worth internalizing up front** (all verified against code):
- The domain layer (`src/entities/`) has zero imports of React, Zustand, or `@xyflow/react` — confirmed clean.
- Only `Project`, `Product`, `Architecture`, `Pipeline` are full aggregate roots with `status` + `createdAt/updatedAt/version`. `Node`/`Edge` are pipeline-nested value-ish entities (version only). `Framework`/`KnowledgeModule`/`Model`/`Prompt` are catalog/reference entities (version only, no lifecycle — matches the explicit note in `docs/domain/ENTITY_LIFECYCLE.md` that a `deprecated` status was deliberately left unimplemented "чтобы не усложнять Domain Layer до появления реального требования"). `Review`/`Run` are append-only/event-shaped (partial timestamps only).
- `LocalStorageProjectRepository` (`src/shared/repositories/local-storage-repository.ts`) exposes `upsertX`/`deleteProject`-style methods, but the actual Zustand stores (e.g. `project-store.ts`) exclusively manipulate the `RepositorySnapshot` directly via `setSnapshot` — confirmed by tracing every call site (§63 debt item 5, clarified 2026-07-03): the per-entity `upsertX` methods are called by zero production code today. This is intentional, documented forward-compatibility surface for a future network-backed repository (§8.7), not accidental duplication — see the doc comment on `ProjectRepository` in `src/shared/repositories/types.ts`. Before extending either surface, check whether the store already has its own path for the same mutation.
- Only `src/features/mvp/` is implemented. The other six feature directories (`ai-architecture`, `pipeline-delivery`, `playground`, `prd`, `product-discovery`, `visual-pipeline`) are literally `export {};` — planned decomposition targets, not currently working code. Do not assume any logic exists there.

**Definition of Done:** you can draw the full data-flow trace for the entity/feature you're changing from memory, and you know which prose documents claim to describe it.

---

## 8. Software Architecture

**Purpose.** Document the actual layered architecture in force today, as implemented — not the aspirational one in `knowledge-import/`.

**8.1 Layering.** The codebase follows Feature-Sliced Design (FSD):

```
src/
├── app/          Next.js App Router entry (layout, page, providers, globals.css)
├── entities/     Pure domain model — 12 entity folders + shared.ts primitives
├── features/     User-facing behavior units — only `mvp` is implemented; 6 others are stubs
├── shared/       Cross-cutting: ui/, stores/, repositories/, simulation/, runtime/, llm/, prompts/, evaluation/, model/, config/, lib/, hooks/(empty), api/(empty)
└── widgets/      Empty (`.gitkeep` only) — reserved for composite cross-feature UI blocks
```

**8.1.1 The Production Pipeline Runtime (added 2026-07-03).** `src/shared/runtime/`, `src/shared/llm/`, `src/shared/prompts/`, `src/shared/evaluation/` implement a real graph executor, separate from and now used *instead of* `src/shared/simulation/` in Playground (§12 below covers this in detail):
- `runtime/pipeline-executor.ts` — `executePipeline(pipeline, input, options)`, topological execution, branching via `Edge.condition`, retry, events, logs, produces a real `Run`.
- `runtime/stage-registry.ts` + `runtime/mock-stage.ts` — `NodeType → StageHandler` registry; Mock Stage is the default, no real network calls.
- `runtime/real-stage.ts` — real handlers for `llm`/`agent` (calls an `LLMProvider`, renders a prompt from the Prompt Registry), real deterministic `validation` (schema-checks `CallAnalysisSummarySchema`), honest stand-ins for `tool`/`human_review` (no real integration/reviewer exists).
- `llm/` — `LLMProvider` interface, `MockLLMProvider` (default everywhere), `OpenAiCompatibleProvider` (real, only used if `OPENAI_API_KEY` is explicitly configured via `configureFromEnv()` — never automatic). **Correction, 2026-07-04 (v2.0 audit):** `configureFromEnv()` exists and is tested, but no screen actually calls it -- Playground/Analytics call `defaultLLMProviderRegistry` directly. Even if a screen did call it, it would still be a no-op in practice: Playground/Analytics are `"use client"` components, and Next.js never inlines a non-`NEXT_PUBLIC_` variable like `OPENAI_API_KEY` into the client bundle, so `process.env.OPENAI_API_KEY` reads `undefined` there regardless of what's set on the server. Enabling a real provider today would require either exposing the key via `NEXT_PUBLIC_` (a real secret-exposure regression, violates §49 SEC-1) or moving LLM calls behind a server API route (§10 SB-1, not built). Until one of those happens, treat "real if `OPENAI_API_KEY` is configured" as aspirational, not actually reachable from the UI — Settings' Runtime card states this plainly.
- `prompts/prompt-registry.ts` — versioned, immutable prompt bodies keyed by `Prompt.id`; `seed-prompts.ts` has real templates for the two demo prompts.
- `evaluation/` — Golden Dataset mechanism (`ILLUSTRATIVE_CALL_ANALYSIS_DATASET` — synthetic, not real customer data, §26), deterministic scorers, `evaluateGoldenDataset()`, `compareRuns()`.

**8.2 Layer dependency rule (mandatory, currently upheld — keep it that way):** `entities` → nothing in `src/` except `shared.ts`. `features` → may import `entities` and `shared`. `shared/ui` → must not import `features` or route/business logic. `app` → imports `features`. Violating this in either direction is an architecture regression, not a style nit.

**8.3 Why only `mvp` is implemented.** The six empty feature folders (`ai-architecture`, `pipeline-delivery`, `playground`, `prd`, `product-discovery`, `visual-pipeline`) read as the intended eventual home for logic currently living monolithically inside `src/features/mvp/screens/*.tsx`. For example, `pipeline-screen.tsx`'s React-Flow adapter logic is a natural future `visual-pipeline` feature; `playground-screen.tsx`'s run/simulate logic is a natural future `playground` feature. **Do not build new logic directly into these empty stubs speculatively** — only migrate code into them as part of a deliberate, documented decomposition (ADR-worthy, §41), because splitting prematurely without a second consumer violates §2's simplicity principle.

**8.4 The MVP shell.** `src/features/mvp/mvp-shell.tsx` is the entire application shell: sidebar navigation (6 items: Projects/Product/Architecture/Pipeline/Playground/Settings, matching `docs/ux/NAVIGATION.md`'s closed list exactly), header, workspace router driven by the `?view=` query parameter (`MvpView` type in `src/features/mvp/types.ts`), and an optional right-hand AI Assistant inspector panel. `src/features/mvp/selectors.ts` provides `getProjectBundle()`, the single function that joins a selected project to its linked product/architecture/pipeline/reviews/runs — **this is the one place** that understands cross-entity joins for rendering; do not re-implement joining logic ad hoc in a screen component.

**8.5 State management.** Eight Zustand stores under `src/shared/stores/` (updated 2026-07-04 — was seven, and "no middleware" was true, until `execution-trace-store.ts` adopted `persist`, the first use of Zustand middleware in this repository; every other store below is still a plain `create<T>()`):
- `repository-store.ts` — holds the loaded `RepositorySnapshot | null` and `selectedProjectId`; persists only the selected-project id to `localStorage` under key `"ai-product-studio.selected-project-id.v1"`.
- `project-store.ts` — `createProject` (also auto-creates a companion `Product` and links it), `updateProjectDetails`, `deleteProject` (cascades to remove linked products/architectures/pipelines/runs/reviews — fixed 2026-07-03, §63 debt item 4), `duplicateProject` (name suffixed "Copy", status forced to `draft`, does not duplicate product/architecture/pipeline).
- `product-store.ts`, `architecture-store.ts` — thin `updateX(entity)` writers into the snapshot, bumping `updatedAt`.
- `pipeline-store.ts` — the most complex store: real undo/redo history per pipeline capped at 50 entries (`.slice(-50)`), `addNode`/`deleteNode` (cascades to remove connected edges)/`duplicateNode` (offsets position `+40,+40`, appends " Copy"), `setNodesAndEdges`.
- `playground-store.ts` — `input` (seeded with a sample Russian CRM-integration transcript), `selectedRunId`, `addRun` (prepends to both the snapshot's `runs` and the project's `playgroundRunIds`).
- `ui-store.ts` — `theme` (default `"dark"`), `sidebarCollapsed` (default `false`), `assistantOpen` (default `true`); `setTheme` directly toggles the `dark` class on `document.documentElement`.
- `execution-trace-store.ts` (added 2026-07-03 for the Execution Inspector, §M.1/§M.2) — `tracesByRunId: Record<Run.id, ExecutionEvent[]>`, `recordTrace`, `getTrace`. Persisted to `localStorage` under `"ai-product-studio.execution-traces.v1"` via Zustand's `persist` middleware (2026-07-04, v2.0 audit item P0 #1) — a Run's `RepositorySnapshot` record already survived a reload while its trace didn't, which was the most confusing gap found in that audit. Capped at the 20 most-recently-recorded runs (`withCappedTrace`, oldest evicted first) so persisting doesn't grow `localStorage` unboundedly.

**8.6 Persistence.** `LocalStorageProjectRepository` (`src/shared/repositories/local-storage-repository.ts`) is the sole `ProjectRepository` implementation, storage key `"ai-product-studio.repository.v1"`. It is SSR-safe (returns a cloned demo snapshot when `window === undefined`), validates every load/save through a combined Zod `RepositorySnapshotSchema`, and seeds from `demo-data.ts` on first run or reset. `RepositorySnapshot` holds ten readonly arrays: `projects, products, architectures, pipelines, runs, reviews, frameworks, knowledgeModules, models, prompts`.

**8.7 [CANONICAL DECISION] — replacing Local Storage.** When a real backend is built, it MUST implement the existing `ProjectRepository` interface (`load/save/reset/upsertProject/deleteProject/upsertProduct/upsertArchitecture/upsertPipeline/upsertRun`) rather than inventing a new contract, so that no screen or store needs to change. This is already the documented intent (`docs/mvp/MVP_ARCHITECTURE.md`) and this document ratifies it as binding.

**Anti-patterns:**
- Adding a new top-level `src/` directory outside the four established layers.
- Bypassing the Zustand stores by reading/writing `localStorage` directly from a screen component.
- Building out an empty `features/*` stub before there are two real consumers of its logic.

**Definition of Done:** a new feature lives in exactly one FSD layer per concern, imports only downward (`app → features → entities/shared`), and any new persistence need goes through `ProjectRepository`, not a bespoke storage call.

---

## 9. Domain Driven Design

**Purpose.** Codify the entity-modeling rules already established in `docs/domain/ENTITY_GUIDELINES.md` and enforce them as binding, not advisory.

**9.1 Entity file structure (mandatory for every entity).**
```
src/entities/<Name>/
├── README.md          — purpose, storage, lifecycle, validation rules, in prose
└── model/
    ├── factory.ts      — createX(...) — defaults every optional field, generates id/timestamps/version
    ├── schema.ts        — Zod schema, single source of truth for validation
    └── types.ts          — TypeScript type inferred from or matching the schema
```
All 12 entities (`Architecture, Edge, Framework, KnowledgeModule, Model, Node, Pipeline, Product, Project, Prompt, Review, Run`) follow this exactly today. Any new entity MUST too.

**9.2 Shared primitives** (`src/entities/shared.ts`) — reuse these, never redefine an ad hoc ID/date/version type in a new entity:
```ts
EntityIdSchema      = z.string().min(1)
IsoDateTimeSchema   = z.string().datetime()
VersionSchema       = z.string().min(1)
ReviewStatusSchema  = z.enum(["not_reviewed","approved","requires_changes","rejected"])
LifecycleStatusSchema = z.enum(["draft","in_progress","review","ready","completed","archived"])
createEntityId(prefix) = `${prefix}_${crypto.randomUUID()}`
createTimestamp()      = new Date().toISOString()
```

**9.3 Aggregate map** (from `docs/domain/ENTITY_RELATIONSHIPS.md`, verified against `demo-data.ts`):
```
Project ── productId → Product
        ── architectureId → Architecture
        ── pipelineId → Pipeline
        ── playgroundRunIds[] → Run
        └── reviewIds[] → Review
Product ── projectId → Project;  frameworkIds[] → Framework
Architecture ── projectId → Project;  productId → Product;  modelIds[] → Model
Pipeline ── projectId → Project;  architectureId → Architecture;  nodes[] (Node, nested);  edges[] (Edge, nested)
Run ── pipelineId → Pipeline
Review ── targetId → (Product|Architecture|Pipeline|Run|Project);  reviewerModuleId → KnowledgeModule
Prompt ── ownerModuleId → KnowledgeModule
KnowledgeModule ── frameworkIds[] → Framework
```
Rule: cross-aggregate references are always by `EntityId` string, never by embedding the referenced object. Only `Node`/`Edge` are embedded (inside `Pipeline`), because they have no independent lifecycle outside their parent pipeline.

**9.4 Lifecycle status per entity** (from `docs/domain/ENTITY_LIFECYCLE.md`, cross-checked against actual `*StatusSchema` code):
- `Project.status` (`ProjectStatus`, its own enum, not `LifecycleStatusSchema`): `draft → discovery → product_ready → architecture_ready → pipeline_ready → testing → completed → archived`.
- `Product.status`, `Architecture.status`, `Pipeline.status` (all use the shared `LifecycleStatusSchema`): `draft → in_progress → review → ready → completed → archived`.
- `Run.status` (`RunStatus`): `queued → running → succeeded` / `queued → running → failed` / `queued → cancelled`.
- `Review.status` (`ReviewStatusSchema`): `not_reviewed → approved` / `not_reviewed → requires_changes` / `not_reviewed → rejected` / `requires_changes → approved`.
- `Edge, Framework, KnowledgeModule, Model, Node` — **no lifecycle field at all**, by deliberate documented choice. Do not add one speculatively. `Prompt` is the exception as of 2026-07-03: it now has `status: LifecycleStatus` (same six-value enum as Product/Architecture/Pipeline), added specifically to close the prompt-gating gap in §16 — see §63 debt item 7 (resolved).

**9.5 Mandatory rules:**
- **DDD-1.** New optional fields and new enum values are additive changes and are always allowed — but the doc (`README.md` + relevant `docs/domain/*.md`) must be updated in the same change.
- **DDD-2.** A new entity requires updates to `ENTITY_RELATIONSHIPS.md` and `ENTITY_LIFECYCLE.md` before or in the same commit as the code — not after.
- **DDD-3.** Complex multi-step transition logic (e.g., "can this Project move to `architecture_ready`?") belongs in orchestration logic (§23), never inside a `factory.ts`. Factories only construct minimally valid entities.
- **DDD-4.** Naming: entity directories/types PascalCase; fields camelCase; enum values snake_case; factories `createEntityName`. This is already 100% consistent across the 12 entities — keep it that way.
- **DDD-5.** All external/untrusted data (API responses, localStorage reads, user input crossing a boundary) passes through the Zod schema before being treated as the typed entity. Never cast with `as Product` etc.

**Anti-patterns:**
- Storing a `@xyflow/react` node object as if it were the domain `Node` — the adapter direction is always domain → UI representation, never the reverse (`docs/domain/ENTITY_RELATIONSHIPS.md`, confirmed in `pipeline-screen.tsx`'s `toFlowNodes`/`fromFlow` functions).
- Adding a `deprecated` status to `Framework`/`Model`/etc. without a concrete requirement — this was explicitly deferred once already; don't re-litigate it without a real need.
- One entity per screen (explicitly forbidden by `ENTITY_GUIDELINES.md`).

**Definition of Done:** a new or changed entity has all three `model/` files internally consistent, a `README.md` that matches them, and corresponding `docs/domain/*.md` updates — verifiable by re-reading all four files back to back.

---

## 10. System Boundaries

**Purpose.** State clearly what this application is and is not responsible for, to prevent scope creep into areas `knowledge-import/` envisions but that are explicitly out of scope for the current system.

**In scope today:** client-rendered Next.js app, Local-Storage persistence, a simulated (non-real) AI runtime (§12.4), a visual pipeline editor backed by `@xyflow/react`, a design system, and static demo data.

**Explicitly out of scope today** (from `docs/mvp/KNOWN_LIMITATIONS.md`, still accurate as verified): real AI runtime / OpenAI or any LLM provider integration, backend server, authentication, multi-user support, cloud sync, billing, a marketplace, production runtime.

**Boundary rules:**
- **SB-1.** Nothing in `src/` may assume a backend exists. Any code that would require one (auth, multi-user, real model calls) is a distinct future initiative, not an incremental addition to the current MVP shell.
- **SB-2.** The Simulation Engine (§12.4) is a stand-in, not a foundation — do not build production features (billing, rate limiting, real cost tracking) on top of its fabricated numbers.
- **SB-3.** `skills/*` knowledge modules are consumed by *path reference* (`KnowledgeModule.path`), not executed — there is no code anywhere that parses or runs the markdown content of `skills/senior-product-manager/*.md` at runtime. Do not assume otherwise; if execution semantics are wanted, they must be designed (§20–23), not assumed to already exist.

**Definition of Done:** a proposed feature can be checked against this list in one sentence — "does it require a capability declared out of scope, and if so, is that being addressed by design, not by ad hoc addition?"

---

## 11. AI Communication Platform Architecture

**Purpose.** Describe the target-state architecture for the platform layer above the current MVP shell, reconciling `knowledge-import/19_System_Architecture.md` with what's implemented.

**11.1 Layered target architecture** (from `19_System_Architecture.md`, unimplemented but directionally binding): `Presentation Layer → Application Layer → AI Orchestrator → Domain Services → Persistence Layer → Infrastructure`. Map this onto the current codebase: Presentation = `src/app` + `src/features` + `src/shared/ui`; Application = `src/features/mvp` orchestration today, eventually the individual feature slices; AI Orchestrator = **not yet implemented**, specified only in `orchestrator/*.md` (§23); Domain Services = `src/entities`; Persistence = `src/shared/repositories` (Local Storage today, `knowledge-import/13_Database_Schema.md`'s Postgres schema sketch for later); Infrastructure = not yet provisioned (no Kubernetes/deployment config exists in this repo).

**11.2 Named platform modules** (from `19_System_Architecture.md`'s Platform Modules table, cross-referenced to implementation status):
| Module | Responsibility | Implementation status |
|---|---|---|
| Product Studio | Product Discovery, PRD | Partially implemented as `product-screen.tsx` (read-mostly, non-interactive tabs — §31.10) |
| Prompt Studio | Prompt-as-code lifecycle | Not implemented; `Prompt` entity exists but has no editor UI |
| AI Agent System | Multi-agent execution | Not implemented; `orchestrator/`+`skills/` are spec-only |
| Pipeline Builder | Visual pipeline construction | Implemented — `pipeline-screen.tsx` + `@xyflow/react` (§12) |
| Pipeline Lab | Experimentation/evaluation | Not implemented; `Run`/`Playground` is a much simpler stand-in (§12.4) |
| Test Analytics | Enterprise observability, KPI dashboards | Not implemented |
| Knowledge Base | RAG / knowledge management | Not implemented; `KnowledgeModule` entity is a thin catalog record only |
| Version Control | Artifact versioning | Not implemented beyond a per-entity `version: string` field with no history |

**11.3 Technology stack** (verified from `package.json` against `knowledge-import/19_System_Architecture.md`'s named stack): Next.js 15, React 19, TypeScript (strict), Zod 4, Zustand 5, `@xyflow/react` 12, Tailwind 3, `framer-motion`, `lucide-react` — matches the frontend half of the target stack exactly. PostgreSQL, Redis, Kubernetes, OpenTelemetry, Object Storage, Vector Database are all target-state and **not present in this repository in any form** (no Docker/K8s manifests, no ORM, no queue client). Do not write code that assumes any of these exist.

**Decision rule:** when a task requires platform capability from §11.2 that isn't implemented, treat it as a distinct initiative requiring its own Feature Specification (§37) — do not shoehorn Prompt Studio-scale functionality into a Playground bugfix.

---

## 12. AI Pipeline Architecture

**Purpose.** Describe how AI pipelines are modeled and executed today. **Updated 2026-07-03: a real Pipeline Executor now exists and powers Playground** (§12.4a) — the Simulation Engine (§12.4) is no longer the active execution path, though it remains in the codebase and is still exercised by its own tests.

**12.1 The domain model of a pipeline.** `Pipeline { id, projectId, architectureId, status, nodes: Node[], edges: Edge[], layout?, createdAt, updatedAt, version }` (`src/entities/Pipeline/model/schema.ts`). It is explicitly independent of `@xyflow/react` — the UI is an adapter, never the source of truth (`docs/domain/DOMAIN_MODEL.md`, `docs/mvp/MVP_ARCHITECTURE.md`).

**12.2 Node types (10, exact enum from `src/entities/Node/model/types.ts`, matching `docs/ux/SCREEN_PIPELINE.md`'s UX spec exactly):** `agent | llm | function | router | tool | store | validation | human_review | input | output`. Each `Node` carries `{ id, type, name, description?, inputPorts: NodePort[], outputPorts: NodePort[], modelId?, promptId?, temperature? (0–2), tools: string[], metadata: Record<string,string>, position?, version }`.

**12.3 Edges.** `Edge { id, sourceNodeId, targetNodeId, sourcePortId?, targetPortId?, condition?: { field, operator, value, description? }, version }` — no lifecycle, embedded value object. `condition` was a free-text `expression: string` until 2026-07-03; it is now structured (`operator` one of `eq|neq|gt|gte|lt|lte`), matching the only real use case in the repository (the demo pipeline's confidence-based validation → store/human-review split, e.g. `{field: "confidence", operator: "gte", value: 0.72}`). **An evaluator now exists**: `src/shared/runtime/topology.ts`'s `evaluateCondition(edge, payload)`, used by the real Pipeline Executor (§12.4a) to decide which branch of a fan-out actually runs.

**12.4a The Production Pipeline Runtime — the real, active execution path (added 2026-07-03).** `executePipeline(pipeline, input, options)` in `src/shared/runtime/pipeline-executor.ts`:
- Executes nodes in topological order (`topology.ts`, Kahn's algorithm; throws `CyclicPipelineError` for a cyclic graph).
- A node with multiple incoming edges only runs once at least one is "active" (unconditional, or its `Edge.condition` evaluates true against the upstream node's real output); a node with zero active incoming edges is marked `"skipped"`, which cascades forward — this is genuine conditional branching, not a simulation of it.
- Stage handlers are resolved per `NodeType` from a `StageRegistry` (§8.1.1): `defaultStageRegistry` uses Mock Stage (deterministic, offline, no network calls) everywhere; `realStageRegistry(deps)` (`real-stage.ts`) additionally makes `llm`/`agent` nodes call a real `LLMProvider` (mock by default; a real one is not actually reachable from any client screen today, see §8.1.1's 2026-07-04 correction) with a prompt rendered from the Prompt Registry, and makes `validation` a real deterministic schema check.
- Retries (`retry.ts`, `withRetry`), execution events (`stage_started`/`stage_completed`/`stage_failed`/`stage_retrying`/`stage_skipped`/`run_started`/`run_completed`/`run_failed`), and Pipeline Logs (`RunLog` shape, reused from the domain model, not a new type) are all real, not simulated.
- Produces a genuine `Run` entity via `createRun()`, now including `Run.evidence` (citation quotes aggregated from stages that produced them, §14.3) and `Run.costUsd`/`latencyMs` summed from stage metrics.
- **`playground-screen.tsx` calls this, not `simulatePipelineRun()`, as of 2026-07-03.** Verified in-browser: a full run of the real 8-node demo pipeline reaches `status: "succeeded"` with real tokens/cost/latency/confidence metrics.
- Still not a full production runtime: the default `LLMProvider` is mock (no real model call happens unless explicitly configured), `tool` nodes have no real integration, `human_review` auto-approves (no real reviewer UI exists).

**12.4 The Simulation Engine — legacy, no longer the active execution path (`src/shared/simulation/simulation-engine.ts`).** Kept for its own tests and as a reference for the heuristics it introduced (several were reused in the real Runtime, e.g. `confidenceFromTemperature`, now shared via `src/shared/model/confidence.ts`). Stated precisely so no one mistakes old claims about it for current Playground behavior:
- Finds the pipeline's summary node: `pipeline.nodes.find(n => n.type === "llm" && n.promptId === "prompt_call_summary")`. If found, output is the real `CallAnalysisSummarySchema` shape (§14.3, `src/shared/model/call-analysis-summary.ts`); if not found (any pipeline not shaped like the call-analysis reference case), output falls back to the old generic `{summary, needs, risks, nextAction}` shape.
- Token estimate: `max(420, round(input.length * 2.8 + nodeCount * 180))` — pure string-length arithmetic, not a tokenizer. Unchanged.
- Latency and cost now scale by a **model multiplier** looked up from the summary node's `modelId` (`model_fast: 0.35`, `model_reasoning: 1`, unknown ids default to `1`) — `Node.modelId` now has a real, visible effect for the first time. Still synthetic: this is a static lookup table, not a real pricing model.
- `confidence` is now `confidenceFromTemperature(summaryNode?.temperature)` — a heuristic mapping (`0.95 - temperature*0.15`, clamped to `[0.5, 0.95]`) that makes `Node.temperature` visibly affect the result, replacing the old hardcoded `0.86`. Still a heuristic, not a calibrated model.
- "Needs"/"Risks" keyword-match fallback (`"crm"`, `"стоим"`/`"cost"`) is retained **only** in the generic fallback path, for pipelines without a recognized summary node.
- Every run still returns `status: "succeeded"` — there is still no simulated failure path at all.
- Logs are still emitted in node **array order**, not actual graph execution/topological order — do not use simulated logs to reason about real execution order. One additional log line now records which model/prompt/temperature the summary node used.
- **Still unused by the simulator**: `Node.metadata`, `Node.tools`, and `modelId`/`promptId`/`temperature` on any node that is *not* the recognized summary node (e.g., the demo pipeline's `node_validation` step, whose `promptId: "prompt_quality_check"` still has zero effect). This is a narrower, more honest limitation than before, not a full fix — communicate it precisely.

**12.5 Target real pipeline (bridging to §3.3) — largely realized.** The demo pipeline already IS shaped close to the call-analysis to-be pipeline from `pdf-notes.txt`, and the real Executor (§12.4a) now actually runs it end to end: `Input → Router/Tool (fan-in) → LLM (structured summary) → Validation (real schema check) → Store or Human Review (branch on confidence) → Output`. Not yet real: the deterministic-regex normalization step from the to-be design (§13's "Non-AI First" principle) isn't a distinct node in the demo pipeline yet, and `tool`/`human_review` remain honest stand-ins (§12.4a).

**Anti-patterns:**
- Treating **Simulation Engine** output as evidence about pipeline correctness — it still only reflects input string length and keyword checks, nothing about the actual graph. (The real Executor's output, by contrast, genuinely does reflect the graph — don't conflate the two.)
- Adding real-looking cost/latency/confidence numbers to the Simulation Engine to "make demos better" — that manufactures false evidence (violates §2 principle 5, R-010). The real Executor's metrics come from an actual (mock-by-default) provider call, not fabricated ones.
- Assuming the real Executor's default (Mock Stage + mock `LLMProvider`) run reflects real model quality — it doesn't; only a run using `realStageRegistry` with `configureFromEnv()`'s real provider does.

**Definition of Done:** anyone building against "the pipeline" can state, without checking code, which of three things they mean: the domain model (always real, load-bearing), the Production Pipeline Runtime (real execution, mock or real LLM calls depending on configuration — this is what Playground uses), or the Simulation Engine (fake, legacy, no longer wired to any screen).

---

## 13. Pipeline Design

**Purpose.** Give concrete authoring rules for pipeline structures, blending the implemented domain constraints with the architect skill's `PIPELINE_DESIGN.md` standards (spec-only today, binding for anything built toward a real runtime).

**Mandatory structural rules (enforced by domain validation today):**
- Every `Edge` must reference `Node`s that exist in the same `Pipeline.nodes` array (`docs/domain` validation rule, not yet enforced by a runtime check beyond Zod's shape validation — enforcing referential integrity is open technical debt, §63).
- Orphan nodes are permitted only while `Pipeline.status === "draft"`.
- Self-loops are forbidden for any pipeline with `status !== "draft"`.

**Design standards for a real runtime** (from `skills/senior-ai-solution-architect/PIPELINE_DESIGN.md`, apply once execution is implemented):
- Every pipeline step needs: `step_id`, purpose, input schema, output schema, owner component, model/rule dependency, validation, retry policy, fallback, failure modes, telemetry.
- Fallback hierarchy, in order: (1) retry same model on transient error, (2) alternative model/provider, (3) simplified output, (4) cached response if still valid, (5) route to Human Review, (6) fail safely (never fail silently).
- Validation types to apply after any AI-produced output: schema validation, business rule validation, safety validation, consistency validation, confidence threshold check.
- Human Review triggers: high risk, low confidence, validation failure, policy uncertainty, high business impact — this exactly matches the demo pipeline's `node_validation → node_review` conditional edge (`confidence < 0.72`).
- State rule: "State должен быть explicit, versioned и recoverable. Нельзя хранить critical state только в prompt context." — i.e., never rely on an LLM's context window as your only source of pipeline state; persist it in the domain model.

**Decision rule for AI vs. non-AI steps** (architect `DECISION_ENGINE.md` D-001, "Non-AI First"): if a Rules Engine or deterministic code (e.g., regex normalization, as used in the call-analysis to-be pipeline for phone numbers/prices/profanity) can meet the quality bar, do not use an LLM node for that step. This is not a suggestion — the call-analysis case's core lesson (`pdf-notes.txt` §3.3) is that using an LLM for what should be code cost real money (450k₽/month) and produced worse consistency than a narrow regex + narrow LLM pass would.

**Anti-patterns** (from `skills/senior-ai-solution-architect/ANTI_PATTERNS.md`, directly applicable here):
- **AP-001 LLM Everywhere** — using an LLM node where a `function` node (regex/deterministic code) would do, exactly the as-is mistake documented in §3.3.
- **AP-004 Free-form Output for System Handoff** — an `llm` node whose output feeds a `store` or `output` node must produce structured output (see §14.3), never raw prose, when the consumer is a system rather than a human.
- **AP-006 No Fallback** — any `llm` or `agent` node without a fallback path defined in `metadata`.
- **AP-007 Hidden State in Prompt** — do not encode pipeline state (e.g., "which stage are we on") only inside a prompt string; it belongs in the `Node`/`Run` domain model.

**Definition of Done:** every new `llm`/`agent` node has a stated input/output schema, a validation node downstream if its output feeds a machine consumer, and an explicit fallback or human-review path, or a written justification for why one is unnecessary.

---

## 14. Pipeline DSL

**Purpose.** State plainly that no formal Pipeline DSL exists yet, and define minimum requirements for one before it's built — this repository does not currently have this, and treating the informal shapes below as if they were a real DSL is a common mistake to avoid.

**14.1 Current state.** "Pipeline DSL" today is: the `Node`/`Edge` Zod schemas (structural DSL for the graph shape) plus free-text `metadata: Record<string,string>` per node (e.g. the demo pipeline uses `metadata.threshold = "0.72"`, `metadata.sla = "15m"`, `metadata.retention = "90d"`, `metadata.format = "json"` — all untyped strings, not a schema, still open debt) plus a **structured** `Edge.condition: { field, operator, value, description? }` (§12.3, §63 debt item 6 resolved). **An evaluator now exists** (`src/shared/runtime/topology.ts`'s `evaluateCondition`, added 2026-07-03) and is used by the real Pipeline Executor (§12.4a) to decide branching — the condition shape is no longer purely representational. `Node.metadata` remains untyped and unused by the Executor.

**14.2 Resolved: `Edge.condition` is now structured, not a bespoke expression language.** `EdgeConditionOperatorSchema = z.enum(["eq","neq","gt","gte","lt","lte"])`, matching the only real use case seen in `demo-data.ts` (a numeric confidence threshold comparison) exactly — per §2 principle 6 (simplicity first), the smallest structure that covers real cases was chosen over a general-purpose expression grammar. `Node.metadata`'s untyped strings remain open debt (§63 debt item 6, partially resolved) — the same treatment (typed fields over free-text) should apply if/when a concrete second use case for one of those metadata keys appears.

**14.3 Structured output schema requirement — IMPLEMENTED 2026-07-03.** Any future DSL for `llm`/`agent` node output MUST support the structured shape already proven necessary by the real business case (§3.3): `{ кто, тип_контакта, потребность, бюджет, срок, способ_оплаты, вопросы[], статус, действие, цитаты[] }`. This is now a real Zod schema, `CallAnalysisSummarySchema` in `src/shared/model/call-analysis-summary.ts` (populating the previously-empty `src/shared/model/` scaffold directory, §5 RI-1) — `кто`/`потребность`/`статус`/`действие` and a non-empty `цитаты` are required; `бюджет`/`срок`/`способ_оплаты`/`вопросы` are optional/may-be-empty. The Simulation Engine (§12.4) now produces this shape for any pipeline containing a node with `promptId: "prompt_call_summary"`. Note the `цитаты[]` (quotes/citations) field is enforced **non-empty by the schema itself** — the to-be pipeline requires every key field to be grounded in a literal quote from the source transcript, which is a controllable, testable form of hallucination mitigation (`skills/senior-ai-solution-architect/AI_PATTERNS.md` pattern `structured-outputs`, and `ANTI_PATTERNS.md` AP-004). Any future DSL for AI node output schemas should make citation/grounding a first-class, not bolted-on, concept — this schema already does.

**Decision rule:** do not design a general Pipeline DSL in the abstract. Design it against the concrete node/edge/output needs of the call-analysis reference pipeline (§12.5) first; generalize only once a second real pipeline needs something the first didn't anticipate.

**Definition of Done:** before claiming "the pipeline DSL supports X," you can point to a parser or evaluator in `src/` that actually implements X — today, that check will almost always fail, which is the correct, honest answer.

---

## 15. Prompt Engineering

**Purpose.** Establish that prompts are treated as versioned engineering artifacts, not throwaway strings, per `knowledge-import/04_Prompt_Studio.md` and the real evidence from `pdf-notes.txt`.

**Current implementation state.** The `Prompt` entity (`src/entities/Prompt/model/schema.ts`) is a thin catalog record: `{ id, name, purpose: PromptPurpose, description (required, non-empty), ownerModuleId?, version }` where `PromptPurpose = "instruction"|"evaluation"|"routing"|"extraction"|"generation"|"review"`. There is **no prompt body/text field, no template variables, no rendering engine anywhere in the codebase.** The two seeded demo prompts (`prompt_call_summary`, `prompt_quality_check`) exist only as metadata records pointing at a description string — not an actual runnable prompt.

**Mandatory rules once real prompt bodies are introduced:**
- **PE-1.** Every prompt is versioned independently of the pipeline/node that references it (already true structurally — `Node.promptId` is a loose reference, not an embed).
- **PE-2.** Structure every prompt from the block types in `knowledge-import/04_Prompt_Studio.md`: System Role, Business Context, Task, Constraints, Output Schema, Examples, Evaluation Rules, Safety Rules. Do not write a single monolithic prompt string — this is precisely the as-is mistake in `pdf-notes.txt` (one 315-line prompt, "V3," doing 5 unrelated jobs at once: role assignment, boundary detection, phone/number handling, profanity masking, content-preservation).
- **PE-3.** Variables use `{{snake_case}}` interpolation syntax (e.g. `{{customer_name}}`, `{{transcript}}`), typed as String/Number/Boolean/JSON/File per `04_Prompt_Studio.md`.
- **PE-4.** A prompt referenced by a production pipeline (`Pipeline.status` beyond `draft`) must have passed evaluation (§18) — mirrors `04_Prompt_Studio.md`'s release rule: "Only approved prompts may be referenced by production pipelines."

**Anti-pattern, directly evidenced in this repository's own business case:** a single oversized prompt handling multiple unrelated sub-tasks with repeated defensive instructions (the as-is V3 prompt repeats "не теряй контент" ~12 times because it has no other way to guard against 5 different failure modes in one call). The fix, already planned in `pdf-notes.txt` Этап 2: split into (a) deterministic code for anything regex-solvable (phone numbers, prices, codes, profanity), (b) a narrow LLM prompt only for the residual ambiguous cases (boundaries/roles), each independently testable and versioned.

**Definition of Done:** a prompt used in any node has its own version, a defined purpose, and — once bodies exist — passes the block-structure rule above rather than being one undifferentiated string.

---

## 16. Prompt Lifecycle

**Purpose.** Define prompt state transitions, adapting `knowledge-import/04_Prompt_Studio.md`'s lifecycle to entities that actually exist.

**Full conceptual lifecycle** (`knowledge-import/04_Prompt_Studio.md`, spec-only, not 1:1 implemented): `Create → AI Draft → Review → Version → Evaluation → Approval → Pipeline Integration → Production`.

**Implemented lifecycle (as of 2026-07-03, §9.4, §63 debt item 7 — RESOLVED):** `Prompt.status` now exists, reusing the shared six-value `LifecycleStatusSchema` (`draft → in_progress → review → ready → completed → archived`) rather than a bespoke 8-stage enum — this maps the richer spec onto the same status vocabulary already used by Product/Architecture/Pipeline, trading some conceptual granularity for consistency with the rest of the domain model (§2 principle 6, simplicity first). `ReviewTargetType` now includes `"prompt"`, so a `Review{targetType: "prompt"}` record is representable.

**Remaining gap, explicitly not closed by this change:** having the fields does not yet mean a runtime gate exists. Nothing in `src/` currently *checks* that a `Node.promptId` referenced by a non-draft `Pipeline` points at a `Prompt` with `status !== "draft"` and an approved `Review`. Until that check is implemented (naturally, as part of the orchestrator's `gate_pipeline_complete`, §23.3), continue to enforce this manually in review: do not wire a `promptId` into a non-draft `Pipeline` without its `Prompt.status` being at least `"ready"` and a corresponding approved `Review{targetType: "prompt"}` existing.

**Definition of Done:** a change that introduces a new production-bound prompt sets `Prompt.status` accordingly and, once the Review gate exists in code, has a passing `Review{targetType: "prompt"}` — until then, the manual-review requirement above still applies.

---

## 17. Prompt Versioning

**Purpose.** Apply the general Version Control rules (`knowledge-import/11_Version_Control.md`) specifically to prompts.

**Rules:**
- **PV-1.** Semantic versioning: Major = breaking change to required variables or output schema; Minor = new optional variable or improved wording without breaking callers; Patch = typo/formatting fix. Example format from spec: `1.4.2`.
- **PV-2.** "Released artifacts are immutable" — once a prompt version is referenced by a `ready`/`completed` pipeline, do not edit that version's body in place; publish a new version and re-point the reference.
- **PV-3.** Every version needs a change summary and a parent-version pointer (mirrors the generic `Version Model` schema in `knowledge-import/11_Version_Control.md`: Version ID, Artifact Type, Semantic Version, Status, Author, Timestamp, Parent Version, Change Summary, Dependencies) — not yet implemented as a data structure; when it is, reuse this shape rather than inventing a new one, since it's meant to be shared across Product/Prompt/Pipeline/Dataset artifacts uniformly.

**Definition of Done:** a prompt change either bumps the version per PV-1 or is a pre-release (draft, unreferenced by any non-draft pipeline) edit-in-place.

---

## 18. Prompt Evaluation

**Purpose.** Define what "this prompt works" means, concretely, using the real evaluation plan from `pdf-notes.txt` as the template rather than generic advice.

**Evaluation dimensions** (from `knowledge-import/04_Prompt_Studio.md`): Accuracy, Completeness, Consistency, Latency, Cost, Safety.

**Concrete worked example — the only real one in this repository** (`pdf-notes.txt` Этап 1, §3.3): a **golden set of 40 real calls**, stratified by type (КЦ/Agent, clean/noisy, new/repeat), manually labeled by a domain expert for roles, gold-standard summary, and a checklist of flags (action present? no leaked client/object data in a КЦ-routed summary? name included only when confident? summary complete?). Scoring combines:
- **Deterministic scorers** (cheap, exact): no object/client data leaked in a КЦ summary; phone numbers/codes normalized; profanity masked; length cap respected (`V6 ≤ 600` — unit not specified in source, verify before reuse); action statement present at the end.
- **Model-judge scorer**: faithfulness/roles/usefulness/completeness, explicitly required to be **grounded in a quote from the transcript**, not free-floating judgment.
- A **runner** that takes "version → 40 calls → metrics table" as one command, producing reproducible before/after comparisons.
- The rule that governs every iteration: **"улучшаем по одному блоку — и только если метрика выросла"** (change one block at a time, keep the change only if the metric improved — never ship on a "feels better" basis).

**Mandatory rule:** PE-4 (§15) requires evaluation before production use; this chapter defines what evaluation means in practice for this repository: at minimum, a labeled example set (start from the 40-call structure above if the call-analysis domain applies), at least one deterministic scorer and one grounded model-judge scorer, and a documented baseline number to compare future versions against.

**Anti-pattern:** treating "the demo output looked reasonable" as evaluation — this is explicitly the as-is failure mode the business case is trying to escape (7 prompt versions iterated on "мне не нравится" feedback with no measurable loop, per the Frame 1 board's G4 gap).

**Definition of Done:** a prompt change ships with a before/after number on at least one metric, computed against a fixed example set, not a subjective impression.

---

## 19. Prompt Testing

**Purpose.** State the current, evolving reality and the minimum bar going forward.

**Current state (verified, updated 2026-07-03 — Engineering Roadmap Epic 1):** Vitest is now installed (`vitest.config.ts`, `npm test` / `npm run test:watch`), and the domain layer has unit test coverage for `shared.ts` plus the `Node`, `Edge`, `Project`, `Review`, `Run`, `Pipeline` entities (schema acceptance/rejection + factory defaults — 27 tests passing at time of writing). **Prompt-specific testing remains at zero**: the `Prompt` entity has no test file yet, and no prompt evaluation harness (§18) exists. `npm run lint` (ESLint, `next/core-web-vitals` config only) remains the only other automated check.

**Mandatory minimum going forward:**
- **PT-1.** Any new Zod schema change gets at least one test asserting the schema accepts valid input and rejects the specific invalid input the change was meant to catch — this is now enforceable in practice (a test runner exists), not just an aspiration.
- **PT-2.** Any prompt evaluation harness built per §18 IS the regression test suite for that prompt — treat "run the harness, compare to baseline" as the test, not an afterthought.
- **PT-3.** Do not claim "tests pass" without having actually executed `npm test`. Say so plainly if something is only manually verified.

**Decision rule:** the first test infrastructure investment in this repository targeted the domain layer (`src/entities/*/model/schema.ts`) — done. The next investment should be: (a) test coverage for the remaining six entities (Architecture, Framework, KnowledgeModule, Model, Product, Prompt), then (b) store-level tests (`src/shared/stores/*`, especially `pipeline-store.ts`'s undo/redo stack), before UI or simulation-engine tests.

**Definition of Done for this chapter, given current state:** any claim of "tested" in a PR description is either backed by an actual `npm test` run, or explicitly labeled "manually verified, no automated test exists yet" — never silently implied to be automated when it isn't.

---

## 20. AI Agent Design

**Purpose.** Define what an "agent" is in this repository's vocabulary and how to design one, since the term is used in at least three overlapping ways across the documentation.

**20.1 [CANONICAL DECISION] — disambiguating "agent."** This repository uses "agent" for three distinct things; keep them separate:
1. **Domain `Node` of type `"agent"`** (`src/entities/Node/model/types.ts`) — a pipeline step that dynamically chooses its own sub-steps, as opposed to a `"llm"` node which is a single fixed call. Per the architect glossary: "Agent не равен Workflow. Workflow следует заранее заданным steps, Agent выбирает steps динамически."
2. **AI specialist role** (Senior Product Manager, Senior AI Solution Architect, etc.) — a `KnowledgeModule` record plus a `skills/*` knowledge-system directory, consumed by path reference, not executed as code (§10 SB-3).
3. **`knowledge-import/05_AI_Agent_System.md`'s "Agent"** — a fully specified runtime concept (Identity/Role/Goal/Skills/Tools/Memory/Constraints/Metrics, with a JSON communication protocol) that does not exist in code at all.

When a task says "build an agent," always ask which of these three is meant before writing code — conflating them is a common and costly mistake.

**20.2 Design rule (architect `DECISION_ENGINE.md` D-002, "Workflow Before Agent"):** use a `"router"` or `"function"` node (predictable, deterministic) instead of an `"agent"` node whenever the steps are actually knowable in advance. Reserve `"agent"` nodes for genuinely dynamic planning needs — this is the same "Non-AI First" discipline as §13, one level up: prefer Workflow over Agent for the same reason you prefer Rules Engine over LLM.

**20.3 Anti-pattern AP-002 "Agent by Default"** (`skills/senior-ai-solution-architect/ANTI_PATTERNS.md`): choosing an `"agent"` node for a workflow whose steps are actually fixed. This is the pipeline-level sibling of AP-001 "LLM Everywhere" (§13).

**Definition of Done:** before adding an `"agent"`-type node, you can state specifically what dynamic decision it makes that a `"router"` node with explicit branches could not.

---

## 21. Agent Contracts

**Purpose.** Specify the input/output contract shape an agent (in sense 3 of §20.1, or a `KnowledgeModule` in sense 2) should honor once implemented.

**Contract shape** (from `knowledge-import/05_AI_Agent_System.md`, spec-only):
```json
{
  "task_id": "string",
  "agent": "string",
  "objective": "string",
  "inputs": [],
  "expected_output": "string",
  "constraints": [],
  "priority": "normal"
}
```
Response: `{ status, confidence, evidence, artifacts, recommendations }`.

**This exact shape has a close but not identical sibling already specified for module contracts in `orchestrator/MODULES.md`** — every orchestrator module contract there is defined as Input / Output / Preconditions / Postconditions / Validation Rules / Failure Modes, which is richer (adds explicit preconditions and named failure modes) than the generic `05_AI_Agent_System.md` shape. **[CANONICAL DECISION]**: when implementing either, use the `MODULES.md` shape (Input/Output/Preconditions/Postconditions/Validation Rules/Failure Modes) as the base contract, and layer the `task_id`/`priority`/`confidence`/`evidence` fields from `05_AI_Agent_System.md` on top — do not implement two parallel, incompatible contract schemas.

**Mandatory rules for any agent contract:**
- **AC-1.** Every contract declares Preconditions — e.g., the architect module's real precondition, "Product Review score >= 85; Product Complete gate passed; AI Readiness is not Low" (`orchestrator/MODULES.md`), should gate execution, not just be documented prose.
- **AC-2.** Confidence is always reported as part of the response, using the three-tier scale in §25, not a bespoke per-agent scale.
- **AC-3.** Human approval is mandatory (never automatable) for: release decisions, architecture approval, budget approval, security exceptions, production deployment (`knowledge-import/05_AI_Agent_System.md`).

**Definition of Done:** an implemented agent's contract states its preconditions, postconditions, and failure modes explicitly, and its response always includes a confidence value.

---

## 22. Agent Communication

**Purpose.** Define how agents/modules pass context to each other, per `orchestrator/CONTEXT.md` — the most concretely specified part of the whole orchestrator design.

**Context Object** (verbatim schema, spec-only, not implemented):
```json
{
  "context_version": "1.0",
  "project": { "project_id": "string", "name": "string", "current_state": "draft", "created_at": "datetime", "updated_at": "datetime" },
  "user_input": { "idea": "string", "answers": [], "constraints": [], "preferences": [] },
  "artifacts": { "idea_analysis": null, "product_analysis": null, "prd": null, "ai_capabilities": null, "product_review": null, "architecture_brief": null, "architecture_decision": null, "model_selection": null, "data_architecture": null, "evaluation_strategy": null, "pipeline_specification": null, "pipeline_review": null, "playground_results": null, "final_review": null },
  "quality": { "gates": [], "scores": {}, "blocking_issues": [] },
  "orchestration": { "last_module": null, "next_module": null, "transition_reason": null, "required_user_questions": [], "history": [] }
}
```

**Mandatory rules (C-001 through C-005, from `orchestrator/CONTEXT.md`):**
- **C-001 Minimal Context** — pass a module only what it needs for its current task, not the whole object.
- **C-002 Artifact Provenance** — every artifact carries source module, `created_at`, version, review status.
- **C-003 No Silent Overwrite** — a module cannot overwrite another module's artifact without a new version and a transition reason.
- **C-004 Questions Before Guessing** — ask the user rather than infer when required input is missing (this generalizes AD-2, §4, to the module-to-module case).
- **C-005 Reviewed Context Only** — the next major stage receives only artifacts that passed their Quality Gate (§27), absent an explicit, logged exception.

**Per-module allow-list example** (Senior AI Solution Architect receives): PRD, Product Analysis, AI Capabilities, Product Review, Architecture Brief, constraints, quality requirements, open questions. It must **not** receive: unvalidated UI decisions, a pipeline graph before architecture exists, or reviewer recommendations detached from their source artifacts.

**Definition of Done:** a module-to-module handoff, once implemented, can be traced to a Context Object diff showing exactly which artifacts crossed the boundary and why (transition_reason), never an implicit "the AI just knew."

---

## 23. Orchestrator

**Purpose.** Consolidate the orchestrator specification (`orchestrator/*.md`, 8 files) into one authoritative summary, since it is the single most internally inconsistent part of the repository's documentation (§31 catalogs the specific conflicts) — implementers must read this chapter before touching any of those 8 files.

**23.1 What the Orchestrator is and is not** (`orchestrator/README.md`): a coordination layer that moves a project through lifecycle stages, delegates to knowledge modules, enforces Quality Gates, and explains every transition/return. It is explicitly **not** an AI Agent, not a general workflow engine, and does not itself produce PRD, Architecture, or Pipeline content — those belong to the delegated modules.

**23.2 Two competing stage vocabularies — use both, mapped, never assume they're the same list.**
- `WORKFLOW.md` (11 kebab-case stages): `create-project → idea-analysis → discovery → product-design → product-review → architecture-design → architecture-review → pipeline-generation → pipeline-review → playground → final-review`.
- `STATE_MACHINE.md` (17 snake_case states): `draft, idea_analyzed, discovery, product_design, product_review, product_ready, architecture_design, architecture_review, architecture_ready, pipeline_generation, pipeline_review, pipeline_ready, testing, final_review, completed, archived, blocked`.
- **Known mismatch:** `WORKFLOW.md`'s `playground` stage corresponds to `STATE_MACHINE.md`'s `testing` state — the names genuinely differ, and `OUTPUT_SCHEMA.md`'s own worked example mixes both vocabularies in a single object (`"current_stage": "idea-analysis"` next to `"next_state": "idea_analyzed"`). **[CANONICAL DECISION]:** treat `current_stage` (kebab-case, from WORKFLOW.md) as the human-facing/UI label and `current_state`/`next_state` (snake_case, from STATE_MACHINE.md) as the machine state; when implementing, maintain an explicit lookup table between the two vocabularies rather than assuming a 1:1 string mapping.

**23.3 Quality Gates** (`QUALITY_GATES.md`, 5 gates) — the concrete pass/fail criteria:
| Gate | Before | Key criterion |
|---|---|---|
| `gate_product_complete` | Architecture Design | PRD + Product Analysis exist; **Product Review score >= 90** (raised from the spec's literal `>= 85` by DEC-003, Accepted 2026-07-03 — see §23.4); AI Readiness not Low if AI required |
| `gate_architecture_complete` | Pipeline Generation | AI Necessity Decision fixed; **Architecture Review score >= 90**; Model Selection + Data Architecture + Evaluation Strategy exist if AI used |
| `gate_pipeline_complete` | Playground | all nodes have I/O contracts; no orphan nodes; AI nodes have validation+evaluation link; retry/fallback defined |
| `gate_ready_for_testing` | Playground run | Pipeline Complete passed; test scenarios exist; cost/latency limits defined |
| `gate_ready_for_production` | Completed | Playground results exist; Final Review exists; no unresolved blocking issues |

**23.4 [RESOLVED via `docs/decisions/DEC-003-review-gate-threshold-asymmetry.md`, Accepted 2026-07-03].** `orchestrator/QUALITY_GATES.md`'s literal text still requires only **Product Review score >= 85** to pass `gate_product_complete`, corresponding to the PM skill's own `REVIEW.md` band "75-89: approved with minor recommendations" — **not** its "90-100: approved" band — while the Architecture Review threshold (`>= 90`) exactly matches the architect skill's own "90-100: approved" band. The product owner delegated the decision on 2026-07-03 ("Прими решение сам, продолжай"); DEC-003 Option A was accepted: **`gate_product_complete` now requires Product Review score >= 90**, matching Architecture's rigor. Per CLAUDE.md §71 rule 2, `orchestrator/QUALITY_GATES.md` and the two `REVIEW.md` files are deliberately **not edited** to reflect this — they remain the historical spec record. **DEC-003, not the literal `>= 85` text in `orchestrator/QUALITY_GATES.md`, is the operative threshold** for any future orchestrator implementation.

**23.5 Decision Engine core rules** (`orchestrator/DECISION_ENGINE.md`, own D-001…D-008 — **do not confuse with the architect skill's own D-001…D-007, a completely different rule set under colliding IDs**, §31.6): D-001 Product Review Threshold (return to `product_design` if score < 85; to `discovery` if the issue is evidence-related), D-002 AI Readiness gate before architecture, D-003 Architecture Review Threshold (< 90 returns to `architecture_design`, or to `product_design` if the issue is a PRD contradiction), D-004 Pipeline Validation return rules, D-005 Mandatory User Question over guessing, D-006 No Forward Skip (cannot reach Architecture without Product Complete, Pipeline without Architecture Complete, Playground without Pipeline Complete), D-007 No Knowledge Duplication (route to the specialist module, don't decide domain content in the orchestrator), D-008 Return Loop Limit (more than two returns between the same two states for the same reason forces `blocked`).

**23.6 Error handling** (`orchestrator/ERROR_HANDLING.md`) — 9 named error types: `insufficient_data, contradictory_requirements, missing_artifact, low_product_quality, low_architecture_quality, pipeline_validation_failed, implementation_impossible, module_failure, invalid_transition`. Rule for `insufficient_data`: "Нельзя: придумывать недостающие данные" (never fabricate missing data — this is the orchestrator-level restatement of AD-1/AD-6, §4). Two consecutive returns of the same error type between the same two states triggers `blocked` and a user-facing summary (mirrors D-008).

**23.7 Implementation status.** None of §23.1–23.6 exists in `src/` today. When implementing the orchestrator, do it as a distinct module under `src/shared/` or a new `src/features/orchestrator/` (not yet created), consuming the Zod-validated domain entities directly rather than re-deriving the Context Object schema in §22 from scratch — reuse `RepositorySnapshot` and entity schemas as the actual data source, with the Context Object as a projection/view over them for a given module's turn.

**Definition of Done:** an orchestrator implementation cites which of the two stage vocabularies it uses for its public API, has an explicit lookup between the two, and does not silently resolve the Product-vs-Architecture threshold asymmetry (§23.4) without a linked ADR.

---

## 24. Evidence Engine

**Purpose.** Ensure every AI-influenced decision in this system is backed by traceable evidence, per `knowledge-import/07_Pipeline_Lab.md`'s Evidence Engine concept and `skills/senior-product-manager/DECISION_ENGINE.md`'s Evidence Grading.

**Evidence Grading scale** (`skills/senior-product-manager/DECISION_ENGINE.md`, apply to any product/architecture decision, human or AI-made):
| Grade | Description | Usage |
|---|---|---|
| A | Behavioral or production data | Can support a high-confidence decision alone |
| B | Direct customer evidence (interviews, usability tests, sales calls) | Can support a discovery decision alone |
| C | Expert judgment or stakeholder input | Supporting evidence only, never sole basis |
| D | Internal opinion, no external evidence | Cannot be the sole basis for a decision |

**Mandatory rule (`07_Pipeline_Lab.md`): "No evaluation may rely on opaque scoring."** Every AI-produced score, classification, or recommendation must retain: prompt version, pipeline version, model version, raw input, raw output, evaluation logs, and supporting excerpts (quotes) — this is the general form of the citation-grounding requirement already concrete in the call-analysis case (§3.3's `цитаты[]` field).

**Application to demo data (illustrative of the gap):** the seeded demo `Review` records (`demo-data.ts`) carry only a `score` number and an empty `issues: []` array — there is no evidence trail attached (no linked excerpts, no rationale). This is acceptable for static demo seed data but must not be the pattern for any real evaluation output.

**Definition of Done:** any automatically-produced score or recommendation in this system can be traced back to the specific input excerpt(s) that justified it, not just a bare number.

---

## 25. Confidence Engine

**Purpose.** Standardize how confidence is represented and acted upon across the system, replacing ad hoc per-feature confidence handling.

**Three-tier scale** (from `knowledge-import/03_Product_Studio.md`, the most concrete confidence spec in the repository):
| Score | Meaning |
|---|---|
| 95–100 | High confidence |
| 80–94 | Minor review recommended |
| 60–79 | Human review required |
| < 60 | Insufficient information |

**Simplified boolean form used at the pipeline level:** the demo pipeline's validation node routes on a single threshold, `confidence >= 0.72 → store`, `confidence < 0.72 → human_review` (`demo-data.ts` edge conditions). Note the scale mismatch: `03_Product_Studio.md` uses a 0–100 integer scale, while the pipeline's `metadata.threshold` uses a 0–1 float (`"0.72"`). **[RATIFIED, see `docs/decisions/DEC-002-confidence-scale.md`]:** standardize all future confidence values on the 0–1 float scale used by the actual `Node.metadata.threshold` and `Run` semantics (it's what's implemented), and treat the 0–100 scale in `knowledge-import/03_Product_Studio.md` as needing conversion (`score / 100`) wherever it's cited going forward, rather than maintaining two live scales.

**Mandatory rule:** `Simulation Engine`'s hardcoded `confidence: 0.86` (§12.4) must never be presented as a real confidence score in any UI copy or documentation — it is a placeholder. When a real confidence-producing step is built, it must derive its number from an actual evaluation signal (§18), never a constant.

**Definition of Done:** a confidence value anywhere in the system can be traced to (a) which of the two scales it's on, explicitly, and (b) what produced it — a real evaluator, or a known placeholder that must be labeled as such.

---

## 26. Golden Dataset

**Purpose.** Define what a Golden Dataset is for this repository and where the one real candidate for one currently lives.

**Definition** (`knowledge-import/07_Pipeline_Lab.md`, `20_Glossary_and_Enterprise_Standards.md`): a versioned, immutable-after-publication set of `{ Input, Expected Output, Ground Truth, Metadata, Labels, Version }` records used to evaluate pipeline/prompt changes. ID prefix per the authoritative glossary (`20_Glossary_and_Enterprise_Standards.md`): `dts_` (note: `12_Data_Model.md`'s own ID prefix table omits this — `20` is authoritative per its own "authoritative reference for every other SRS document" claim, §31.3).

**Current state: no Golden Dataset exists in this repository.** Neither as a file, a directory, nor a `Dataset`-shaped entity (there is no `Dataset` entity under `src/entities/` at all — `RepositorySnapshot` has no `datasets` array). The nearest thing to one is the *plan* for one in `pdf-notes.txt`: a proposed 40-call labeled set (§18), which does not yet exist as actual data in this repository — the calls, transcripts, and labels described there have not been imported. (Separately, an unrelated top-level `Golden Dataset` folder exists as a sibling directory outside this repository, at `~/Documents/Golden Dataset` — it is a **different project** and not part of this codebase; do not assume it is connected.)

**Mandatory rules for when a Golden Dataset is introduced:**
- **GD-1.** Immutable after publication — new examples or corrections go into a new version, never edit a published dataset version in place (mirrors PV-2, §17).
- **GD-2.** Must include representative cases, edge cases, failure cases, and — for anything safety-relevant — adversarial cases, per `knowledge-import/07_Pipeline_Lab.md`.
- **GD-3.** If a `Dataset` entity is added to the domain model, follow the exact same 4-file structure as every other entity (§9.1) — do not special-case it.

**Definition of Done:** any claim of "evaluated against the golden dataset" names a specific version identifier and file/table location — until one exists, say "no golden dataset exists yet; evaluation used an ad hoc example set of size N" instead of implying more rigor than is present.

---

## 27. Evaluation Framework

**Purpose.** Distinguish evaluation *methods* (how you score an output) from evaluation *process* (when/how often you run it), consolidating `knowledge-import/07_Pipeline_Lab.md` and the architect skill's `EVALUATION.md`.

**Evaluation methods** (`07_Pipeline_Lab.md`): Exact Match, Semantic Similarity, LLM-as-a-Judge, Rule-Based Validation, Human Review, Hybrid Evaluation.

**Evaluation by AI pattern** (`skills/senior-ai-solution-architect/EVALUATION.md`, maps directly onto `AI_PATTERNS.md` IDs — use this table to pick a method once you know which pattern a node implements):
| `ai_pattern_id` | What to measure |
|---|---|
| `structured-outputs` | schema validity, field accuracy |
| `rag` | retrieval recall, citation precision, factuality |
| `function-calling` | tool selection accuracy, argument validity |
| `model-routing` | routing accuracy, cost-quality balance |
| `guardrails` | violation detection rate, false positive rate |
| `human-in-the-loop` | correction rate, SLA adherence, human/AI agreement |

**Numeric KPI targets** (`knowledge-import/08_Test_Analytics.md`, aspirational for the platform, useful as a starting bar for any real pipeline): Accuracy ≥ 95%, Completeness ≥ 95%, Consistency ≥ 95%, Hallucination Rate ≤ 2%, Structured Output Success ≥ 99%.

**Release gate criteria** (`07_Pipeline_Lab.md`): functional tests passed, regression suite passed, confidence threshold satisfied, human approval completed, cost limits respected — **"No production release should occur without successful validation in Pipeline Lab."** Since Pipeline Lab is unimplemented (§11.2), treat this rule as: no pipeline/prompt version should move to `ready`/`completed` `LifecycleStatus` without an equivalent manual evaluation pass (§18) until Pipeline Lab exists in code.

**Definition of Done:** a pipeline or prompt change that claims to be "evaluated" names the method(s) used from the list above and the specific pattern-appropriate metric, not a generic "looks good."

---

## 28. Benchmark Framework

**Purpose.** Distinguish benchmarking (comparing versions/models against each other) from evaluation (checking one version against a bar).

**Definition** (`knowledge-import/07_Pipeline_Lab.md`'s Benchmark Engine, spec-only): runs the same golden dataset against multiple pipeline/prompt/model versions to produce comparative metrics, not just a pass/fail.

**Concrete real-world instance** (`pdf-notes.txt` Этап 4, "Модель-агностичность и стоимость"): benchmark 1–2 cheaper/local models against the current GPT-5 mini baseline on simple steps, comparing metric quality vs. cost, with the explicit design requirement that each pipeline step's model be swappable via configuration (`metadata`/`Node.modelId`) without touching pipeline logic — this is already structurally possible today since `Node.modelId` is a loose reference to the `Model` entity, not hardcoded.

**Mandatory rule:** never declare a "winning" model/prompt version from a benchmark without the underlying per-example results being inspectable (ties back to Evidence Engine, §24) — an aggregate score alone is not a benchmark result, it's an unverifiable claim.

**Definition of Done:** a benchmarking claim ("model X is cheaper and as good as model Y for this step") is backed by a table of per-example comparisons on the same fixed dataset, not a single averaged number.

---

## 29. Experiment Framework

**Purpose.** Define what an "experiment" is and its minimum required shape.

**Definition and required fields** (`knowledge-import/07_Pipeline_Lab.md`, `12_Data_Model.md`): an Experiment has `Experiment ID` (prefix `exp_` per both `12` and `20`), Pipeline Version, Prompt Versions, Dataset, Models, Variables, Evaluators, and a Result. Experiments are one of the five Aggregate Roots in the target data model (alongside Product, Pipeline, Prompt, Release).

**Mapping to this repository's real staged plan** (`pdf-notes.txt` Этап 0–5, §3.3) — this is the best available template for what a real experiment record should capture: owner(s), duration estimate, explicit "done when" criteria tied to a metric delta versus a named baseline, and a stated dependency order (Этап 2 depends on Этап 1's baseline numbers existing first). Any future `Experiment` entity or record should capture at minimum: what changed, against what baseline, measured by which evaluator, with what result, decided by whom.

**Mandatory rule:** "version bump only if the metric didn't drop" (`pdf-notes.txt`, stated as the core discipline of the whole plan) — apply this verbatim as the promotion rule for any versioned prompt/pipeline artifact once real evaluation exists.

**Definition of Done:** an experiment record states its baseline, its change, its result, and its accept/reject decision — never just "we tried X."

---

## 30. Business Rules

**Purpose.** Consolidate the concrete, numbers-backed business rules that actually exist in this repository — there are more of these hiding in `pdf-notes.txt` than anywhere else, and they are easy to lose because that file is an unstructured text dump.

**Rules extracted from the real business case (§3.3), stated as testable assertions:**
- **BR-1.** "First contact" is recorded only when the contact center actually connected the client to an Agent — never inferred from a call attempt alone. (Directly maps to a `Run`/pipeline output field once implemented; do not conflate "call attempted" with "call connected.")
- **BR-2.** A КЦ-routed (contact-center-only) summary must never contain leaked object/client data — this is a hard constraint on the shared prompt core, not a per-type nuance, and should be enforced by a deterministic scorer (§18), not left to LLM discretion.
- **BR-3.** Names are included in a summary only "при уверенности" (when confident) — i.e., name extraction has its own confidence gate, distinct from the overall summary confidence.
- **BR-4.** Priority/"hotness" scoring for a lead combines exactly three signals: client solvency (платёжеспособность), purchase timeline (срок покупки), and a system-computed hotness score — do not add a fourth signal without updating this rule and its downstream consumers, since the business rationale ("removes subjectivity") depends on the signal set being fixed and explainable.
- **BR-5.** Every AI-facing cost/quality trade-off in this domain must be justified against the ~450,000₽/month baseline (§3.3) — a change that increases per-call cost needs an explicit quality justification tied to one of the KPI targets in §27, not just "the new model is better."

**Cross-cutting business rule from the PM knowledge system** (`skills/senior-product-manager/RULES.md` R-004, "AI Justification Required"): no AI capability is added without an explicit justification for why non-AI (rules/code) is insufficient — this is the business-rule-level restatement of the architectural D-001 "Non-AI First" (§13).

**Definition of Done:** a change touching call-analysis logic can be checked against BR-1 through BR-5 explicitly, not just against generic code review criteria.

---

## 31. Canonical Vocabulary

**Purpose.** This is the most load-bearing chapter for avoiding confusion in a repository with three independently-written glossaries. It lists every genuine terminology conflict found across `knowledge-import/20_Glossary_and_Enterprise_Standards.md`, `skills/senior-ai-solution-architect/GLOSSARY.md`, and `skills/senior-product-manager/GLOSSARY.md`, plus the naming/threshold mismatches found across code and docs — each with a stated resolution.

**31.1 Product naming** — resolved in §1: use "AI Product Studio" for the app, "AI Product OS" only for the `knowledge-import/` vision, "AI Communication Platform/Studio" only as loose stakeholder language.

**31.2 Role titles vs. directory/module names.** Both skill `ROLE.md` files use "Principal" (Principal AI Solution Architect, Principal Product Manager) while `orchestrator/MODULES.md` and the literal folder paths use "Senior" (`senior-ai-solution-architect`, `senior-product-manager`), and `KnowledgeModule.kind` in code uses yet another form (`"senior_product_manager"`, `"senior_ai_solution_architect"`, snake_case). **Resolution:** the `kind` enum and folder path (snake_case / kebab-case "senior-*") are what code actually keys on — use those verbatim in code and data; use "Senior Product Manager" / "Senior AI Solution Architect" (not "Principal") in any new prose to match the directory names, since directories are harder to rename than a `ROLE.md` heading.

**31.3 Dataset ID prefix conflict.** `knowledge-import/12_Data_Model.md`'s ID prefix table omits a Dataset prefix entirely; `20_Glossary_and_Enterprise_Standards.md` adds `dts_`. **Resolution:** `20` explicitly claims authority over terminology/ID conventions for every other SRS document — use `dts_` and treat `12`'s omission as an oversight, not an intentional difference.

**31.4 Four incompatible staging vocabularies for "the same" lifecycle**, none of which map 1:1:
- Orchestrator `WORKFLOW.md`: 11 kebab-case stages (§23.2).
- Orchestrator `STATE_MACHINE.md`: 17 snake_case states (§23.2), with the `playground`/`testing` naming mismatch.
- PM `PROCESS.md`: its own 10-stage lifecycle (Idea Intake, Product Discovery, Opportunity Definition, Value and Business Fit, AI Feasibility, PRD, AI Architecture Input, Visual Pipeline Input, Playground Readiness, Product Review) — notably, "Opportunity Definition" and "Value and Business Fit" have **no corresponding named stage anywhere in the orchestrator spec**; the orchestrator's single `discovery` stage apparently has to absorb three of the PM's stages.
- PM `MATURITY_MODEL.md`: a 7-level (0–6) maturity ladder, independent of both of the above.
- **Resolution:** do not attempt to force these into one enum. Treat `STATE_MACHINE.md`'s 17 states as the implementation target for any code `status` field (it's the most granular and machine-shaped), `WORKFLOW.md`'s stages as the human-facing UI labels (with the explicit `playground`↔`testing` mapping noted), the PM `PROCESS.md` stages as *sub-steps that occur within* the orchestrator's `discovery`/`product-design` stages (not parallel top-level states), and the Maturity Model as an orthogonal, continuously-recomputed readiness score that doesn't gate transitions by itself.

**31.5 Product Review vs. Architecture Review threshold asymmetry** — see §23.4. **RESOLVED**: DEC-003 (Accepted 2026-07-03) raises `gate_product_complete` to Product Review >= 90, matching Architecture. The underlying spec files (`orchestrator/QUALITY_GATES.md` etc.) still literally say `>= 85` and are not edited — DEC-003 is the higher-authority interpretation.

**31.6 D-XXX rule ID collisions.** `orchestrator/DECISION_ENGINE.md` (D-001…D-008) and `skills/senior-ai-solution-architect/DECISION_ENGINE.md` (D-001…D-007) use the same ID scheme for entirely different rules; `skills/senior-product-manager/DECISION_ENGINE.md` uses no D-IDs at all (tables instead). **Resolution:** `D-XXX` IDs are **file-scoped, never global** — always cite them as `orchestrator/DECISION_ENGINE.md#D-001` or `skills/senior-ai-solution-architect/DECISION_ENGINE.md#D-001` in full, never bare "D-001."

**31.7 AP-XXX anti-pattern ID collisions.** Both `skills/senior-ai-solution-architect/ANTI_PATTERNS.md` and `skills/senior-product-manager/ANTI_PATTERNS.md` number their 10 anti-patterns AP-001 through AP-010 independently, with unrelated content (architect AP-001 = "LLM Everywhere"; PM AP-001 = "Solution First"). **Resolution:** same as 31.6 — always qualify with the source file.

**31.8 Same term, two independent registries, no cross-reference.** `human-in-the-loop` and `context-engineering` each exist as an `ai_pattern_id` in the architect's `AI_PATTERNS.md` **and** as a `framework_id` in the PM's `FRAMEWORKS.md`, with two separate, non-cross-referenced definitions, despite both files independently claiming Single-Source-of-Truth status for their own registry. **Resolution:** when citing either term, state which registry you mean (`ai_pattern_id` or `framework_id`) — they describe the same real-world concept from two different disciplinary angles (engineering control vs. product framework) and both are valid, but conflating them as "the same definition" is wrong.

**31.9 General decision rule for any conflict not listed above:** prefer (in this order) — (a) what the actual running code does, (b) the most numerically specific document (a stated threshold beats a vague adjective), (c) the more recently-dated source if dates are available, (d) file this document as needing an ADR rather than guessing silently.

**31.10 Code-vs-doc drift — RESOLVED 2026-07-03.** `docs/ux/SCREEN_PRODUCT.md` and `SCREEN_ARCHITECTURE.md` describe fully interactive tabbed sections (Idea/Discovery/Frameworks/PRD/Review, etc.); `product-screen.tsx` and `architecture-screen.tsx` previously rendered a `Tabs`/`Tab` row that was decorative only. Both screens now hold `activeTab` in local component state (React 19 `useState`, per §44 R-2's exception for genuinely component-local ephemeral UI state) and gate their content sections on it, verified interactively via `preview_click`/`preview_snapshot` (clicking "Review" on Product shows only the Review card; clicking "Models" on Architecture shows only the Models badges). This is documented here as a closed example of drift, not removed, so the general pattern (doc describes intent, code lagged) remains visible for future reference.

**Definition of Done:** before using a term or ID from `knowledge-import/`, `orchestrator/`, or `skills/*` in new work, check this chapter first — if it's listed, apply the stated resolution; if a new conflict is found, add it here in the same change.

---

## 32. Repository Knowledge Base

**Purpose.** Describe the target-state Knowledge Base (`knowledge-import/10_Knowledge_Base.md`) and what plays its role today.

**Target design** (spec-only): a RAG-style layer combining a metadata store, vector index, and knowledge graph, with a 10-step ingestion pipeline (source discovery → file import → text extraction → metadata enrichment → chunking → embedding generation → vector indexing → knowledge graph updates → quality validation → publication), supporting native formats (Markdown, PDF, DOCX, HTML, JSON, CSV) and enterprise connectors (Git, wikis, issue trackers, cloud storage). Metadata Model: `{ Knowledge ID, Title, Owner, Source, Version, Tags, Security Level, Status }`.

**What plays this role today:** nothing automated. The `KnowledgeModule` entity is a thin catalog pointer (`{id, name, kind, path, frameworkIds, version}`) to a `skills/*` directory — there is no ingestion, chunking, embedding, or retrieval of any kind. This document (`CLAUDE.md`) plus `docs/*` plus `knowledge-import/*` plus `orchestrator/*` plus `skills/*` collectively **are** the repository's knowledge base today, read manually by whoever (human or agent) needs them.

**Mandatory rule until real ingestion exists:** treat §5 (Repository Intelligence) as the manual substitute for automated retrieval — the fast-lookup table there is what a real Knowledge Base's retrieval layer would eventually automate.

**Definition of Done:** anyone asking "where would I find X" gets pointed to §5 first, then to the specific `knowledge-import/10_Knowledge_Base.md` target design only if the question is about building real RAG infrastructure.

---

## 33. Long-term Memory

**Purpose.** Distinguish the different "memory" concepts already specified so a future implementation doesn't conflate them.

**Three memory layers** (`knowledge-import/05_AI_Agent_System.md`, `10_Knowledge_Base.md`, spec-only): Short-Term Memory (current execution only, discarded after), Product Memory (persistent decisions scoped to one product/project), Organizational Memory (reusable knowledge across all products — e.g., "we tried GPT-5 mini for transcription enhancement and it cost 450k₽/month for X quality" should become organizational memory reusable by the next similar project, per the explicit reuse note in `pdf-notes.txt`: "оценка и движок саммари — общий каркас с Sales Coach").

**Current substitute:** `Review` records (with their `score`/`issues`) are the closest thing to persisted Product Memory today, but they lack the "why"/evidence trail (§24) needed to be genuinely reusable as organizational memory. `DECISION_RECORDS.md`'s template (§41.5) is the correct future home for durable, reusable decisions — until ADRs/Decision Records are actually being written for this repository, treat this as the single biggest gap between "we have good knowledge-system specs" and "we actually retain what we learn."

**Mandatory rule:** any significant trade-off decision made while working on this repository (model choice, architecture pattern choice, threshold choice) SHOULD produce a Decision Record (§41.5) — not just a PR description that will be hard to find in six months, especially since there is currently no git history to search through either (§5, RI-3).

**Definition of Done:** a decision made today is findable and its rationale reconstructible without re-deriving it from scratch six months from now.

---

## 34. Product Discovery

**Purpose.** Define how a new product idea should be handled in this repository's terms, per the PM knowledge system.

**Process** (`skills/senior-product-manager/PROCESS.md` stage 2, `FRAMEWORKS.md`): use `customer-discovery` and `jtbd` as primary frameworks. **Rule R-003 ("Evidence Before PRD"):** a PRD cannot be created as a final artifact without Product Discovery evidence — no skipping straight from idea to requirements.

**Evidence grading applies here first** (§24): discovery conclusions need at least Grade B evidence (direct customer evidence) to be treated as validated; Grade C/D (expert judgment/internal opinion) are supporting only.

**Concrete precedent in this repository:** the demo `Product.discovery` field cites lost call context and agent workflow friction — this reads as a paraphrase of the real evidence in `pdf-notes.txt` (§3.3's four named problems), which is Grade B/C evidence (direct planning material from people close to the problem, not raw interview transcripts) — a reasonable discovery basis, but note that the underlying raw call data referenced (`reference/miro-as-is/`, the 40-call sample) does not exist in this repository (§3.3), so anyone trying to strengthen this to Grade A (production data) will need to source it externally.

**Mandatory rule (R-002, "No Framework Invention"):** do not invent a bespoke discovery method when `customer-discovery`/`jtbd`/`opportunity-solution-tree` etc. (the 18-framework library in `FRAMEWORKS.md`, §35) already cover the need.

**Definition of Done:** a Product Discovery output states its selected `framework_id`(s), its evidence grade, and does not proceed to PRD without at least Grade B evidence or an explicit, logged evidence gap.

---

## 35. AI Product Management

**Purpose.** Consolidate the PM knowledge system's framework libraries and routing rules, since they are the most complete, internally-consistent part of the whole `skills/` documentation set and should be reused as-is, not reinvented.

**35.1 Product Framework Library** (18 `framework_id`s, `skills/senior-product-manager/FRAMEWORKS.md`, each with a cited primary source): `customer-discovery` (Blank), `customer-development` (Blank & Dorf), `jtbd` (Christensen, Ulwick), `lean-startup` (Ries), `design-thinking` (Stanford d.school/IDEO), `value-proposition-canvas` (Osterwalder), `business-model-canvas` (Osterwalder & Pigneur), `opportunity-solution-tree` (Torres), `kano-model` (Kano), `rice` (Intercom), `ice` (Sean Ellis), `moscow` (DSDM), `wsjf` (Reinertsen/SAFe), `north-star-metric` (Amplitude), `okr` (Grove/Doerr), `heart` (Google), `aarrr` (McClure), `product-market-fit` (Andreessen/Ellis), `prd`, `user-story-mapping` (Patton), `user-personas` (Cooper).

**35.2 AI Product Management Library** (10 `framework_id`s): `ai-readiness-assessment`, `ai-product-evaluation`, `ai-capability-assessment`, `human-in-the-loop`, `evaluation-strategy`, `model-selection`, `cost-quality-latency`, `hallucination-risk`, `safety`, `context-engineering`. Remember §31.8: `human-in-the-loop` and `context-engineering` also exist as separate `ai_pattern_id`s in the architect's registry — cite the registry when using either.

**35.3 Framework routing** (`FRAMEWORK_ROUTER.md`, 13 `task_type`s): e.g. `prioritization` → primary `rice`, supporting `ice`/`moscow`/`wsjf`/`kano-model`; `ai-product-feasibility` and `ai-architecture-input` and `ai-quality-and-release` route into the AI PM library above. Rule: "выбирать 1-3 primary framework, не больше" — do not stack more than three primary frameworks on one decision.

**35.4 Evidence-graded decision types** (`DECISION_ENGINE.md`): Problem, Opportunity, Prioritization, Scope, AI Feasibility, Model, Release decisions each map to a specific framework subset — see §35.1/35.2 for the IDs.

**35.5 Trade-off rules for AI products** (verbatim, binding): "Quality vs Cost → если quality ниже threshold, cost optimization запрещена." / "Latency vs Capability → interactive workflows требуют latency threshold до model selection." / "Automation vs Human-in-the-loop → full automation запрещена для high-risk outputs без доказанной quality и safety." / "AI vs Non-AI → AI выбирается только если он дает measurable advantage." / "Model popularity is not a decision criterion."

**Definition of Done:** a product/AI decision cites its `framework_id`(s) by exact string from §35.1/35.2, not a paraphrase, so it's traceable back to `FRAMEWORKS.md`.

---

## 36. Feature Lifecycle

**Purpose.** Define the lifecycle a *feature* (as opposed to an entity or a product) goes through in this repository.

**Stages:** Proposed → Specified (§37 template filled) → In Progress → Under Review (§64) → Merged → Verified in app (per the `/verify` and `/run` skills available in this environment — actually run the app, don't just pass lint) → Documented (§9.5 DDD-2, §60).

**Mandatory rule:** a feature is not "Done" (§68) until its corresponding `docs/domain/`, `docs/ux/`, or `docs/mvp/` documentation has been updated in the same unit of work — this repository already has documented cases of doc/code drift (§31.10); do not add to that list.

**Decision rule for scope:** if a requested feature would require populating one of the six empty `features/*` stub directories (§8.3), treat that as a signal to write a Feature Specification (§37) first, since it's larger than a routine change by definition.

**Definition of Done:** a feature's implementation, its UX doc, and its domain doc (if applicable) all agree with each other on the day it merges.

---

## 37. Feature Specification

**Purpose.** Standard template for proposing a new feature, filling the gap left by the absence of any such template in the existing documentation.

**Template:**
```markdown
# Feature: <name>

## Status
Proposed | Approved | In Progress | Shipped | Rejected

## Problem
What user/business problem does this solve? Cite evidence (§24 grading) if available.

## Non-Goals
What this feature explicitly does not do.

## Users Affected
Which persona(s) — cross-reference `docs/ux/SCREEN_*.md` if a screen is affected.

## Proposed Solution
Concrete description. Which FSD layer(s) does it touch (§8)? Which entities (§9)?

## Domain Model Impact
New/changed entities, fields, or lifecycle states. Cross-reference `docs/domain/*.md` updates needed.

## UX Impact
Which `docs/ux/SCREEN_*.md` needs updating, and how.

## Out of Scope / Explicitly Deferred
## Risks
## Success Metrics
## Rollout Plan
```

**Mandatory rule:** any feature that creates a new entity, changes a lifecycle status enum, or populates one of the six empty feature stubs MUST have a filled-out spec before implementation begins.

**Definition of Done:** the spec's "Domain Model Impact" and "UX Impact" sections match what actually shipped, verified after the fact.

---

## 38. Prompt Specification

**Purpose.** Template for specifying a new prompt, incorporating the block structure from §15.

**Template:**
```markdown
# Prompt: <name>

## Metadata
id | version | purpose (instruction|evaluation|routing|extraction|generation|review) | owner_module_id

## System Role
## Business Context
## Task
## Constraints
(e.g., "never leak client/object data in a КЦ-routed summary" — BR-2, §30)

## Output Schema
(structured, machine-parseable — see §14.3 for the call-analysis reference schema)

## Examples
At least 2, drawn from the real domain (§3.3) where applicable, not synthetic placeholders.

## Evaluation Rules
Which deterministic scorers, which model-judge criteria (§18).

## Safety Rules
## Grounding Requirement
Which output fields must cite a source quote (`цитаты[]` pattern, §14.3).

## Version History
```

**Definition of Done:** a filled spec has a non-empty Output Schema and at least one Evaluation Rule before the prompt is wired into any non-draft pipeline (ties to PE-4, §15).

---

## 39. Pipeline Specification

**Purpose.** Template for specifying a new pipeline, before building it as `Node`/`Edge` records.

**Template:**
```markdown
# Pipeline: <name>

## Purpose
## Reference Business Case
(§3.3 if applicable, or a new one — cite evidence per §24)

## Node List
| step_id | type (agent|llm|function|router|tool|store|validation|human_review|input|output) | purpose | input schema | output schema | model/prompt ref | fallback |

## Edge List
| source | target | condition (if any) |

## Human Review Triggers
(per §13: high risk, low confidence, validation failure, policy uncertainty, high business impact)

## Evaluation Plan
Golden dataset reference (§26), scorers (§18), baseline metric.

## Cost/Latency Budget
## Rollout Gates
Which `LifecycleStatus` transitions require what (draft → in_progress → review → ready → completed).
```

**Definition of Done:** every `llm`/`agent` node in the spec has a named fallback and either a validation node downstream or a written justification for skipping one (§13).

---

## 40. Agent Specification

**Purpose.** Template for specifying an agent in any of the three senses disambiguated in §20.1 — state which sense explicitly at the top.

**Template:**
```markdown
# Agent: <name>

## Sense
Pipeline Node (type=agent) | AI Specialist Role (KnowledgeModule) | Runtime Agent (05_AI_Agent_System.md sense)

## Identity / Role / Goal
## Skills
## Tools
## Memory Scope
Short-Term | Product Memory | Organizational Memory (§33)

## Constraints / Preconditions
(per orchestrator/MODULES.md shape — precondition example: "Product Review score >= 85")

## Contract
Input schema | Output schema | Postconditions | Failure Modes (§21)

## Confidence Reporting
Which scale (§25 — use the 0–1 float scale)

## Human Approval Boundary
Which decisions this agent may never make autonomously (§21, AC-3)
```

**Definition of Done:** the spec states explicitly which of the three "agent" senses (§20.1) it is — a spec that doesn't pick one is not done.

---

## 41. Architecture Decision Records

**Purpose.** The formal mechanism for resolving every `[FLAGGED INCONSISTENCY]` and `[CANONICAL DECISION — pending ratification]` in this document (§1, §23.4, §25, and others), plus any future significant architectural choice.

**When an ADR is mandatory** (`skills/senior-product-manager/DECISION_RECORDS.md`, generalized beyond PM decisions to all architecture): strategy change, target segment change, scope change, AI capability accept/reject, architecture impact, model selection change, release gate change, high-risk trade-off — plus, specific to this repository, any resolution of a conflict catalogued in §31.

**Template** (verbatim structure from `DECISION_RECORDS.md`, this is the single best-designed template already in the repository — reuse it exactly):
```markdown
# DEC-000. <Decision name>

## Status
Proposed | Accepted | Rejected | Superseded

## Date
## Context
## Decision Type
problem | opportunity | prioritization | scope | ai-feasibility | model-selection | release | architecture

## Frameworks Used
(cite `framework_id`s from §35, or architecture/AI pattern IDs from §42.x, §13 — always qualify by source file per §31.6/31.7)

## Options Considered
| Option | Pros | Cons | Risks |

## Evidence
| Evidence ID | Grade (§24) | Summary | Linked Claim |

## Assumptions
| Assumption | Risk Level | Validation Method | Status |

## Decision
## Rationale
## Trade-offs
## Consequences
## What Would Change This Decision
## Review
```

**Mandatory rule:** store ADRs under `docs/decisions/`. As of 2026-07-03 it holds `DEC-001` (product naming, Accepted), `DEC-002` (confidence scale, Accepted), and `DEC-003` (Product/Architecture review threshold asymmetry, **Accepted** — product owner delegated the decision, Option A ratified: `gate_product_complete` raised to >= 90) — the three decisions already identified during full-repository discovery, all now ratified. Add new ADRs here as they arise; do not invent a second location for decisions.

**Definition of Done:** a significant decision has a `DEC-NNN` file in `docs/decisions/` before or immediately after it's acted on — never only living in a chat transcript or PR description.

---

## 42. Coding Standards

**Purpose.** General code quality rules that apply across all languages/files in this repository, ahead of the language-specific chapters below.

**Mandatory rules:**
- **CS-1.** No `any` types (TypeScript strict mode is already on, `tsconfig.json: "strict": true` — keep it that way; do not add `// @ts-ignore` or loosen strictness to work around a type error, fix the type).
- **CS-2.** No duplicated logic — check `src/shared/` (ui, stores, repositories, simulation, config, lib) before writing something that might already exist there.
- **CS-3.** Small, composable modules over large ones — the one clear counter-example already in the repo (the as-is 315-line prompt in `pdf-notes.txt`) is presented in this repository's own source material as the *cautionary example*, not a pattern to emulate.
- **CS-4.** Composition over inheritance — matches the existing code style (no class hierarchies found anywhere in `src/`; entities are plain objects, UI components are function components).
- **CS-5.** Naming conventions are layer-specific and already consistent — do not introduce a new convention: entities PascalCase directories/types, camelCase fields, snake_case enum values, `createEntityName` factories (§9.4); Zustand stores `useXStore`; UI components PascalCase exported from `src/shared/ui/*.tsx`.

**Definition of Done:** `npm run lint` passes, no `any`, no duplicated logic that already exists in `src/shared/`, and naming matches the layer's established convention.

---

## 43. TypeScript Standards

**Purpose.** Repository-specific TypeScript conventions, verified against `tsconfig.json` and actual entity code.

**Verified compiler configuration** (`tsconfig.json`): `target: ES2017`, `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `jsx: "preserve"`, path alias `"@/*": ["./src/*"]`. `allowJs: false` — do not add `.js` files to `src/`.

**Mandatory rules:**
- **TS-1.** Always import via the `@/` alias (`@/entities/Pipeline/model/types`), never relative paths that climb more than one directory (`../../..`) — the alias exists precisely to avoid that.
- **TS-2.** Types are derived from Zod schemas via `z.infer<typeof XSchema>` or hand-written to exactly match the schema shape (both patterns are used across the 12 entities) — pick one per entity and keep `types.ts` and `schema.ts` in sync; never let them silently diverge.
- **TS-3.** Discriminated unions for variant state (already used, e.g. `product-screen.tsx`'s dialog-mode union `create|rename|delete|duplicate`) over boolean flag soup.
- **TS-4.** Optional fields (`field?: T`) vs. required-with-default — follow the existing entity pattern: identity/reference fields (`id`, `projectId`) are always required; descriptive/free-text fields are usually optional (`description?`) unless the entity's factory needs to guarantee a non-empty value (e.g., `Prompt.description` is required precisely because a prompt without any description is meaningless — check factory defaults before deciding).

**Definition of Done:** `tsc --noEmit` (via `npm run build` or an editor's type-check) reports zero errors, and no new relative import climbs more than one level.

---

## 44. React Standards

**Purpose.** Repository-specific React conventions, verified against actual component code (React 19, no class components anywhere).

**Mandatory rules:**
- **R-1.** All interactive components are `"use client"` — this repo has no React Server Components with interactivity; Server Components are used only for `layout.tsx` (metadata) and static shells.
- **R-2.** State lives in Zustand stores (§8.5) for anything that needs to persist across a route change or survive a re-render of a parent; use local `useState` only for genuinely component-local, ephemeral UI state (e.g., a dialog's open/closed flag before it's confirmed).
- **R-3.** Never read or write `localStorage` directly from a component — always through `useRepositoryStore`/`LocalStorageProjectRepository` (§8.6).
- **R-4.** Icons: Lucide only (`docs/design/ICONS.md`), default 16px, `aria-hidden="true"` on the icon, `aria-label` on the parent `IconButton` if there's no visible text label — already the pattern in `mvp-shell.tsx`.
- **R-5.** Tabs must be functionally wired to the content they claim to control — do not add a `Tabs`/`Tab` row that doesn't switch content (§31.10 documents this exact defect already present in two screens; do not repeat it in new code, and fix it if you're already touching one of those files for another reason).

**44.4 UI primitive inventory** (`src/shared/ui/`, exported from `index.ts`) — check this list before adding a new primitive:
- Layout (`layout.tsx`): `AppShell, Sidebar, Header, Workspace, Page, Section, Panel, Inspector, SplitView, ResizablePanel, Toolbar`.
- Navigation (`navigation.tsx`): `NavigationItem, Breadcrumb, Tabs, Tab, Search, CommandPalette, ContextMenu, Dropdown`.
- Form (`form.tsx`): `Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, SegmentedControl, Slider`.
- Feedback (`feedback.tsx`): `Badge, Status, Alert, Toast, Progress, Skeleton, EmptyState, Loading, ErrorState`.
- Containers (`containers.tsx`): `Card, Accordion, Dialog, Drawer, Popover, Tooltip, Sheet`.
- AI (`ai.tsx`): `AIMessage, AIResponse, AIThinking, AIStatus, AIRecommendation, AIExplanation, AIConfidence, FrameworkBadge, KnowledgeBadge`.
- Pipeline (`pipeline.tsx`): `NodeCard, ConnectionHandle, PropertyPanel, CanvasToolbar, MiniMap, ZoomControls, ExecutionStatus, ValidationBadge` — **note:** the actual Pipeline screen uses `@xyflow/react`'s own `MiniMap`/`Controls`/`Background` for the canvas, not these `pipeline.tsx` wrappers, which appear to be a styling-only aspirational set from `docs/design/COMPONENT_LIBRARY.md` not yet wired into the real canvas. Check which one a task actually needs before using either.

**Anti-pattern:** implementing a new domain-typed component (e.g., "PipelineNodeCard for Router type") when the existing generic primitives (`NodeCard`, `Badge` with a `tone`) plus composition already cover it — `docs/ux/COMPONENT_INVENTORY.md` explicitly forbids "adding new reusable component types without updating inventory."

**Definition of Done:** a new UI need is met by composing existing `shared/ui` primitives unless a genuinely new primitive is justified and added to both `shared/ui` and `docs/design/COMPONENT_LIBRARY.md` in the same change.

---

## 45. Next.js Standards

**Purpose.** Repository-specific Next.js conventions, verified against `next.config.ts`, `src/app/`.

**Verified configuration:** `next.config.ts` sets only `outputFileTracingRoot` — no custom rewrites, image config, or experimental flags. App Router only (no `pages/` directory exists). The entire app is effectively one route (`src/app/page.tsx` → `MvpShell`), with in-app "navigation" handled via the `?view=` query parameter rather than actual Next.js routes/segments.

**Mandatory rules:**
- **NX-1.** Do not introduce a `pages/` directory or mix routing paradigms — App Router only.
- **NX-2.** If real multi-route navigation is ever introduced (replacing the `?view=` pattern), that is an architectural change requiring an ADR (§41) — it affects `mvp-shell.tsx`'s navigation logic, deep-linking behavior, and every screen's assumptions about how it's invoked.
- **NX-3.** `RootLayout` (`src/app/layout.tsx`) is the only place `<html>`/`<body>` and global metadata live — do not duplicate `<html>` structure in a nested layout.
- **NX-4.** Client-only browser APIs (`window`, `localStorage`, `document`) must be guarded for SSR exactly as `LocalStorageProjectRepository` already does (`typeof window === "undefined"` check) — this pattern is mandatory for any new code touching browser globals.

**Definition of Done:** a new page/feature doesn't introduce a second routing paradigm and correctly guards any browser-only API for SSR.

---

## 46. JSON Standards

**Purpose.** Conventions for JSON shapes used across schemas, API contracts (future), and node metadata.

**Mandatory rules:**
- **J-1.** Every JSON object exchanged between system components should be validated by a Zod schema at the boundary — this is already the pattern for `RepositorySnapshot` (`RepositorySnapshotSchema` combining all 10 entity schemas); extend this pattern, don't bypass it, for any new JSON boundary (e.g., a future real API request/response).
- **J-2.** Field naming: camelCase for anything in `src/` (matches all 12 entities); the `knowledge-import/`-specified target API layer uses the same camelCase convention in its JSON examples (`prd_01...` style IDs aside) — stay consistent with camelCase for any new JSON shape in this codebase.
- **J-3.** `Node.metadata` and similar free-form `Record<string,string>` fields are a last resort, not a default — prefer adding a typed optional field to the schema over stuffing a new concept into `metadata` as an untyped string. `Edge.condition` made this move already (§14.2); `Node.metadata` values like `threshold`/`sla`/`retention`/`format` have not yet and remain flagged (§14.1, §63 debt item 6, partially resolved).

**Definition of Done:** a new JSON shape has a Zod schema, not just a TypeScript `interface`/inline type, if it crosses any boundary (storage, future API, inter-module context).

---

## 47. API Standards

**Purpose.** Standards for the future real API layer, since none exists yet — `src/shared/api/` is currently an empty `.gitkeep` directory.

**Target design** (`knowledge-import/14_API_Architecture.md`, spec-only, apply when building): API-First — every UI capability must also be an API. Resource naming: plural nouns, versioned by URI (`/api/v1/products`, `/api/v1/prompts`, `/api/v1/pipelines`, `/api/v1/experiments`, `/api/v1/releases`, `/api/v1/knowledge`). Required headers: `Authorization`, `X-Tenant-ID`, `X-Correlation-ID`, `Idempotency-Key`. Error model:
```json
{ "code": "PIPELINE_VALIDATION_FAILED", "message": "Pipeline validation failed.", "correlationId": "...", "details": [] }
```
Async job pattern:
```json
{ "jobId": "...", "status": "Running" }
```
Auth mechanisms (target): OAuth 2.1, OpenID Connect, Service Accounts, limited API Keys. Roles: Administrator, Product Manager, AI Engineer, QA Engineer, Reviewer, Read Only.

**Mandatory rule when building the first real API route:** implement it as a Next.js Route Handler under `src/app/api/`, backed by the same `ProjectRepository` interface (§8.7) rather than a parallel data-access path, and validate request/response bodies with the existing entity Zod schemas (§46 J-1) — do not invent a second serialization format.

**Definition of Done:** a new API route follows the `/api/v1/<plural-resource>` naming, returns the error shape above on failure, and reuses existing Zod schemas for validation.

---

## 48. Database Standards

**Purpose.** Standards for the future real database, since none exists yet — persistence today is `localStorage` only (§8.6).

**Target design** (`knowledge-import/13_Database_Schema.md`, spec-only): PostgreSQL as primary store, with named schemas `product`, `prompt`, `pipeline`, `evaluation`, `knowledge`, `identity`, `governance`; a vector database for embeddings; Redis for cache; an event store. Example table shapes given in spec: `product.products(product_id, tenant_id, name, status, readiness_score, current_release, created_at)`, `prompt.prompts(prompt_id, version, status, owner, quality_score)`, `pipeline.pipelines(pipeline_id, graph, runtime_config, deployment_state)`, `evaluation.experiments(experiment_id, dataset_id, pipeline_version, prompt_version, confidence_score, result)`. Targets: RPO < 15 minutes, RTO < 1 hour; retention — audit logs 7 years, releases permanent, experiments configurable, sessions 30 days.

**Mandatory rule when a real database is introduced:** the table shape for each entity should be derived directly from its existing Zod schema (§9), not redesigned from scratch — the domain model was explicitly built to be storage-agnostic (`docs/domain/ENTITY_GUIDELINES.md`: entities must not import API clients) specifically so this migration is additive, not a rewrite.

**Definition of Done:** any future migration plan can point to a 1:1 mapping between an existing `src/entities/*/model/schema.ts` and a proposed table, with no orphan fields invented outside the domain model.

---

## 49. Security

**Purpose.** Security posture for this repository today and the target posture for when a backend exists.

**Current reality:** no auth, no backend, no secrets in this codebase (verified: no `.env` committed, no hardcoded API keys found in any file read during discovery). The entire attack surface today is client-side, Local-Storage-scoped, single-user.

**Mandatory rules regardless of current scope:**
- **SEC-1.** Never commit secrets, API keys, or tokens — when a real model provider integration is added, credentials go in environment variables, never in `src/` or `knowledge-import/`/`skills/` markdown.
- **SEC-2.** Validate every input at the boundary (`knowledge-import/CLAUDE.md`'s existing rule, reinforced here) — already the pattern via Zod (§9.5 DDD-5); do not weaken it for a "quick" feature.
- **SEC-3.** Never trust LLM output as safe/structured without validation — this is the exact reason `Validation` is one of the 10 `NodeType`s and appears as its own pipeline stage in the to-be call-analysis design (§3.3) between the LLM summary step and the store/output step.
- **SEC-4.** Least privilege — target-state roles from `knowledge-import/14_API_Architecture.md` (Administrator, Product Manager, AI Engineer, QA Engineer, Reviewer, Read Only) should inform any future auth design; do not default new capabilities to "everyone can do everything."
- **SEC-5.** `pdf-notes.txt` contains real, specific business data (call volumes, costs, a named platform "VT", named individuals by first name) — treat this file, and any future imported business material like it, as sensitive; do not paste its contents into external tools, issue trackers, or third-party services without checking whether that's appropriate (per this environment's own guidance on uploading content to third-party web tools).

**Definition of Done:** a change touching any data boundary has explicit input validation, and no new secret or sensitive business detail has been committed to a file that will be widely shared.

---

## 50. Privacy

**Purpose.** Privacy-specific rules, distinct from general security, driven directly by the real business case's own explicit requirement.

**Mandatory rule (BR-2, §30, restated here because it is fundamentally a privacy rule, not just a business rule):** a contact-center-routed (КЦ) call summary must never leak client/object data (e.g., specific property details, personal identifiers beyond what's operationally necessary) — this was an explicit, deliberate design constraint in the real business case (`pdf-notes.txt`: "конфиденциальность... нет данных объекта" as one of the "strong sides" of the as-is approach, i.e., something already being protected and that must not regress in the to-be redesign).

**Rule for names:** include a person's name in generated output only "при уверенности" (when confident) — an under-confident name extraction is a privacy/accuracy risk, not just a quality nit (§3.3, BR-3).

**General rule:** any future real transcript/call data imported into this repository (e.g., to build the Golden Dataset, §26) is customer PII. Treat it accordingly: it should not be committed to a public-facing branch/repo without an explicit, deliberate data-handling decision (ADR-worthy, §41), and `pdf-notes.txt`'s current un-scrubbed presence in the repository root should itself be flagged for review under this rule (§63).

**Definition of Done:** any new pipeline stage that touches transcript data has an explicit statement of what PII it handles and how it's protected before it's wired into a non-draft pipeline.

---

## 51. Performance

**Purpose.** Performance targets, distinguishing aspirational platform-wide targets from what's actually measured today.

**Target performance budget** (`knowledge-import/15_User_Experience.md`, `17_Acceptance_Criteria.md`, aspirational): initial page load < 2s, navigation response < 300ms, search response < 500ms, workspace rendering < 1s, API P95 response < 500ms, API availability ≥ 99.9%.

**Current reality:** no performance instrumentation exists in this codebase. The only "performance" numbers anywhere are the Simulation Engine's fabricated latency figures (§12.4) — these must never be cited as real performance data (they're a function of input string length, not actual work done).

**Mandatory rule:** before claiming a change "improves performance," measure it (e.g., browser DevTools timing, a real profiling pass) — do not infer performance impact from code appearance alone, and never substitute a Simulation Engine number for a real measurement.

**Definition of Done:** a performance claim is backed by an actual measurement, with the tool/method stated.

---

## 52. Cost Engineering

**Purpose.** The one area of this repository with a fully worked, real numeric example — use it as the template for all future cost reasoning, rather than the generic cost-optimization prose in the architect skill.

**Real baseline** (`pdf-notes.txt`, §3.3): ~450,000₽/month at 150,000 calls/month (≈300k for transcription-enhancement LLM calls, ≈150k for summary LLM calls), using GPT-5 mini "end-to-end" for every step regardless of whether the step actually needed an LLM.

**Cost optimization strategies** (`skills/senior-ai-solution-architect/COST_OPTIMIZATION.md`, generalizing the real case): Model Right-Sizing (use the cheapest model that meets the quality bar per step — directly what Этап 4 of the real plan proposes: benchmark cheaper/local models on simple steps), Context Reduction (the to-be design's narrower, single-purpose prompts vs. the as-is 315-line do-everything prompt), Caching (§53), Routing (explicit КЦ/Agent router instead of running both summary prompt variants unconditionally), Batch/Async, Retry Control, Human Review Sampling.

**Mandatory rule (D-007 "Cost Cap Required", architect `DECISION_ENGINE.md`):** every model call needs cost attribution and a budget policy — model-router logic (`"router"` node type) should be the default mechanism for keeping simple steps off expensive models, not a manual per-call decision.

**Mandatory rule from the real case, generalized:** "using an LLM for a step that regex/deterministic code can solve at the required quality is a cost bug, not just an architecture nit" (§13's AP-001 restated in cost terms) — the real case shows this is not theoretical: normalizing phone numbers, prices, and profanity via LLM instead of regex was a direct, measurable, unnecessary cost driver.

**Definition of Done:** a new pipeline step involving a model call states its expected per-call cost (even roughly) and whether a cheaper mechanism (regex, a smaller model, caching) was considered and rejected for a stated reason.

---

## 53. Caching

**Purpose.** Caching guidance — no caching layer exists yet in this codebase; this chapter is entirely forward-looking.

**Mandatory rule when introducing caching:** cache LLM/model call results keyed on (prompt version, input, model, temperature) — never cache on input alone, since a prompt-version bump must invalidate cached results (ties to PV-2, §17, immutability-by-version).

**Fallback hierarchy already specifies caching's role** (§13, from `PIPELINE_DESIGN.md`): "cached response if valid" is fallback tier 4, after retry-same-model and alternative-model/provider, before Human Review — i.e., a cache hit is a legitimate fallback for a transient failure, but never a substitute for a fresh call when the cache entry's underlying prompt/model version has since changed.

**Definition of Done:** a cache entry's key includes every input that affects its output's correctness (prompt version at minimum), and there is an explicit invalidation rule tied to version bumps.

---

## 54. Observability

**Purpose.** What must be captured about every AI-driven execution, per `knowledge-import/05_AI_Agent_System.md`'s monitoring fields and `08_Test_Analytics.md`'s KPI framework — currently unimplemented beyond the Simulation Engine's fabricated numbers.

**Required fields per execution** (target): request id, pipeline id, model, tokens, latency, cost, confidence, retries, outcome. The `Run` entity already has slots for several of these (`metrics: RunMetric[]`, `latencyMs`, `costUsd`, `logs: RunLog[]`) — a real runtime should populate these with real values instead of the Simulation Engine's synthetic ones (§12.4).

**Mandatory rule (`skills/senior-ai-solution-architect/ANTI_PATTERNS.md` AP-010, "Observability After Launch"):** observability must be designed alongside a pipeline stage, not retrofitted after it ships — when adding a new `llm`/`agent` node, its logging/metrics plan is part of the node's spec (§39 template), not an afterthought.

**Definition of Done:** a new AI-driven pipeline stage populates `Run.metrics`/`logs` with real, traceable values (not estimates) before it's considered production-ready.

---

## 55. Logging

**Purpose.** Logging conventions, based on the existing `RunLog` shape.

**Current shape** (`src/entities/Run/model/types.ts`): `RunLog { timestamp, level: "debug"|"info"|"warning"|"error", message }`. The Simulation Engine emits exactly 3 types of log entries today (run-started, per-node-completed in array order, output-generated), all `level: "info"` — no error/warning path is exercised because the simulator never fails (§12.4).

**Mandatory rule for a real runtime:** log entries must reflect actual execution order (topological, not array order — a documented current limitation, §12.4) and must use `error`/`warning` levels genuinely, not just `info` for everything, since a log stream that's always `info` provides no signal for the Incident Response process (§57).

**Definition of Done:** a real pipeline execution's logs can be used to reconstruct what actually happened, in the actual order it happened, with severity levels that distinguish real failures from normal progress.

---

## 56. Monitoring

**Purpose.** What should be watched in aggregate across many executions, distinct from per-execution logging (§55).

**Target KPI framework** (`knowledge-import/08_Test_Analytics.md`): AI Quality (Accuracy/Completeness/Consistency ≥ 95%, Hallucination Rate ≤ 2%, Structured Output Success ≥ 99%), Cost (per execution/pipeline/prompt/product/release, token consumption, monthly spend, budget utilization), plus a Quality Scorecard format:
```
Quality.............96
Reliability.........98
Latency.............91
Cost................87
Safety..............99
Overall.............94
```
Alert triggers (target): quality degradation, cost spikes, latency increase, failed regression tests, confidence below threshold, production incidents.

**Current reality:** none of this is implemented; there is no dashboard, no alerting, no aggregation of `Run` records beyond the Playground screen's simple run-history list.

**Mandatory rule when this is built:** wire alerting to the same thresholds already established elsewhere in this document (Product Review ≥ 85, Architecture Review ≥ 90, confidence 0.72 threshold, KPI targets above) rather than inventing new, uncoordinated thresholds.

**Definition of Done:** a monitoring dashboard's thresholds are traceable to a specific chapter of this document, not arbitrarily chosen.

---

## 57. Incident Response

**Purpose.** Process for handling a production issue, once there is a production to have issues in — currently forward-looking, since there is no deployed production system.

**Template** (new — no existing incident template was found in the repository; modeled on the Decision Record structure, §41, for consistency):
```markdown
# INC-000. <Short title>

## Severity
Critical | High | Medium | Low

## Detected
Timestamp, how detected (alert, user report, manual discovery)

## Impact
Who/what was affected, for how long

## Timeline
Chronological events

## Root Cause
Cite the actual code/config/data cause — not a symptom

## Immediate Mitigation
## Root Fix
## Related Orchestrator Error Type
If applicable, map to one of `orchestrator/ERROR_HANDLING.md`'s 9 error_ids (§23.6) — this connects incident response to the existing (spec-only) error taxonomy rather than inventing a parallel one.

## Follow-up Actions
## Prevention
```

**Mandatory rule:** an incident's Root Cause section must cite evidence (§24), not speculation — "we think it was the model provider" is not a root cause until confirmed by a log (§55) or a reproduction.

**Definition of Done:** an incident record has a confirmed root cause and at least one follow-up action with an owner before being closed.

---

## 58. Release Management

**Purpose.** How a change moves from "done" to "in the version the user experiences," given this is a Local-Storage-only app with no deployment pipeline today.

**Current reality:** a CI workflow exists (`.github/workflows/ci.yml`, added 2026-07-03 — runs `npm run lint` and `npm test` on push/PR to `main`), but there is **no remote git host configured yet** (§59), so this workflow does not actually execute anywhere until the repository is pushed to a GitHub remote — treat it as "ready, not yet running," not as "CI is enforcing quality today." `package.json` scripts are `dev`, `build`, `start`, `lint`, `test`, `test:watch`. "Releasing" still means running `npm run build` locally; there is no automated deploy target.

**Target release model** (`knowledge-import/16_Development_Roadmap.md`, aspirational): release channels Internal Alpha → Private Beta → Public Beta → GA → Enterprise LTS, gated by the Production Readiness minimums in `knowledge-import/17_Acceptance_Criteria.md` (Product Readiness ≥ 90, Regression Success = 100%, Security Review passed, Documentation complete, Monitoring enabled, Rollback available).

**Mandatory rule for this repository today:** do not claim a change is "released" or "shipped" — it is at most "merged" or "verified locally" until an actual deployment/CI pipeline exists. Use precise language matching the actual mechanism.

**Definition of Done:** a change's status is described using terminology that matches what actually happened (built locally, verified in `npm run dev`) rather than borrowed release language that implies infrastructure that doesn't exist yet.

---

## 59. Git Workflow

**Purpose.** Git conventions for this repository, now that one exists.

**Current state:** git was initialized 2026-07-03 with a baseline commit capturing the pre-roadmap state, `.gitignore` covers `node_modules`, `.next`, `.npm-cache`, `.DS_Store`, build artifacts, and env files (verified: `git status` shows a clean working tree relative to these patterns). There is no remote configured yet — this is a local repository only.

**Mandatory rules:** new commits over amends, no force-push without explicit confirmation, no `--no-verify`, descriptive commit messages explaining *why* not just *what*, never commit `pdf-notes.txt`-like raw business/PII material carelessly (§50) — it is already tracked as of the baseline commit because it was already sitting in the working tree; treat any *future* similar raw import the same way only after the §50 privacy review, not automatically.

**Branch types** (target, from `knowledge-import/11_Version_Control.md`, generalized from artifact versioning to code): Main, Feature, Experiment, Hotfix, Release — reuse this vocabulary for git branches too, rather than inventing a separate branching taxonomy for code vs. artifacts.

**Mandatory rule:** initializing git for this repository is itself a decision worth flagging (§63) — it directly blocks meaningful code review history, `git blame`-based investigation, and ADR cross-referencing by commit.

**Definition of Done:** once git exists, every non-trivial commit message states why the change was made, not just what changed (the diff already shows what).

---

## 60. Documentation Standards

**Purpose.** How documentation in this repository should be written, consolidating the conventions already discovered.

**Mandatory rules:**
- **DOC-1.** Russian for human-readable product/domain/UX prose, English for technical identifiers/code/JSON (§2, principle 9, R-009) — already the universal convention across `orchestrator/`, `skills/`, most of `docs/`. This document (`CLAUDE.md`) is in English because it is an engineering/process document primarily consumed by engineering tooling (including Claude), not product prose — that's a deliberate exception, not a violation.
- **DOC-2.** Every knowledge-system document (in the style of `orchestrator/*.md`, `skills/*/*.md`) follows the section skeleton: Назначение (Purpose) → Ответственность (Responsibility) → body → Взаимосвязь с другими документами (Relationships) → Обязательные разделы (Required sections) → Рекомендации (Recommendations) → Пример (Example) → Критерии качества (Quality criteria) → Ссылки на используемые практики/framework (References). This is already 100% consistent across all 36 files in `orchestrator/`+`skills/` — any new document in that style must follow it too.
- **DOC-3.** Every entity's `README.md` states: purpose, storage relationship (aggregate root vs. embedded vs. reference), lifecycle (or explicit "no lifecycle" note), and key validation rules — matches the existing 12 entity READMEs' shape.
- **DOC-4.** Documents that describe implemented behavior (`docs/design/`, `docs/ux/`, `docs/domain/`, `docs/mvp/`) must be checked against the actual code before being trusted or edited — see §31.10 for a documented case where they've already drifted apart.
- **DOC-5.** Cross-reference IDs precisely and with their source file (§31.6/31.7) — bare "D-001" or "AP-003" is ambiguous in this repository specifically.

**Definition of Done:** a new document follows the convention of its category (Russian knowledge-system skeleton, or English engineering doc) and cross-references other documents by qualified ID, not bare number.

---

## 61. Repository Conventions

**Purpose.** File/directory-level conventions not covered elsewhere.

**Mandatory rules:**
- **RC-1.** Empty scaffold directories use `.gitkeep` only — this is already the universal convention (`framework-library/*`, `templates/*`, `skills/ai-engineering|evaluation|product-management`, `docs/architecture|decisions|product`, `src/widgets`) — do not put a placeholder `README.md` saying "TODO" in one of these; either populate it for real or leave the `.gitkeep`.
- **RC-2.** `.DS_Store` files exist scattered through the repo (`docs/`, `framework-library/`, `knowledge-import/`, `skills/`, `src/`, `templates/`, root) — these are macOS artifacts, not meaningful content; do not treat their presence/absence as signal about anything, and add a `.gitignore` entry for them the moment git is initialized (§59).
- **RC-3.** Do not create a new top-level directory without updating §5 (Repository Intelligence)'s lookup table in the same change — that table is only useful if it stays exhaustive.

**Definition of Done:** the repository's top-level structure matches what §5 and §8.1 describe, always — those two sections are the contract for "what's where."

---

## 62. Continuous Refactoring

**Purpose.** When and how to refactor, distinct from feature work.

**Mandatory rules:**
- **CR-1.** Refactor the specific code you touched for your actual task (§4, step 7) — never drive-by refactor unrelated files in the same change (§2 anti-patterns, M-1.1).
- **CR-2.** A refactor that changes an entity's schema shape follows the same additive-first discipline as §9.5 DDD-1 — breaking changes need a version bump and a migration note, not a silent shape change.
- **CR-3.** The six empty `features/*` stubs (§8.3) are refactor *targets*, not refactor *debt* — do not "clean them up" by deleting them; they represent a deliberate, documented decomposition plan.

**Definition of Done:** a refactor's diff is scoped exactly to what the task required, with no unrelated files touched "while I was in there."

---

## 63. Technical Debt

**Purpose.** The authoritative list of technical debt already identified in this repository through the discovery work behind this document — start here before hunting for new debt, so effort isn't duplicated.

**Known technical debt (numbered for reference in future work):**
1. **~~Zero automated tests~~ — PARTIALLY RESOLVED 2026-07-03.** Vitest is installed; domain layer (`shared.ts` + 6 of 12 entities) has test coverage (§19). Remaining: Architecture/Framework/KnowledgeModule/Model/Product/Prompt entities, all stores, all UI, the simulation engine.
2. **~~No git repository at all~~ — RESOLVED 2026-07-03** (§59). **~~No CI/CD pipeline~~ — PARTIALLY RESOLVED 2026-07-03**: `.github/workflows/ci.yml` exists and runs lint+test, but is dormant until a GitHub remote is configured (§58) — closing this fully requires a decision to actually push this repository somewhere, which is a product-owner-level call (where does this code live) outside this document's authority to decide unilaterally.
3. **~~Decorative, non-functional tabs~~ — RESOLVED 2026-07-03** in `product-screen.tsx` and `architecture-screen.tsx` (§31.10) — tabs now gate content, verified in-browser.
4. **~~Cascading delete gaps~~ — RESOLVED 2026-07-03**: both `project-store.ts`'s `deleteProject` and `LocalStorageProjectRepository`'s `deleteProject` now also remove `Run`s belonging to a deleted pipeline and `Review`s targeting the project or any of its removed product/architecture/pipeline/run ids. Covered by tests in `local-storage-repository.test.ts`.
5. **~~Two parallel, partially-overlapping mutation APIs~~ — CLARIFIED 2026-07-03 (not refactored):** confirmed by tracing every call site that the Zustand stores exclusively use `setSnapshot` (whole-snapshot writes, cheap for Local Storage) and that `LocalStorageProjectRepository`'s `upsertProject/deleteProject/upsertProduct/upsertArchitecture/upsertPipeline/upsertRun` are called by **zero** production code paths today. Resolution: these are not accidental duplication to delete, but the intentional forward-compatibility contract for a future network-backed repository (§8.7) — documented as such directly on `ProjectRepository` in `src/shared/repositories/types.ts`. Migrating the stores to actually call them is deferred until a real backend exists (rewriting every store against a Local-Storage-only backend has no present benefit, §2 principle 6) — tracked as a future task, not done now.
6. **~~`Edge.condition.expression` and `Node.metadata` are untyped strings~~ — MOSTLY RESOLVED 2026-07-03**: `Edge.condition` is now a structured, typed `{field, operator, value}` shape (§12.3, §14.2) **with a real evaluator** used by the Production Pipeline Runtime (§12.4a). `Node.metadata` remains an untyped `Record<string,string>` and unused — still open.
7. **~~`Prompt` has no lifecycle status and `ReviewTargetType` doesn't include `"prompt"`~~ — RESOLVED 2026-07-03** (§16): `Prompt.status` and `ReviewTargetType: "prompt"` both exist now. **Still open**: no runtime code actually checks them before a pipeline treats a prompt as usable — that check belongs in the (still unimplemented) orchestrator gate logic, §23.3.
8. **`pdf-notes.txt` sits unstructured at the repository root**, referencing two nonexistent paths (`reference/miro-as-is/`, `research/…`) and containing un-scrubbed real business/PII-adjacent data (§3.3, §50) — needs restructuring and a privacy review, not just a file move.
9. **~~`docs/architecture/` empty~~ — RESOLVED 2026-07-03**, now holds `AS_IMPLEMENTED.md`. **`docs/product/` still empty** (§7). **`docs/decisions/` — RESOLVED 2026-07-03**, now holds DEC-001/002/003 (§41).
10. **Orchestrator/skills internal inconsistencies** cataloged exhaustively in §31 — none block current MVP operation (since none of that logic is implemented in code yet) but will block real orchestrator implementation if not resolved via ADR first.
11. **~~Simulation Engine ignores `Node.promptId`/`modelId`/`temperature` entirely~~ — SUPERSEDED 2026-07-03**: Playground no longer uses the Simulation Engine at all (§12.4a) — it calls the real Pipeline Executor, whose `llm`/`agent` handlers genuinely resolve `promptId` (via the Prompt Registry) and `modelId` (via the Model catalog → `LLMProvider`) for every such node, not just one recognized node. The Simulation Engine itself (§12.4) still has this limitation but is no longer load-bearing.
12. **Pipeline canvas renders 0 edges — PARTIALLY RESOLVED 2026-07-03.** Found 2026-07-03, confirmed present in the pre-roadmap baseline (not a Roadmap regression). Cause A (layout) and half of Cause B (node visibility) are fixed and verified in-browser; edges themselves still do not render — do not close this debt item until `.react-flow__edge` count is confirmed > 0. Two distinct, stacked causes found:
   - **Cause A — RESOLVED 2026-07-03.** At viewport widths below ~1280+360px (Sidebar 248px + a positive canvas width + NodeInspector's fixed `w-[360px]`), the row `<div className="flex min-h-0 flex-1">` in `pipeline-screen.tsx` had to shrink its two children (`<div className="min-w-0 flex-1">` wrapping `<ReactFlow>`, and the `w-[360px]` `NodeInspector` aside). Because the canvas wrapper's Tailwind `flex-1` resolved to `flex: 1 1 0%` (flex-basis **0**) with an explicit `min-w-0` removing the flex item's normal `min-width: auto` protection, CSS flexbox's shrink algorithm distributed 100% of the required shrinkage to whichever sibling had nonzero basis (the aside), leaving the canvas wrapper locked at exactly **0px width**. **Fix:** replaced `min-w-0` with `min-w-[320px]` on the canvas wrapper — CSS `min-width` overrides a flex item's computed shrink result (well-established flexbox behavior, not a guess), so the canvas now has a guaranteed floor and the aside compresses to fit instead. Verified via `getBoundingClientRect()` at both a narrow viewport (949px: canvas 320px, aside ~98px, previously canvas 0px) and the documented minimum (1280px: canvas 320px, aside 352px, previously canvas 312px/aside 360px) — canvas width is now never zero.
   - **Cause B — PARTIALLY RESOLVED 2026-07-03, root-caused by reading the installed `@xyflow/react` source directly (`node_modules/@xyflow/react/dist/esm/index.js`), not guessed.** Two real, separate bugs were found and one is fixed:
     - **B1 (fixed).** `pipeline-screen.tsx`'s node-sync `useEffect` had `pipeline` (the whole object, a fresh reference every render from `getProjectBundle`) in its dependency array *alongside* `pipeline?.nodes`/`pipeline?.edges`, which are already derived from it. This caused the effect to re-run on every render, forever. Fixed by dropping the redundant `pipeline` dependency. Confirmed via a from-scratch cold server restart (cleared `.next`, fresh `npm run dev`) that a stray "final argument passed to useEffect changed size between renders" React error seen earlier was an HMR/Fast-Refresh artifact of live-editing during the investigation, not a real bug — it does not reproduce on a clean load.
     - **B2 (root-caused, node half fixed, edge half still open).** React Flow only marks a node `visibility: visible` once `hasDimensions` is true (`index.js:2342`), but only computes edge-connectable `handleBounds` — required before `EdgeRenderer` will draw anything connected to that node — once its per-node `ResizeObserver` callback fires and calls the store's `updateNodeInternals` (`index.js:2126-2151, 2166-2175`). In this app, nodes were auto-measured via that ResizeObserver and never completed (nodes stayed `visibility: hidden` indefinitely). **Fix applied:** `toFlowNodes()` in `pipeline-screen.tsx` now sets explicit `width: 180, height: 40` on every flow node (`index.js:2026` confirms `node.width`/`node.height` are honored ahead of measurement) — **verified in-browser on a clean cold reload:** all 8 demo nodes now render with `visibility: visible` and the exact `180x40` explicit size, up from `visibility: hidden` before. **Still open after a second, deeper investigation pass (2026-07-03) — exhausted the fixes discoverable without React DevTools; do not attempt a third blind fix without them.** `.react-flow__edges` still renders 0 children (confirmed: not even the unconditional `<MarkerDefinitions>` sibling appears, meaning `EdgeRendererComponent`'s return value isn't reaching the DOM at all, not just an empty edge-id list). Two additional documented, standard fixes were tried and both failed to change the result:
- Added a `NodeInternalsSync` child component calling the public `useUpdateNodeInternals()` hook (React Flow's own documented remedy for "nodes added/changed after initial mount need an explicit nudge") after every `flowNodes` change. Verified this itself doesn't error and doesn't loop (it initially caused a real infinite-render bug via an unmemoized `flowNodes.map(...)` array literal recreated every render — fixed with `useMemo`, confirmed the page no longer hangs) — but `.react-flow__edge` count is still 0 after this.
- Ruled out (via a monkey-patched `ResizeObserver` and a genuine forced node resize) that this is a simple "observer never fires" problem in this environment — a manual resize of an actual measured node element still didn't unblock edges, and confirmed the container-level `width`/`height` (a separate measurement path from per-node `handleBounds`) resolves correctly and the "needs a width and a height" console warning no longer fires at all on a clean load.
- Remaining hypothesis, not confirmed: `node.internals.handleBounds` for each node is still `undefined`, gating `EdgeWrapper` (or `EdgeRendererComponent` itself) from rendering. Confirming this requires reading the live Zustand store state directly (`node.internals.handleBounds`), which is not reachable from plain DOM/console inspection in this tool set — it needs either real React DevTools (Components tab, not available in the automated preview environment used for this investigation) or a temporary instrumented local build of `@xyflow/react` with debug logging added to `updateNodeInternals`/`EdgeWrapper`. Whoever picks this up next should start there, not repeat the container-sizing or `useUpdateNodeInternals` fixes already tried and ruled out here.
- This has now consumed substantial investigation time across two sessions for a single-screen visualization defect that does not affect the domain model, the Production Pipeline Runtime, or any business logic — deprioritized below the Runtime epic per explicit product-owner instruction.
   - **Do not mark this item resolved** based on fixing Cause A alone — Cause B independently keeps `.react-flow__edge` count at 0 even when Cause A is not in play (verified at 1280px width, where Cause A does not trigger).
   - **Cause C — a real bug found and fixed 2026-07-04 (v2.0 audit, third investigation pass), but edges STILL do not render after fixing it — do not close this item.** `pipeline-screen.tsx`'s canvas root div hardcoded `h-[calc(100vh-56px)]` (a raw viewport-height calculation duplicating "100vh minus the Header's `h-14`") instead of `h-full` like the correct pattern already used by its own ancestors (`Workspace` is already sized correctly by the AppShell grid + flex chain, per §8.4). This is fragile by construction — it silently assumes the Header is always exactly 56px, and depends directly on `100vh`, which real mobile browsers already treat unreliably (address-bar show/hide) and which, in the automated Claude Preview tool used for this investigation, was independently confirmed to sometimes evaluate `window.innerHeight`/`document.documentElement.clientHeight` as literal `0` (verified via direct `getBoundingClientRect()` reads on `.react-flow`, not just a JS-property glitch) even while the tool's own `screen.width`/`screen.height` reported a normal physical display size. **Fix:** changed the root div to `h-full`, letting it inherit height from the already-correctly-sized flex chain instead of recomputing it from `100vh`. **Verified:** in the same tool, `.react-flow`'s measured height went from `0px` (before) to `624`–`763px` (after, across repeated checks) and a full screenshot after the fix showed the Toolbar, MiniMap, Controls, and all 8 nodes rendering correctly — a dramatic improvement over the fully collapsed/empty canvas seen before this fix. **However:** even in this now-correctly-sized state, `.react-flow__edges` still has 0 children and `.react-flow__edge` count is still 0 — Cause C explains and fixes a real, independent bug (and is worth keeping regardless of its effect on edges, since `100vh`-dependent sizing is a known real-world fragility), but it is **not** the root cause of the edges-never-render symptom. Cause B's `node.internals.handleBounds` hypothesis (§ above) remains the live, unconfirmed lead.
   - **Investigation hazard found, not a shipped bug — record this so it isn't rediscovered the hard way.** While instrumenting this screen to inspect live React Flow store state (`useStoreApi()`, or an inline/non-`useCallback`-memoized `onInit` prop on `<ReactFlow>`), adding *either* one on its own reproducibly triggered a severe, continuous infinite re-render loop (observed via an instrumented counter: tens of thousands of re-renders within 1–2 seconds) — confirmed absent on the exact same code with the debug addition removed, and confirmed absent again once the same `onInit` callback was wrapped in `React.useCallback(..., [])` for a stable reference. **Any future investigator adding an extra consumer of the React Flow store/instance to this screen for debugging MUST memoize it** (a stable `useCallback`/module-level reference), or it will self-inflict a loop that looks exactly like a new instance of this bug but isn't — lost significant time in this session before that was isolated. No such unmemoized consumer exists in the shipped code today.
   - **Tooling caveat for whoever investigates next:** this session's `preview_eval`/`preview_screenshot` calls were unreliable independent of any of the above — repeated timeouts on trivial expressions, and at least one screenshot showing a collapsed/empty canvas while a `getBoundingClientRect()` check moments later (after a fresh server restart) confirmed the container had a real, substantial height. Don't trust a single failed or contradictory screenshot as evidence of an app bug in this environment; corroborate with a DOM measurement, and if they disagree, prefer a fresh server restart before concluding anything. This does not invalidate Cause C (confirmed via multiple independent restarts and both measurement methods agreeing), but it does mean Cause B remains genuinely unconfirmed either way, not confirmed-then-lost.

**Template for logging new debt found during future work:**
```markdown
# TD-000. <Short title>
## Location
File(s)/module
## Description
## Impact
## Suggested Fix
## Effort Estimate
## Priority
```

**Mandatory rule:** when you fix an item from the numbered list above, update this chapter to mark it resolved (with a pointer to the change) rather than leaving a stale claim in this document — this document must stay evidence-based (§2 principle 4) about itself, too.

**Definition of Done:** a new piece of debt discovered during any task is logged here (or in a linked `TD-NNN` record) in the same change that discovered it, not left as an unrecorded "by the way."

---

## 64. Code Review

**Purpose.** What a reviewer (human or agent) should check, given this repository's specific architecture and known failure modes.

**Mandatory review checklist:**
- Does the change respect FSD layering (§8.2) — no `entities` importing `features`, no `shared/ui` importing business logic?
- Does a new/changed entity have all three `model/` files and its `README.md` in sync (§9.1)?
- Does a new document use qualified IDs, not bare `D-XXX`/`AP-XXX` (§31.6/§31.7)?
- Does a UI change wire up any interactive element it visually implies (checking specifically for the §31.10 "decorative tabs" failure mode)?
- Does a change touching `LocalStorageProjectRepository` or a store keep the `deleteProject` cascade (products/architectures/pipelines/runs/reviews, §63 item 4, resolved 2026-07-03) consistent between both implementations, or at least not regress it silently?
- Does a claim of "tested" or "evaluated" in the PR description point to something real (§19, §24) rather than an unverified assertion?
- Is new technical debt logged (§63) rather than silently introduced?

**Definition of Done for a review:** every item above has an explicit yes/no/n-a answer, not a rubber-stamp approval.

---

## 65. Self Review

**Purpose.** What an autonomous agent (or a solo engineer) must check before declaring a task complete, since this repository frequently has no second reviewer.

**Mandatory self-review checklist, before ending any task:**
1. Re-read every file you changed, once, straight through — not a diff skim.
2. Confirm every claim you're about to report ("tests pass," "this matches the spec," "no regressions") is something you actually verified, per AD-1/AD-6 (§4) — if you didn't run it, say so.
3. Check §63's technical debt list — did your change touch any of those items? If it fixed one, update §63. If it's adjacent to one but didn't fix it, say so explicitly rather than implying it's resolved.
4. Check §31 — did your change touch anything covered by a canonical vocabulary decision? If so, does your change follow the stated resolution?
5. Check whether documentation (§60) needs updating alongside the code change — and update it in the same pass, not as a follow-up "later."

**Definition of Done:** you can answer all five checklist items about your own change without re-reading the whole repository again from scratch.

---

## 66. Quality Gates

**Purpose.** Consolidate every numeric/binary gate already established across this document into one reference table, since they're scattered across many chapters by necessity but are most useful side by side.

| Gate | Threshold/Criterion | Source |
|---|---|---|
| `gate_product_complete` | Product Review score ≥ 90 (per DEC-003, Accepted; spec text still literally says ≥ 85) | §23.3, §23.4 |
| `gate_architecture_complete` | Architecture Review score ≥ 90 | §23.3 |
| `gate_pipeline_complete` | All nodes have I/O contracts, no orphans, retry/fallback defined | §23.3 |
| `gate_ready_for_testing` | Pipeline Complete passed + test scenarios exist | §23.3 |
| `gate_ready_for_production` | Playground results + Final Review + no blocking issues | §23.3 |
| Confidence routing | ≥ 0.72 → auto-proceed; < 0.72 → human review (0–1 scale, §25) | `demo-data.ts` |
| AI Quality KPIs (target) | Accuracy/Completeness/Consistency ≥ 95%, Hallucination ≤ 2%, Structured Output Success ≥ 99% | §27, §56 |
| Product Readiness (target, platform-wide) | ≥ 90 for release | `knowledge-import/09`, `17`, `18` |
| PM Review bands | 90–100 approved / 75–89 approved w/ minor recs / 60–74 revise / 0–59 rejected | §35, `skills/senior-product-manager/REVIEW.md` |
| Architect Review bands | Same numeric bands, different weighted criteria | `skills/senior-ai-solution-architect/REVIEW.md` |

**Former asymmetry, now resolved:** the orchestrator spec's literal text allowed the Product gate to pass on the PM's "approved with minor recommendations" band (85–89) while the Architecture gate demanded the architect's full "approved" band (90+). DEC-003 (Accepted 2026-07-03) closed this gap by raising the Product gate to 90 — both gates now require the same rigor.

**Definition of Done:** any gate check in code or process cites the exact threshold from this table, never a paraphrase like "pretty good score."

---

## 67. Definition of Ready

**Purpose.** When is a piece of work ready to start, consolidated from the PM/architect skills' own DoR sections and generalized.

**General DoR** (any task): problem/goal stated in one sentence; relevant existing entities/files identified (§5); evidence grade stated if a product/business claim is involved (§24); DoR for the specific artifact type below also satisfied.

**DoR for a PRD** (`skills/senior-product-manager/CHECKLIST.md`): validated or explicitly bounded problem; goals/non-goals stated; requirements linked to evidence; success metrics defined; AI considerations filled if an AI capability is present; open questions non-blocking.

**DoR for an AI Architecture** (same source): AI capability map defined; data/context sources stated; expected output schema defined; evaluation strategy set; hallucination and safety risk assessed; human-in-the-loop policy defined if needed; cost/quality/latency targets stated.

**DoR for architecture review** (`skills/senior-ai-solution-architect/CHECKLIST.md`): PRD available; Product Review available; AI Capabilities described; success metrics/constraints stated; risk context defined.

**Definition of Done for this chapter:** a task not meeting its artifact-specific DoR is sent back for clarification before implementation starts, not "fixed along the way."

---

## 68. Definition of Done

**Purpose.** The repository-wide DoD, layering the general engineering bar on top of the artifact-specific DoDs already stated throughout this document (each chapter above has its own; this is the umbrella version).

**General DoD, every task:**
- Problem actually solved (not just code written).
- Architecture improved or deliberately preserved (§8, §9) — never silently degraded.
- Whatever automated checks exist (currently: `npm run lint` only, §19) pass.
- Documentation updated in the same change (§60, §9.5 DDD-2).
- No new undocumented technical debt (§63) — logged if introduced, avoided if avoidable.
- No repository fact was invented (§4 AD-1) — everything claimed was checked.
- Self-review (§65) completed.

**Artifact-specific DoD reminders** (already stated in full at their source chapter — cross-referenced here, not restated, so this list doesn't drift out of sync with them): Entity (§9.1/§9.5), Prompt (§15/§16/§18), Pipeline (§13/§39), Feature (§36/§37), ADR (§41), Incident (§57).

**Definition of Done for this chapter:** a task claiming completion satisfies the General DoD above plus whichever artifact-specific DoD applies, both explicitly, not just "it builds."

---

## 69. Working Agreement

**Purpose.** How humans and autonomous agents collaborate on this specific repository — the social contract layered on top of the technical rules above.

**Agreement:**
- The human Product Manager/owner retains final decision authority on: scope, priority, whether to build toward AI Product OS (§3.1) vs. the concrete call-analysis case (§3.3) first, and any ADR ratification (§41).
- An autonomous agent working on this repository makes independent engineering decisions whenever the answer is inferable from the repository (per §4 AD-2) and asks only when it genuinely isn't.
- Disagreements between documents (§31) are surfaced, not silently resolved by whichever agent happens to touch the code first.
- "I don't know" or "this isn't implemented yet" are acceptable, expected answers in this repository given how much of `knowledge-import/`/`orchestrator/` is specification-only — treat an honest gap report as more valuable than a confident fabrication (§4 AD-6, §2 principle 5).

**Definition of Done:** at the end of a working session, both the human and the record left behind (code + docs + this document's updates) agree on what state the repository is in.

---

## 70. Continuous Improvement

**Purpose.** How this document itself, and the repository's engineering practice, should evolve.

**Mandatory rules:**
- **CI-1.** This document is not static. When a chapter's factual claim about the code becomes false (a refactor changes a schema, a gate threshold changes via ADR), update this document in the same change — a stale CLAUDE.md is worse than none, because it's trusted by default.
- **CI-2.** New conflicts discovered between documents get added to §31 immediately, not left for "someone to notice eventually."
- **CI-3.** New technical debt gets added to §63 immediately (§65 self-review step 3).
- **CI-4.** Every ADR (§41) that resolves a `[FLAGGED INCONSISTENCY]` in this document should be followed by an edit to the relevant chapter removing the "pending ratification" language and citing the ADR.
- **CI-5.** Periodically (there is no fixed cadence enforced by tooling yet — treat "every time this document feels stale" as the trigger) re-run the kind of full-repository discovery that produced this document, to catch drift between `knowledge-import/`/`orchestrator/`/`skills/` and the actual `src/` implementation as it grows.

**Definition of Done:** six months from now, this document is still an accurate map of the repository, not a historical artifact describing a version of it that no longer exists.

---

## 71. Final Engineering Rules

**Purpose.** The rules that don't fit neatly elsewhere but matter enough to state plainly, as a closing chapter.

1. **This document outranks any narrower document when they genuinely conflict** — but "outranks" means "provides the tie-breaking resolution stated in §31 or demands an ADR," never "silently overrides without explanation."
2. **Never edit `knowledge-import/`, `orchestrator/`, or `skills/*` files to make them agree with this document's resolutions.** Those files remain the historical record of what was specified; this document's canonical decisions are additive interpretation layered on top, formalized later via ADR (§41) if the underlying files themselves need to change.
3. **`skills/*` files are live application data** (§0.2, §10 SB-3) — check `demo-data.ts` for `path:` references before ever moving, renaming, or restructuring anything under `skills/`.
4. **This repository has partial tests, no CI yet, and git history only from 2026-07-03 onward.** Every claim of verification in this document is backed by either an actual `npm test`/`npm run lint` run or is explicitly marked as manual. Do not let the thoroughness of this document's prose imply more automated rigor than currently exists — check §19 and §63 for the current, evolving truth.
5. **The call-analysis business case (§3.3) is real; the AI Product OS vision (§3.1) is aspirational.** When forced to choose which to build toward with limited time, default to strengthening the real case unless explicitly told otherwise (§3.4).
6. **When this document is wrong, fix it — but fix it with the same evidence discipline used to write it**: read the actual file, quote the actual content, state the actual line/schema, don't paraphrase from memory.

**This document's own Definition of Done:** any engineer or agent picking up this repository for the first time can, after reading this file once, correctly answer "what is this, what exists, what doesn't, and where do I look next" — without needing anyone else to explain it to them.

---

## Appendix A — Remaining Templates

The templates for Feature Specification, Prompt Specification, Pipeline Specification, Agent Specification, and ADR are defined in place at §37, §38, §39, §40, §41 respectively. Technical Debt and Incident templates are at §63 and §57. The remaining four templates follow.

### A.1 Experiment Report

```markdown
# EXP-000. <Experiment name>

## Baseline
Version(s) being compared against — cite Pipeline/Prompt version explicitly (§17, §29).

## Change
What specifically changed (one block at a time — pdf-notes.txt's Этап discipline, §29).

## Dataset
Which golden/example set, version (§26).

## Evaluators
Deterministic scorers used + model-judge criteria (§18, §27).

## Result
| Metric | Baseline | New | Delta |

## Decision
Promote | Reject | Iterate — per the rule "only if the metric improved" (§29).

## Evidence
Links to raw per-example outputs (§24) — not just the aggregate table.
```

### A.2 Evaluation Report

```markdown
# EVAL-000. <Pipeline/Prompt name>, version <X>

## Scope
Which node(s)/prompt(s) evaluated.

## Method
Exact Match | Semantic Similarity | LLM-as-Judge | Rule-Based | Human Review | Hybrid (§27).

## Dataset
Golden dataset version (§26), size, composition (representative/edge/failure/adversarial case counts, §26 GD-2).

## Scores
Per the AI-pattern-appropriate metric table (§27) — cite which `ai_pattern_id` governs the metric choice.

## Confidence Distribution
Using the 0–1 scale (§25) — histogram or summary stats.

## Blocking Issues
Anything meeting a Review's blocking-issue criteria (§23.3, architect/PM REVIEW.md blocking lists).

## Recommendation
Approved | Approved with recommendations | Revise | Rejected — using the exact bands in §66.
```

### A.3 Architecture Review

```markdown
# ARCH-REVIEW-000. <Architecture name/version>

## Scored Dimensions
(architect REVIEW.md weights, sum to 100): Simplicity(10) Scalability(10) Reliability(12) Maintainability(10) Cost(10) Performance(8) AI Quality(15) Observability(10) Security(10) Extensibility(5)

## Score
## Blocking Issues Checked
- AI used without necessity comparison to Rules/Workflow (§13, AP-001)
- No Evaluation Strategy
- No fallback for a critical AI step (§13)
- No observability for production AI calls (§54)
- High-risk output without Human Review
- No data retention/access policy (§48, §50)
- Model chosen without quality/cost rationale (§52)
- Agent used instead of predictable Workflow, unexplained (§20)

## Decision
Approved (90-100) | Approved with recommendations (75-89) | Revise (60-74) | Rejected (0-59) — blocking issues override score (§66).

## Required Changes (if not approved)
```

### A.4 Repository Audit

```markdown
# AUDIT-000. Repository Audit, <date>

## Scope
Which chapters of CLAUDE.md were re-verified against current `src/`/`docs/`/`knowledge-import/`/`orchestrator/`/`skills/` state.

## Drift Found
| Claim in CLAUDE.md | Chapter | Still True? | Correction Needed |

## New Technical Debt Found
(append to §63)

## New Terminology Conflicts Found
(append to §31)

## New Canonical Decisions Needed
(append candidate ADRs, §41)

## Overall Assessment
Is this document still trustworthy as the single source of truth, or does it need a significant rewrite pass?
```

**Mandatory rule for all four templates above:** every field must be filled with a real reference (a file path, a version string, a schema field) — an empty or "N/A" field in an evaluation, experiment, or audit report should prompt the question "was this actually checked?" rather than being accepted silently.

---

*End of document. Last synthesized 2026-07-03 from a full-repository discovery pass covering `knowledge-import/` (20 files + README + CLAUDE.md), `pdf-notes.txt`, `orchestrator/` (8 files + README), `skills/senior-ai-solution-architect/` (15 files + README), `skills/senior-product-manager/` (13 files + README), `docs/design/` (8 files), `docs/ux/` (9 files), `docs/domain/` (4 files), `docs/mvp/` (4 files), and the full `src/` tree (12 entities, 7 stores, the repository/simulation layer, `shared/ui`, and `features/mvp`). Every concrete claim above was checked against a real file at time of writing — see §31 for the terminology conflicts found and §63 for the technical debt found during that pass.*

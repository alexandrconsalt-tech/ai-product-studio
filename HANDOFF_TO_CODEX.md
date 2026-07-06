# Handoff to Codex — AI Product Studio

> This file aggregates and indexes context that already exists in this repository. It does not replace `CLAUDE.md` or any other document — it tells you what exists, what's current vs. stale, and where to look for what. Read this file first, then follow its navigation.

## 0. Links

- **Production:** https://ai-product-studio-alpha.vercel.app/
- **GitHub:** https://github.com/alexandrconsalt-tech/ai-product-studio (branch `main`)
- **Vercel project:** `ai-product-studio` (see `.vercel/project.json` — already linked, `projectId`/`orgId` present)

## 1. Executive summary

AI Product Studio is a **local-storage-only, single-tenant Next.js demo app** — an IDE-style workspace for an AI Product Manager to define a product, test its AI pipeline live against real LLM calls (BYOK — user pastes their own Anthropic/OpenAI key, stored only in `localStorage`), and see aggregate quality/cost metrics. There is **no backend, no database, no auth** — every "entity" (Product, Pipeline, Run, etc.) lives in one JSON blob in the browser's `localStorage`, validated by Zod on load.

The visible app has exactly three sections: **Продукт → Песочница (Playground) → Дашборд**. Five demo products are seeded, most importantly:
- **AI Call Analysis** — the reference call-transcription-and-summary pipeline (10 stages: STT → validate → extract facts → store → needs → outcome → generate summary → check summary → Quality Gate → CRM save), run live via `public/pipeline-lab-v3.html`, a standalone vanilla-JS tool embedded per-product in an iframe.
- **Генерация текстов объявлений (Ad Copy Generation)** — a second, independently-coded real-run engine (`src/features/mvp/lib/ad-copy-test-bench.ts`) for a different pipeline (real-estate ad copy generation), following the same editable-stage UI convention as Pipeline Lab v3 but with its own TypeScript business logic.

The repository also contains a **large body of pre-existing documentation and vision material** (`CLAUDE.md`, `docs/`, `knowledge-import/`, `orchestrator/`, `skills/`, `templates/`, `framework-library/`) describing a much bigger target platform ("AI Product OS") that is **mostly not implemented**. Section 3 below explains exactly which of these documents describe reality today vs. aspiration.

## 2. Reading order (do this before writing any code)

1. **This file** (you're here) — orientation + links + commands.
2. **`CLAUDE.md`** — the engineering constitution, ~245KB, 71 chapters + dated addenda at the end. This is the **single most important file in the repo** and supersedes everything else on conflict (see its own §0). Don't read all 71 chapters cover to cover; instead:
   - Read **§0** (About This Document — explains the authority hierarchy between `CLAUDE.md`, `knowledge-import/`, `orchestrator/`, `skills/`, `docs/`, `pdf-notes.txt`).
   - Read **§3** (Product Vision — reconciles the aspirational "AI Product OS" vision against the real, narrower business case in `pdf-notes.txt` and what's actually built).
   - **Read every `## Addendum (2026-07-0X...)` section near the end of the file (currently 8 of them, starting ~line 1604).** These are dated, chronological, and are **the actual current state of the app** — the Product→Playground→Dashboard refactor, the Ad Copy Generation product, the Pipeline Lab v3 fixes, the July 6 "V8.1" call-summary prompt rewrite. If anything in an earlier numbered chapter (§1–§70) conflicts with an Addendum, **the Addendum is correct** — earlier chapters are dated 2026-07-03/04 and haven't all been rewritten in place.
   - Jump to specific chapters as needed by topic (table of contents is just every `## N. Title` line — `grep '^## ' CLAUDE.md`).
3. **`docs/architecture/AS_IMPLEMENTED.md`** — a short (62-line) map connecting `knowledge-import/`'s vision to what's actually in `src/`. **Dated 2026-07-03 — written before every Addendum in `CLAUDE.md`, so it does not know about Playground/Dashboard, Ad Copy Generation, or Pipeline Lab v3's embedding-per-product.** Treat it as a rough map of the domain layer only, not current screen/feature state.
4. **`docs/mvp/KNOWN_LIMITATIONS.md`, `docs/mvp/MVP_ARCHITECTURE.md`, `docs/mvp/DEMO_PROJECT.md`, `docs/mvp/SIMULATION_ENGINE.md`** — same caveat as #3: pre-date the July refactors, still useful for the domain-layer/simulation-engine parts that haven't changed.
5. **`docs/domain/*.md`** — entity model, relationships, lifecycle. Still accurate (the 13 entities under `src/entities/` haven't changed shape, only gained a few optional fields — see the first Addendum).
6. **`docs/design/*.md`, `docs/ux/*.md`** — design tokens/components and per-screen UX specs. Mostly still accurate for visual language; some UX docs (`SCREEN_PLAYGROUND.md`, `SCREEN_PROJECTS.md`) describe the pre-refactor navigation and should be read with the same "check against the Addenda" caution as #3.
7. **`knowledge-import/`, `orchestrator/`, `skills/`** — **read these last, and only if your task is about the long-term vision.** Per `CLAUDE.md` §0.2, these describe an aspirational enterprise platform ("AI Product OS") that is 100% documentation, ~0% implementation. The one exception: `skills/senior-ai-solution-architect/` and `skills/senior-product-manager/` are **live application data** — referenced by `KnowledgeModule.path` in `src/shared/repositories/demo-data.ts` — don't move/rename their files without updating that.
8. **`pdf-notes.txt`** (repo root) — the one real, numbers-backed business case (a Miro-board dump about an actual call-transcription product for a real estate CRM, workstream "ИИ в заявке" / VT). `CLAUDE.md` §3.3–3.4 explains why this is the canonical reference case the demo pipelines are modeled on.

## 3. What's current vs. stale — the one thing to get right

| Document | Status |
|---|---|
| `CLAUDE.md` chapters §1–§70 | Mostly current, written 2026-07-03/04 |
| `CLAUDE.md` dated `## Addendum` sections (end of file) | **Most current — authoritative for anything they cover** |
| `docs/architecture/AS_IMPLEMENTED.md`, `docs/mvp/*.md` | Dated 2026-07-03, **pre-date all Addenda** |
| `docs/domain/*.md` | Still accurate |
| `docs/design/*.md` | Still accurate |
| `docs/ux/*.md` | Mostly accurate; navigation-related ones pre-date the Playground refactor |
| `knowledge-import/`, `orchestrator/`, `skills/*` (except the two `senior-*` skill dirs), `templates/`, `framework-library/` | Vision only, not implemented — do not treat as describing real behavior |
| `pdf-notes.txt` | Real business source material, unstructured, never edit in place without care (contains un-scrubbed near-PII per `CLAUDE.md` §3.3/§50) |

No `CODEX.md`, `README.md`, or `PROJECT_CONTEXT.md` existed in this repository before this handoff — `CLAUDE.md` has been playing all three roles. This file (`HANDOFF_TO_CODEX.md`) is new; it does not replace `CLAUDE.md`.

## 4. Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Zod 4** — schema validation for every domain entity and every LLM JSON response
- **Zustand 5** — state (`persist` middleware backs `localStorage`)
- **Tailwind CSS 3** — styling, custom design tokens in `tailwind.config.ts`
- **@xyflow/react (React Flow) 12** — pipeline canvas (only used by the hidden `pipeline-screen.tsx`, has a known unresolved bug — see §9)
- **Vitest 4** + `@testing-library/react` + jsdom — testing (`npm test`)
- No backend framework, no database, no auth provider — see §7.

Feature-Sliced Design (FSD) layering: `entities/ → features/ → shared/ → widgets/` (see `CLAUDE.md` §8/§9, `docs/domain/*.md`).

## 5. Folder structure

```
src/
├── app/              Next.js App Router entry (layout.tsx, page.tsx, providers.tsx)
│   └── api/openai-proxy/route.ts   The only server route — stateless OpenAI CORS relay
├── entities/         Pure domain layer, 13 entities (Product, Project, Architecture,
│                     Pipeline, Node, Edge, Run, Review, Prompt, Model, Framework,
│                     KnowledgeModule, PlaygroundTestRun), each with
│                     schema/types/factory/README.md — no React/Zustand imports
├── features/         Only features/mvp is implemented; ai-architecture/,
│                     pipeline-delivery/, playground/, prd/, product-discovery/,
│                     visual-pipeline/ are empty scaffolding for the aspirational
│                     platform (see §3) — do not assume they contain anything
├── shared/           ui/ (design system components), stores/ (Zustand), 
│                     repositories/ (LocalStorageProjectRepository + demo-data.ts),
│                     llm/ (BYOK provider + the server-side provider-registry.ts),
│                     runtime/ (Production Pipeline Runtime executor),
│                     simulation/, model/ (Ad Copy Zod schemas), prompts/, lib/
└── widgets/          Empty, reserved

public/pipeline-lab-v3.html   Standalone vanilla-JS/HTML tool (~1400 lines), NOT part
                               of the Next.js/React build — embedded via <iframe> per
                               product. Real BYOK LLM calls, own localStorage-based
                               pipeline config with its own versioning scheme.
```

## 6. Key screens (`src/features/mvp/screens/`)

Visible in the nav today (`src/features/mvp/mvp-shell.tsx`'s `visibleNavItems`):
- `product-screen.tsx` — product list + full PM-template card (8 tabs) + AI Assist (dictate/type an idea → LLM fills the card)
- `playground-screen.tsx` — product picker + that product's real test bench (either the Pipeline Lab v3 iframe, or Ad Copy Generation's own panel via `ad-copy-test-bench-panel.tsx`)
- `dashboard-screen.tsx` — aggregate stats/charts + run history, reading `PlaygroundTestRun` records
- `settings-screen.tsx` — Anthropic/OpenAI BYOK key management (writes the `localStorage` keys Pipeline Lab v3 and the Ad Copy engine both read)

Hidden but not deleted (reachable via `?view=<id>`, per `CLAUDE.md`'s explicit "hide navigation, never delete code" convention): `projects-screen.tsx`, `architecture-screen.tsx`, `pipeline-screen.tsx` (React Flow canvas — has the known edges-not-rendering bug, §9), `execution-inspector-screen.tsx`, `prompt-inspector-screen.tsx`, `analytics-screen.tsx`.

## 7. Backend / API / Database

- **No database.** All persistence is `src/shared/repositories/local-storage-repository.ts` (`LocalStorageProjectRepository`) — one JSON blob per browser, seeded from `src/shared/repositories/demo-data.ts` (`demoSnapshot`) on first load only, validated against `RepositorySnapshotSchema` (Zod). `npm run build`'s static prerender also validates `demoSnapshot` against this schema as a safety net.
- **The only server route:** `src/app/api/openai-proxy/route.ts` — a stateless relay so the browser can call OpenAI (which doesn't send CORS headers for direct browser calls). It does not store or log the key it relays.
- **Real LLM calls are BYOK, client-side:** `src/shared/llm/browser-direct-provider.ts` (React app) and `public/pipeline-lab-v3.html`'s own inline copy of the same pattern (kept in sync by hand, not shared code — see `CLAUDE.md` addenda). Both call Anthropic directly and OpenAI via the proxy above, both fall back to the other vendor if the configured one's key is present-but-invalid (a real fix made 2026-07-06, see the 4th/6th Addenda).
- **A separate, currently-unused-by-any-screen server-side LLM path** exists: `src/shared/llm/provider-registry.ts`, reading `OPENAI_API_KEY`/`OPENAI_BASE_URL` from real env vars, for the "Production Pipeline Runtime" (`src/shared/runtime/`). See `.env.example`.

## 8. Environment variables

See `.env.example` (created as part of this handoff — none existed before). Summary: **the app runs and deploys with zero required env vars.** The two optional ones (`OPENAI_API_KEY`, `OPENAI_BASE_URL`) only matter if a future screen is wired to the server-side Production Pipeline Runtime provider instead of the Mock LLM Provider it uses today.

`.env.local` (gitignored, not committed) currently only has a Vercel-CLI-managed `VERCEL_OIDC_TOKEN` — not an app secret.

## 9. Prompts and pipelines — where they live

- **AI Call Analysis's pipeline** (10 stages: STT/validate/extract-facts/store/needs/outcome/summary/check/gate/CRM): `public/pipeline-lab-v3.html`'s `defaultPipeline()` function. Prompts are plain JS template-literal strings inside that function. This is the **most recently and carefully edited pipeline in the repo** (see the July 6 "V8.1" Addendum) — read it before touching call-summary logic.
- **Ad Copy Generation's pipeline** (10 editable stages, same UI convention as Pipeline Lab v3 but its own engine): `src/features/mvp/lib/ad-copy-test-bench.ts`. Real Zod schemas for its I/O contract live in `src/shared/model/ad-copy-*.ts`.
- **Domain-model pipelines** (the `Pipeline`/`Node`/`Edge` entities used by the hidden `pipeline-screen.tsx` React Flow canvas and the Production Pipeline Runtime): seeded in `src/shared/repositories/demo-data.ts`, executed by `src/shared/runtime/pipeline-executor.ts` + `real-stage.ts`/`mock-stage.ts`.
- **Both real-run engines persist their editable stage config to `localStorage`, versioned** (`PIPELINE_VERSION` in `pipeline-lab-v3.html`, `CONFIG_VERSION` in `ad-copy-test-bench-panel.tsx`) so a browser session with an old saved config doesn't silently keep stale prompts when the shipped defaults change — **follow this pattern if you add a new default prompt/rule to either engine.**

## 10. Local dev / build / deploy

```bash
npm install         # install deps
npm run dev          # local dev server, http://localhost:3000
npm run build        # production build (also re-validates demoSnapshot against its Zod schema)
npm start            # run the production build locally
npm run lint         # eslint .
npm test             # vitest run (single pass)
npm run test:watch   # vitest watch mode
```

**Deploy:** push to `main` on GitHub — Vercel auto-deploys (project already linked, see `.vercel/project.json`). No manual `vercel deploy` step needed in normal workflow. CI (`.github/workflows/ci.yml`) runs `npm run lint` + `npm test` on push/PR to `main`.

## 11. What's implemented

- Product → Playground → Dashboard navigation, 5 seeded demo products
- Full PM-template Product card with 8 tabs + voice/text AI Assist (real BYOK LLM call)
- Two independent **real** (non-mock) test-bench engines: Pipeline Lab v3 (call analysis) and Ad Copy Generation's own panel, both fully editable (stage name/type/model/prompt/order), both with confidence-gated retry loops, both persisting config to `localStorage` with version migration
- Settings screen centralizing Anthropic/OpenAI BYOK keys
- Dashboard with real aggregate stats/charts + full run history (reads `PlaygroundTestRun`)
- Domain layer (13 entities) fully Zod-validated, most with unit test coverage
- CI (lint + test on every push/PR to `main`)

## 12. What's in progress / not implemented

- Everything under `knowledge-import/`/`orchestrator/` (Prompt Studio editor, real multi-agent Orchestrator, Test Analytics, Knowledge Base, Version Control with real history) — spec only, per §3.
- The hidden legacy screens (`projects-screen.tsx`, `architecture-screen.tsx`, `pipeline-screen.tsx`, `execution-inspector-screen.tsx`, `prompt-inspector-screen.tsx`, `analytics-screen.tsx`) still exist and work but are not in the visible nav — reachable via `?view=`.
- No backend/database/auth/multi-user/billing (see `docs/mvp/KNOWN_LIMITATIONS.md`, still accurate on this point).

## 13. What NOT to break

- **`demoSnapshot` must stay valid against `RepositorySnapshotSchema`** — `npm run build` fails hard otherwise (this is intentional, treat a build failure here as a real data bug, not a build config issue).
- **Never revert the localStorage-config-versioning pattern** in `pipeline-lab-v3.html`/`ad-copy-test-bench-panel.tsx` — removing it silently resurrects old, already-fixed prompt bugs for anyone with a previously-saved config.
- **Never remove the Anthropic/OpenAI BYOK vendor-fallback logic** in `browser-direct-provider.ts` / `pipeline-lab-v3.html`'s `callModel()` — a configured-but-invalid key on one vendor should never hard-fail a stage when the other vendor's key works (real regression fixed 2026-07-06, see Addenda 4/6).
- **`.env*` must never be committed** (already correctly gitignored — verify this stays true).
- Don't silently work around a missing/broken instruction or reference — the established convention in this repo (see the July 6 Addenda) is to flag the gap explicitly, not invent a silent substitute.
- Follow the "hide navigation, never delete code" convention for anything currently reachable only via `?view=` — don't delete a hidden screen because it looks unused.

## 14. Risks / known issues

- **React Flow canvas (`pipeline-screen.tsx`) renders 0 edges** — a real, only-partially-root-caused bug, extensively documented in `CLAUDE.md` §63 (Technical Debt item 12). Two sub-causes fixed (canvas sizing, node visibility), the actual edge-rendering symptom is still open and needs React DevTools to progress further. This screen is hidden from nav but still reachable.
- **`pdf-notes.txt` contains un-scrubbed, near-PII business material** and references two paths that don't exist in the repo (`reference/miro-as-is/`, `research/…`) — don't assume those paths exist; re-source from whoever owns the original Miro board if needed.
- **No real automated tests for `public/pipeline-lab-v3.html`** — it's a standalone HTML/JS asset outside the TypeScript/Vitest build, verified only by manual in-browser testing during past sessions (documented per-change in the CLAUDE.md Addenda). Any change to it should be manually smoke-tested, not assumed covered by `npm test`.
- **Two parallel LLM-calling code paths** (React's `browser-direct-provider.ts` vs. `pipeline-lab-v3.html`'s inline copy) must be kept in sync by hand when fixing a shared class of bug (e.g. the vendor-fallback fix was applied to both separately) — there's no shared module between them by design (one is a Next.js/TS module, the other a standalone HTML file).
- **`Node.metadata` is an untyped `Record<string,string>`** and mostly unused (`CLAUDE.md` §63 item 6) — don't build new features assuming it has structure.

## 15. Suggested next tasks for Codex

1. Read the reconstructed-vs-real-transcript gap noted in the July 6 "V8.1" Addendum — if a real reference call transcript becomes available, re-verify the call-summary prompt against it (current verification used a reconstructed transcript, explicitly flagged as such).
2. Investigate the React Flow edges-not-rendering bug (§14) — needs real React DevTools access to progress past the current hypothesis (`node.internals.handleBounds`).
3. Consider whether `docs/architecture/AS_IMPLEMENTED.md` and `docs/mvp/*.md` should be refreshed to reflect the Product→Playground→Dashboard state (currently stale, see §3) — low urgency since `CLAUDE.md`'s Addenda are authoritative, but worth doing if those files get read often.
4. Extend the golden-dataset/quality-metrics idea discussed for the call-summary pipeline (hallucination rate, evidence/citation match ratio, AUTO_SAVE vs. REVIEW/FALLBACK rate, per-field extraction completeness) into a tracked Dashboard time series — currently these signals exist per-run but aren't aggregated over time.
5. Any task should start by grepping `CLAUDE.md` for `^## Addendum` to load the actual current state before making architectural assumptions from the numbered chapters alone.

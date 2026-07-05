# DEC-004. Collapse visible navigation to Product / Playground / Dashboard

## Status
Accepted

## Date
Proposed and ratified 2026-07-05, in the same working session as the implementation, per an explicit product-owner request to "work maximally autonomously" and make architectural calls not in conflict with the request rather than pausing for sign-off on each one.

## Context
The MVP shell (`src/features/mvp/mvp-shell.tsx`) exposed 10 nav sections (Projects, Product, Architecture, Pipeline, Playground, Inspector, Prompts, Analytics, Pipeline Lab v3, Settings). The product owner asked for the app to present as exactly three sections — **Product, Playground, Dashboard** — following the flow `Product -> Playground -> Dashboard`, with everything else hidden (not deleted) since it "may be needed later."

Two structural questions this ADR resolves:
1. Whether "hidden" means removed from the sidebar only, or something deeper (disabled routes, deleted code).
2. Whether `Product` absorbs `Projects` (today's actual product-creation entry point, since `useProjectStore().createProject()` already auto-creates a linked `Product`), or the two stay separate with `Projects` simply hidden and orphaned.

## Decision Type
architecture / navigation

## Frameworks Used
None from `skills/senior-product-manager/FRAMEWORKS.md` or `skills/senior-ai-solution-architect/AI_PATTERNS.md` apply directly — this is a UI information-architecture decision, not a product-discovery or AI-pattern decision.

## Options Considered
| Option | Pros | Cons | Risks |
|---|---|---|---|
| **A. Hide = remove from the rendered `<nav>` array only; keep every `MvpView`, `isMvpView` case, and `Workspace` switch branch intact; merge `Projects`' list/create UX into the `Product` screen as its "list mode"** | Zero deleted code (literal compliance with "не удалять код, только скрыть навигацию"); every hidden screen stays reachable by typing `?view=...`; `Product` becomes a genuine single entry point instead of two overlapping ones | `Product` screen file grows large (list + detail in one file) | Low — mirrors the existing `ProjectsScreen` list/dialog code almost verbatim, low risk of behavioral drift |
| **B. Keep `Projects` and `Product` as two separate views, just hide both `Projects` and the old decorative `Product` from nav, and give `Product` its own unrelated list** | Smaller diff per file | Two parallel, divergent "list of products" UIs (Projects' full CRUD list vs. a second one) is exactly the kind of duplicated logic CLAUDE.md CS-2 forbids; confusing for future maintenance | Medium — future edits would need to keep two lists in sync |
| **C. Delete the hidden screens' code entirely** | Smallest bundle | Directly contradicts the explicit instruction "не удалять существующий код, если его можно использовать повторно" and CLAUDE.md §63 debt item 3/CR-3 (hidden features are refactor targets, not debt) | High — violates an explicit constraint |

## Rationale
Option A was chosen: it is the only option that satisfies both "don't delete anything" and "don't duplicate the list-of-products UI." `ProjectsScreen`'s list/create/rename/duplicate/delete logic was reused near-verbatim inside `ProductScreen`'s list mode (relabeled "Продукты"/"Создать продукт"), and the original `projects-screen.tsx` file is untouched and still reachable at `?view=projects` for any future need to inspect it side-by-side.

## Evidence
| Evidence ID | Grade | Summary | Linked Claim |
|---|---|---|---|
| EV-009 | A | Read `src/shared/stores/project-store.ts`: `createProject` already auto-creates a linked `Product` and selects the new project | Product and Project are already 1:1 in this codebase, not two independent concepts — merging their UI is not inventing a new relationship |
| EV-010 | A | Read `public/pipeline-lab-v3.html`: fully generic stage/model/prompt configuration, no hardcoded dependency on a domain `Pipeline`/`Architecture` entity | Playground does not need Architecture/Pipeline records to exist for "any product is immediately testable" to hold |

## Assumptions
| Assumption | Risk Level | Validation Method | Status |
|---|---|---|---|
| No other part of the app links directly to `?view=projects` or `?view=analytics` etc. expecting them to be the primary UI | Low | `grep` for `view=projects` / `view=pipeline-lab-v3` internal links (none found outside the removed in-Playground alert) | Confirmed at implementation time |

## Decision
Hide navigation by filtering the rendered `<nav>` list only (`visibleNavItems` in `mvp-shell.tsx`), keep `MvpView`, `isMvpView`, `viewTitles`, and the `Workspace` switch statement exhaustive (including the hidden views plus the new `dashboard` view). Merge `Projects`' list/create/rename/duplicate/delete UX into `ProductScreen` as its list mode; `Projects` itself stays as dead-but-present code, reachable at `?view=projects`, not deleted. Default view (no `?view=` param) changes from `projects` to `product`.

## Trade-offs
`product-screen.tsx` is now a large single file (list mode + 8-section detail mode + AI Assist). Accepted per CLAUDE.md §2 principle 6 (simplicity first / no premature abstraction) — splitting it into sub-components without a second consumer would be speculative.

## Consequences
- `src/features/mvp/mvp-shell.tsx`: `navItems` (full list, used for `isMvpView`/`viewTitles`) vs. `visibleNavItems` (Product/Playground/Dashboard only, used for the sidebar and prev/next arrows).
- `src/features/mvp/screens/product-screen.tsx` absorbed `projects-screen.tsx`'s list/dialog logic; `projects-screen.tsx` itself is unchanged and still works standalone at `?view=projects`.
- `src/features/mvp/screens/playground-screen.tsx` was rewritten to a product-picker + Pipeline Lab v3 iframe flow, replacing its previous mock-executor demo UI (the underlying Production Pipeline Runtime code, `src/shared/runtime/*`, is untouched and still used by the hidden Analytics screen).
- New `src/features/mvp/screens/dashboard-screen.tsx` added as a new visible section.

## What Would Change This Decision
If a future requirement needs Architecture/Pipeline/Analytics to be user-facing again, re-adding them to `visibleNavItems` is a one-line change per item — no code needs to be un-deleted, since none was deleted.

## Review
Ratified 2026-07-05 as part of the same implementation session.

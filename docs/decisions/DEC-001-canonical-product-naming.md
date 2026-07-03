# DEC-001. Canonical product naming

## Status
Accepted

## Date
2026-07-03

## Context
This repository is referred to by three different names across its own documents:
- "AI Product OS" — used throughout `knowledge-import/01_Vision_and_Product_Philosophy.md` through `20_Glossary_and_Enterprise_Standards.md` and `knowledge-import/README.md`.
- "AI Communication Platform" — used in `knowledge-import/CLAUDE.md`.
- "AI Product Studio" / "AI Communication Studio" — the literal `package.json` name (`ai-product-studio`), the rendered page title (`src/app/layout.tsx`), and the folder name on disk.

No single document reconciles these, and new work (documentation, UI copy, commit messages) needs one unambiguous name to use by default.

## Decision Type
architecture (documentation/naming convention)

## Frameworks Used
None — this is a repository-internal naming convention, not a product/AI framework decision.

## Options Considered
| Option | Pros | Cons | Risks |
|---|---|---|---|
| Adopt "AI Product OS" everywhere | Matches the largest body of existing documentation (20 files) | Does not match what is actually implemented (`package.json`, UI title); overstates current scope | Confuses contributors about what exists vs. what's aspirational |
| Adopt "AI Communication Platform" everywhere | Matches the umbrella stakeholder term | Appears in exactly one file (`knowledge-import/CLAUDE.md`); least-grounded option | Weakest evidence base of the three |
| **Adopt "AI Product Studio" for the app, keep "AI Product OS" scoped to the long-term vision, keep "AI Communication Platform/Studio" as loose stakeholder language (chosen)** | Matches the literal running code (`package.json`, page title); keeps the long-term vision's name intact where it's actually used | Requires readers to hold three names in mind, scoped by context | Low — scoping is explicit and documented |

## Evidence
| Evidence ID | Grade | Summary | Linked Claim |
|---|---|---|---|
| EV-001 | A (production data — the actual running code) | `package.json` name field is `ai-product-studio`; `src/app/layout.tsx` metadata title is "AI Product Studio" | "AI Product Studio" is what the implemented application actually calls itself |
| EV-002 | A | `knowledge-import/` uses "AI Product OS" in all 20 numbered files + README | "AI Product OS" is the name of the long-term vision documents specifically |
| EV-003 | A | `knowledge-import/CLAUDE.md` uses "AI Communication Platform" exactly once, in its own title | This name has the weakest textual support of the three |

## Assumptions
| Assumption | Risk Level | Validation Method | Status |
|---|---|---|---|
| The product owner has not already committed to one name externally (marketing, stakeholders, contracts) | Medium | Confirm with product owner | Untested — if false, this ADR should be superseded |

## Decision
Use **"AI Product Studio"** as the name for the application implemented in `src/` — in code, UI strings, and new documentation. Use **"AI Product OS"** only when specifically discussing the `knowledge-import/` long-term platform vision. Use **"AI Communication Platform/Studio"** only as loose, umbrella stakeholder language — never in code or schemas.

## Rationale
Ground the default name in what is verifiably true today (the running code), rather than in aspirational or least-used documentation. This avoids overstating the current system's scope while preserving the distinct, still-valid vocabulary of the long-term vision documents.

## Trade-offs
Contributors must learn to scope which name applies where, rather than using one name unconditionally. This is a one-time cost, mitigated by CLAUDE.md §1 and §31.1 stating the rule plainly.

## Consequences
- New UI copy, commit messages, and this repository's own documentation should default to "AI Product Studio."
- `knowledge-import/*` files are **not** edited to rename "AI Product OS" — they remain the historical record of that specific vision (CLAUDE.md §71 rule 2).

## What Would Change This Decision
An explicit, externally-communicated product name decision by the product owner that differs from all three options above.

## Review
Ratifies CLAUDE.md §1 [CANONICAL DECISION]. No further review scheduled unless the assumption above is invalidated.

# DEC-002. Standardize confidence on a 0–1 float scale

## Status
Accepted

## Date
2026-07-03

## Context
Two incompatible confidence scales exist in the repository's own material:
- `knowledge-import/03_Product_Studio.md` specifies a 0–100 integer scale (95–100 High confidence, 80–94 Minor review recommended, 60–79 Human review required, <60 Insufficient information).
- The actually-implemented demo pipeline (`src/shared/repositories/demo-data.ts`) routes on a 0–1 float threshold: the validation node's edges use `confidence >= 0.72` / `confidence < 0.72` to decide between auto-store and human review.

Any future confidence-producing code (a real evaluator, a real model-routing step) needs one scale to target, not two.

## Decision Type
architecture

## Frameworks Used
`ai_pattern_id: guardrails`, `ai_pattern_id: human-in-the-loop` (`skills/senior-ai-solution-architect/AI_PATTERNS.md`) — both patterns depend on a confidence threshold being unambiguous.

## Options Considered
| Option | Pros | Cons | Risks |
|---|---|---|---|
| Standardize on 0–100 integer (matches `03_Product_Studio.md`) | Matches the most detailed prose spec | Does not match implemented code (`demo-data.ts`, `Node.metadata.threshold = "0.72"`) | Would require touching working demo data for a documentation-only reason |
| **Standardize on 0–1 float (matches implemented code), convert the 0-100 spec by dividing by 100 when cited (chosen)** | Zero code changes required; matches what already runs | The 0–100 scale's four-tier verbal labels (High/Minor review/Human review/Insufficient) need an explicit float-range restatement | Low — restatement is mechanical (divide by 100) |
| Maintain both scales, scoped by context | No immediate work | Exactly the ambiguity this ADR exists to remove | High — guarantees future bugs comparing values across scales without conversion |

## Evidence
| Evidence ID | Grade | Summary | Linked Claim |
|---|---|---|---|
| EV-004 | A | `demo-data.ts` edge conditions literally read `confidence >= 0.72` | The implemented system already uses 0–1 |
| EV-005 | A | `knowledge-import/03_Product_Studio.md` table uses 0–100 with four named bands | The alternate scale exists only in documentation, not in code |

## Assumptions
| Assumption | Risk Level | Validation Method | Status |
|---|---|---|---|
| No other implemented code depends on a 0–100 confidence value | Low | Repository-wide search for confidence-scale usage | Validated during CLAUDE.md discovery — only the Simulation Engine's hardcoded `0.86` and the demo edge conditions reference confidence numerically, both already 0–1 |

## Decision
All future confidence values in this codebase use a **0–1 float scale**. The four-tier verbal bands in `knowledge-import/03_Product_Studio.md` are reinterpreted as: ≥0.95 High confidence, 0.80–0.94 Minor review recommended, 0.60–0.79 Human review required, <0.60 Insufficient information — i.e., divide the original 0–100 boundaries by 100.

## Rationale
Prefer the scale actually implemented in running code over the scale that exists only in a documentation file, per CLAUDE.md §31.9 general resolution rule ("what the actual running code does" outranks "the more detailed prose document").

## Trade-offs
Anyone reading `03_Product_Studio.md` in isolation will see 0–100 and must remember to convert; this is mitigated by CLAUDE.md §25 stating the conversion rule explicitly.

## Consequences
- Any new evaluator, scorer, or router that produces a confidence value must emit it on the 0–1 scale.
- `knowledge-import/03_Product_Studio.md` is not edited (CLAUDE.md §71 rule 2) — its 0–100 table remains valid prose, reinterpreted per this ADR when cited.

## What Would Change This Decision
If a future real backend integration standardizes on a provider API that natively returns 0–100 confidence and converting at every call site becomes a demonstrated performance/complexity problem.

## Review
Ratifies CLAUDE.md §25 [CANONICAL DECISION]. No further review scheduled.

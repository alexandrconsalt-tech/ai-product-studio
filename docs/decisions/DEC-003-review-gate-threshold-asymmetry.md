# DEC-003. Product Review vs. Architecture Review gate threshold asymmetry

## Status
Proposed — requires product owner ratification before being treated as binding.

## Date
2026-07-03

## Context
`orchestrator/QUALITY_GATES.md`, `orchestrator/DECISION_ENGINE.md` (D-001, D-003), `orchestrator/MODULES.md`, and `orchestrator/WORKFLOW.md` all require **Product Review score >= 85** to pass `gate_product_complete`, but **Architecture Review score >= 90** to pass `gate_architecture_complete`.

Separately, `skills/senior-product-manager/REVIEW.md` and `skills/senior-ai-solution-architect/REVIEW.md` both use the identical scoring bands: 90–100 approved, 75–89 approved with minor recommendations, 60–74 revise, 0–59 rejected.

The consequence: the orchestrator lets a project advance out of Product Design while the PM's own review only rates it "approved with minor recommendations" (any score 85–89), but requires Architecture to reach the PM/architect shared "fully approved" band (90+) before advancing. Structurally parallel gates are held to different rigor, and neither `orchestrator/` nor either `skills/` directory explains why.

This was first flagged during full-repository discovery (CLAUDE.md §23.4, §31.5) and is intentionally **not resolved unilaterally** — CLAUDE.md §71 rule 1 states this document may propose a resolution but must not silently edit the underlying `orchestrator/`/`skills/` files, and §69 (Working Agreement) reserves ADR ratification to the product owner.

## Decision Type
architecture / release gate policy

## Frameworks Used
`skills/senior-product-manager/REVIEW.md` (Review Dimensions, weights sum to 100), `skills/senior-ai-solution-architect/REVIEW.md` (same band structure, different weighted criteria), `orchestrator/QUALITY_GATES.md`, `orchestrator/DECISION_ENGINE.md#D-001`, `orchestrator/DECISION_ENGINE.md#D-003`.

## Options Considered
| Option | Pros | Cons | Risks |
|---|---|---|---|
| **A. Raise `gate_product_complete` to >= 90**, matching Architecture's rigor | Symmetric rigor for structurally parallel gates; simplest mental model | May slow down early-stage product work, where "approved with minor recommendations" is arguably an acceptable state to start architecture exploration with (architecture work can surface issues that feed back into the product review anyway, per D-003's own return path) | Low — this is a stricter gate, so it fails safe |
| **B. Lower `gate_architecture_complete` to >= 85**, matching Product's leniency | Speeds up the pipeline; treats "minor recommendations" as acceptable everywhere | Architecture mistakes are typically more expensive to unwind once a Pipeline is generated from them (§13); this repository's own architect skill weighs AI Quality/Reliability/Security higher than the PM skill weighs Problem Clarity, suggesting architecture correctness may deserve *more*, not equal, rigor | Medium — could let under-specified architectures reach Pipeline Generation |
| **C. Keep the asymmetry, but document an explicit rationale** (e.g., "Product Review at 85 is intentionally lenient because architecture review is a second checkpoint that will catch downstream product gaps; tightening both would slow discovery without proportional benefit") | No workflow change; formalizes the status quo | Requires someone to actually construct and stand behind that rationale — right now no such rationale exists anywhere in the repository, so this option amounts to *retroactively justifying* an accident unless the product owner genuinely holds this view | Low technically, but epistemically risky (retrofitting a reason after the fact per CLAUDE.md §2 principle 4, evidence over assumption) |

## Recommendation
This document's author recommends **Option A** (raise Product to >= 90) on the grounds that: (1) it's the simplest fix — one number change, no architecture skill or orchestrator restructuring; (2) it removes the only place in the whole orchestrator spec where a "recommendations pending" review state is allowed to gate a forward transition; (3) `skills/senior-product-manager/REVIEW.md`'s own blocking-issue list already includes things like "PRD создан без discovery rationale" and "AI feature без AI justification" — treating 85–89 as sufficient to proceed contradicts the spirit of a skill document that clearly wants issues resolved, not merely noted, before moving on. However, this is explicitly a product-risk-tolerance call (how much do we value discovery speed vs. gate rigor), which is why it is not ratified unilaterally.

## Evidence
| Evidence ID | Grade | Summary | Linked Claim |
|---|---|---|---|
| EV-006 | A | `orchestrator/QUALITY_GATES.md` and `DECISION_ENGINE.md` D-001/D-003 state the two thresholds verbatim | The asymmetry is real, not a misreading |
| EV-007 | A | Both `REVIEW.md` files share the identical 90/75/60 band structure | The asymmetry is not explained by different scoring scales between the two skills |
| EV-008 | C | Author's engineering judgment on architecture-error cost asymmetry (no production incident data exists in this repository to ground this in Grade A/B evidence) | Supports Option A/B reasoning but is not itself sufficient to decide alone, per CLAUDE.md §24 Evidence Grading — Grade C is supporting only |

## Assumptions
| Assumption | Risk Level | Validation Method | Status |
|---|---|---|---|
| The orchestrator's gate logic will actually be implemented in code at some point, making this threshold operationally meaningful rather than purely documentary | Medium | Track against Engineering Roadmap Epic progress toward orchestrator implementation | Untested — until then, this ADR is a documentation-correctness fix with no runtime effect |

## Decision
**Not yet made.** Recorded here as Proposed with a recommendation (Option A) for the product owner to accept, modify, or reject.

## Trade-offs
See Options table above.

## Consequences
Until ratified, `orchestrator/QUALITY_GATES.md` and the two `REVIEW.md` files are **not edited** — the asymmetry remains live in the specification, and CLAUDE.md §23.4/§66 continue to flag it explicitly rather than presenting either threshold as uncontested.

## What Would Change This Decision
Product owner input on acceptable risk tolerance for early-stage (Product) vs. mid-stage (Architecture) gate rigor; alternatively, real usage data once the orchestrator is implemented showing how often 85–89-scored products cause downstream architecture rework.

## Review
**Action required:** product owner to review this proposal and record a decision (Accept Option A / Accept Option B / Accept Option C with stated rationale / reject all three with an alternative). Until then, CLAUDE.md continues to treat this as an open, flagged inconsistency rather than resolved.

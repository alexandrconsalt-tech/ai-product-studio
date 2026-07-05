# PlaygroundTestRun

Added 2026-07-05 as part of the AI Product Studio v2 refactor (CLAUDE.md addendum
"Product -> Playground -> Dashboard").

Captures one aggregate result of a Pipeline Lab v3 test run (`public/pipeline-lab-v3.html`,
embedded in Playground via `PipelineLabV3Screen`) -- what Dashboard reads to compute
accuracy/cost/speed/confidence trends across many runs of the same product.

Storage:

- Not a child of `Project`/`Product` via an array field (unlike `Review`/`Run`) --
  referenced only by `projectId`, one-directional, since Playground/Dashboard both
  key off the same `selectedProjectId` used throughout `src/features/mvp`.
- Persisted client-side via `usePlaygroundTestRunStore` (`src/shared/stores/playground-test-run-store.ts`,
  Zustand `persist` middleware, capped at 200 most-recent per `projectId`) -- not part of
  `RepositorySnapshot`/`LocalStorageProjectRepository`, because it is captured from a
  `postMessage` bridge to an iframe (`public/pipeline-lab-v3.html`), not from a store
  mutation inside this app's own React tree.

Lifecycle:

No lifecycle status (same as `Run`) -- append-only, one record per completed test run,
never edited after creation. `status` is `succeeded | failed` only, decided by whether
any stage in that run reported `status: "bad"`.

Validation rules:

- `confidence` (0-1 scale, DEC-002) and `qualityScore` (0-100 scale) are deliberately on
  different scales -- they come from two different Pipeline Lab v3 stages (Quality Gate's
  routing confidence vs. the cross-vendor Check Agent's summary-accuracy score) and must
  not be conflated.
- Both `confidence` and `qualityScore` are optional: a custom stage configuration (user
  removed the Quality Gate or Check Agent stage in Pipeline Lab v3) legitimately has neither.

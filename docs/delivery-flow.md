# Delivery Flow

Production URL: https://ai-product-studio-alpha.vercel.app/

## Branch roles

- `feature/*` is the TEST environment for AI work and automated checks.
- `dev` is the DEV environment for manual owner verification.
- `main` is Production.

## Rules

- AI works only in `feature/*` branches.
- AI opens PRs only from `feature/*` to `dev`.
- A PR to `dev` must pass:
  - scope guard
  - module guard
  - logic guard
  - lint
  - typecheck
  - build
  - smoke/regression
- The PR body must include:
  - what changed
  - changed files
  - modules not touched
  - checks passed
  - potential risk
  - rollback plan
- Merge to `dev` creates the DEV deployment.
- The owner manually verifies DEV.
- Production release is allowed only through `dev` -> `main`.
- Production release requires the owner approval checkbox in the PR body.
- AI must not directly deploy Production.
- Production deploys only from `main`.

## Repository enforcement

- `.github/workflows/ci.yml` runs the full quality gate on `feature/*`, `dev`, `main`, and PRs to `dev`/`main`.
- `.github/workflows/production-gate.yml` blocks PRs to `main` unless they come from `dev` and contain the checked owner approval marker.
- `.github/PULL_REQUEST_TEMPLATE.md` provides the required report and checklist.
- `scripts/delivery-guard.mjs` enforces branch scope, module boundaries, and blocks production deploy bypass commands.

## Required GitHub settings

Protect `main`:

- Require pull request before merging.
- Require approvals from the owner.
- Require status checks:
  - `quality-gates`
  - `require-owner-approval`
- Block direct pushes.
- Do not allow force pushes.

Protect `dev`:

- Require pull request before merging.
- Require status check:
  - `quality-gates`
- Allow merges only from `feature/*` by policy and CI.

## Required Vercel settings

- Production Branch: `main`.
- Production deployments only from `main`.
- Preview deployments enabled for `feature/*` and `dev`.
- Assign a stable branch preview domain for `dev` if the owner needs a fixed DEV URL.
- Enable deployment protection/manual approval for Production if available in the Vercel project settings.
- Do not store a Vercel production token for AI agents.

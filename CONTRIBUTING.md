# Contributing

## Active plan

When `IMPLEMENTATION_PLAN.md` exists, reconcile it with current `main` before choosing work. Its first open task is the default next repository change unless the owner explicitly overrides it. If that first task is blocked by an unsatisfied dependency or required external/provider action, stop on it and report the blocker; do not silently skip to a later task. The plan is current/future-only: remove task blocks already completed by earlier merges during reconciliation, retire the task being delivered in that task's own controlled PR, update remaining tasks when future scope changes, and never maintain a completed-task or legacy implementation log. Delete `IMPLEMENTATION_PLAN.md` in the controlled change that delivers its final task. After a planned change merges, finish the same turn with a complete copy-paste kickoff prompt for the next open task, or a fresh-state re-audit prompt when the queue is exhausted.

## Change flow

```text
permanent YR ID → branch → implementation → validation → one controlled commit
→ pull request → exact-head CI → squash exact validated head → one controlled
commit retained on main → verify main → branch cleanup
```

Confirm the next permanent ID with `npm run check:history`, then create a branch
named `yr-###-imperative-summary`, for example
`yr-040-adopt-repository-baseline`. Commit and pull-request titles use the
matching form, such as `[YR-040] [BUILD] Adopt repository baseline`.

New controlled titles use one primary type from the WG-ARCH-001 §16 vocabulary:
`INIT`, `FEAT`, `FIX`, `SEC`, `API`, `A11Y`, `I18N`, `AI`, `DB`,
`OPS`, `TEST`, `DOCS`, `REFACTOR`, `PERF`, `BUILD`, `REVERT`, or
`CHORE`. `CI` is preserved only as immutable historical metadata; use
`OPS` or `BUILD` for new automation work.

Every controlled change body records `Change`, `Reason`, `Impact`, `Risk`,
`Controls`, `Validation`, `Evidence`, `Source`, and `Release`. `Source` names
current authority/input for the change rather than a reconstruction mapping.
Include `Rollback` for persistence, migration, archive, activation, schema,
provider-setting, release-behavior, or other high-risk changes. A corrective
change identifies the earlier change in its notes or a `Corrects:` trailer.

## Command contract

Install dependencies with `npm ci` before the repository commands below. Treat
the scripts in `package.json` and the workflows as executable authority when
documentation and behavior ever disagree.

- `npm run dev` starts only the local Vite viewer development server on
  `127.0.0.1:5173`; it is not a hosted-production or deployment lifecycle.
- `npm run typecheck` checks the Node, viewer, and browser-test programs with
  `--noEmit` for every TypeScript invocation, so it does not write production or
  compiler output to `dist`.
- `npm test` and `npm run test` are equivalent. They run a full
  `npm run build` first, then Node tests from compiled `dist/test` output and
  the Vitest browser-module/DOM suite.
- `npm run build` compiles the Node/test program and builds the production
  viewer bundle under `dist`; it does not itself run tests.
- `npm run check` is the credential-free local acceptance gate. It runs
  non-emitting `typecheck`, then `test` once; `test` owns the single
  production build before the Node/browser suites and includes pure local
  repository-settings comparison cases plus disposable-Git release-identity
  cases. It then runs controlled-history, public-safety, and repository-baseline
  checks. The settings and release-identity cases use only committed local
  fixtures/configuration and do not call GitHub.
- `npm run audit:high` is the explicit registry/network-aware high-severity dependency advisory gate. It is intentionally separate from credential-free `npm run check`. A completed clean audit exits green; a high/critical advisory fails; registry or advisory-service unavailability is reported as unavailable and remains non-green rather than being mistaken for a clean result.
- `npm run verify:github-settings` is a separate provider/network-aware
  comparison against `config/github-repository-settings.json`. Use authorized
  `GH_ADMIN_TOKEN` or `GH_TOKEN` with Repository Administration read access. It
  does not change settings.
- `npm run apply:github-settings` is the explicit settings mutation path. It
  requires Repository Administration write access through the same token contract,
  changes only the committed authority, and independently re-reads live settings.
- Release publication is not part of `check` or ordinary controlled delivery.
  `test:release` exercises the shared release-identity validator entirely in
  disposable local Git repositories. Pushing an annotated semantic tag that
  exactly matches `package.json` triggers `.github/workflows/release.yml`; the
  workflow fetches that exact tag, invokes the same validator, and only then
  creates the GitHub Release. Follow `docs/RELEASE-MANAGEMENT.md`.
- Hosted deployment is N/A. YarReader has no production environment, Worker, or
  hosted application lifecycle; the product remains local/offline and portable
  through `file://`.

The acceptance graph performs one production build: `test` owns it before the
Node and browser suites, `check` invokes `test` once without rebuilding, and
CI runs `check` without a separate production-build step.

Pipeline and filesystem tests remain on `node:test`; Vitest 5 owns tests that need
TypeScript browser modules or a DOM. Keep that split when adding or moving tests.

Before opening or updating a pull request targeting `main`, run:

```sh
npm ci
npm run audit:high
npm run check
git fetch origin main
git diff --check origin/main...HEAD
git diff --check
```

`npm run check` is the credential-free repository gate after dependencies are
installed. The triple-dot Git check validates the committed branch change set
against the fetched target branch/merge base, matching pull-request semantics.
The final bare `git diff --check` remains useful for uncommitted working-tree
changes; it is not a substitute for the committed-range check.

Browser/presentation changes also preserve the automated Vitest DOM accessibility
acceptance boundary. The small set of checks that require actual browser or
assistive-technology rendering is documented in `docs/ACCESSIBILITY.md`.
YarReader's posture is WCAG 2.2 aligned and explicitly uncertified.

Do not commit runtime media, catalogs, generated work or exports, downloaded
covers, credentials, private URLs, or a real series-curation inventory.
Git/GitHub retain superseded repository and release history; do not add a
parallel current-tree history ledger. Published release tags are immutable.
Reverts and corrections move forward under new YR IDs.

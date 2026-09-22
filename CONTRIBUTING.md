# Contributing

## Active plan

When `IMPLEMENTATION_PLAN.md` exists, reconcile it with current `main` before choosing work. Its first open task is the default next repository change unless the owner explicitly overrides it. If that first task is blocked by an unsatisfied dependency or required external/provider action, stop on it and report the blocker; do not silently skip to a later task. The plan is current/future-only: remove task blocks already completed by earlier merges during reconciliation, retire the task being delivered in that task's own controlled PR, update remaining tasks when future scope changes, and never maintain a completed-task or legacy implementation log. Delete `IMPLEMENTATION_PLAN.md` in the controlled change that delivers its final task. After a planned change merges, finish the same turn with a complete copy-paste kickoff prompt for the next open task, or a fresh-state re-audit prompt when the queue is exhausted.

## Change flow

```text
requirement → permanent YR ID → branch → implementation → pull request → CI
            → review → merge → release
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
  production build before the Node/browser suites. It then runs
  controlled-history, public-safety, and repository-baseline checks.
- `npm run verify:github-settings` is a separate provider/network-aware
  comparison against `config/github-repository-settings.json`. Use authorized
  GitHub API credentials when required to read the repository/rulesets. It does
  not change settings.
- Release publication is not part of `check` or ordinary controlled delivery.
  Pushing an annotated semantic tag that exactly matches `package.json` triggers
  `.github/workflows/release.yml`; the workflow verifies the tag and creates the
  GitHub Release. Follow `docs/RELEASE-MANAGEMENT.md`.
- Hosted deployment is N/A. YarReader has no production environment, Worker, or
  hosted application lifecycle; the product remains local/offline and portable
  through `file://`.

The acceptance graph performs one production build: `test` owns it before the
Node and browser suites, `check` invokes `test` once without rebuilding, and
CI runs `check` without a separate production-build step.

Pipeline and filesystem tests remain on `node:test`; Vitest 5 owns tests that need
TypeScript browser modules or a DOM. Keep that split when adding or moving tests.

Before opening a pull request, run:

```sh
npm ci
npm run check
git diff --check
```

Browser/presentation changes also preserve the automated Vitest DOM accessibility
acceptance boundary. The small set of checks that require actual browser or
assistive-technology rendering is documented in `docs/ACCESSIBILITY.md`.
YarReader's posture is WCAG 2.2 aligned and explicitly uncertified.

Do not commit runtime media, catalogs, generated work or exports, downloaded
covers, credentials, private URLs, or a real series-curation inventory.
Git/GitHub retain superseded repository and release history; do not add a
parallel current-tree history ledger. Published release tags are immutable.
Reverts and corrections move forward under new YR IDs.

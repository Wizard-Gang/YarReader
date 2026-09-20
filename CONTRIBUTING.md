# Contributing

## Active plan

When `IMPLEMENTATION_PLAN.md` exists, its first open task is the default next repository change unless the owner explicitly overrides it. The plan is current/future-only: remove already-merged task blocks at the start of the next controlled change, update remaining tasks when future scope changes, and do not maintain a completed-task or legacy implementation log.

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

Provider-aware GitHub repository settings are verified separately from credential-free `npm run check`:

```sh
npm run verify:github-settings
```

Before opening a pull request, run:

```sh
npm ci
npm run check
npm run build
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

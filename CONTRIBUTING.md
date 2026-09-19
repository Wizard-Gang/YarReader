# Contributing

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
`Controls`, `Validation`, `Evidence`, `Source`, and `Release`. Include
`Rollback` for persistence, migration, archive, activation, schema, or other
high-risk changes. A corrective change identifies the earlier change in its
notes or a `Corrects:` trailer.

Before opening a pull request, run:

```sh
npm ci
npm run check
git diff --check
```

Do not commit runtime media, catalogs, generated work or exports, downloaded
covers, credentials, private URLs, or a real series-curation inventory.
Published release tags are immutable. Reverts and corrections move forward
under new YR IDs.

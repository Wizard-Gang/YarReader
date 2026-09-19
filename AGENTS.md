# AGENTS.md

## Repository discipline

Read `ARCHITECTURE.md`, `CONTRIBUTING.md`, and the applicable task before
changing the repository. Start from an up-to-date `main` and keep each
controlled change limited to one permanent YR ID.

Confirm the current sequence with `npm run check:history`. Branches use
`yr-###-imperative-summary`. Commit and pull-request titles use
`[YR-###] [TYPE] Imperative summary` with one current WG-ARCH-001 §16 type.
The historical YR-035 `CI` title is immutable; new automation work uses
`OPS` or `BUILD`.

Controlled commit bodies include `Change`, `Reason`, `Impact`, `Risk`,
`Controls`, `Validation`, `Evidence`, `Source`, and `Release`. Add
`Rollback` when the change affects persistence, migration, archive,
activation, schemas, or another high-risk boundary.

## Safety

Do not commit runtime media, real catalogs, generated work or exports,
downloaded covers, credentials, private URLs, private keys, machine-specific
paths, or real series-curation inventories. Keep tests isolated from real media
and workspace state.

Do not deploy as part of ordinary controlled repository changes. Release and
deployment actions remain separate and tag-driven.

## Definition of done

Unless the task explicitly stops earlier, a controlled change is done only when:

1. the branch is based on current `main` and contains only the assigned YR ID;
2. `npm ci`, `npm run check`, and `git diff --check` pass;
3. the controlled commit and documentation accurately record the validation;
4. the branch is pushed and a pull request is opened with the matching title;
5. required CI is green and review/merge follows the task's explicit boundary.

Never report a validation, merge, release, or deployment as complete unless it
actually occurred.

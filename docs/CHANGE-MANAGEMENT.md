# Change management

YarReader uses permanent `YR-###` identifiers and controlled commit titles:

```text
[YR-051] [TYPE] Imperative title
```

Branches use `yr-###-imperative-summary`.

New primary types follow the complete WG-ARCH-001 §16 vocabulary: `INIT`,
`FEAT`, `FIX`, `SEC`, `API`, `A11Y`, `I18N`, `AI`, `DB`, `OPS`,
`TEST`, `DOCS`, `REFACTOR`, `PERF`, `BUILD`, `REVERT`, and `CHORE`.
The published YR-035 `CI` type remains valid only as immutable history; its exact
exception is kept beside the executable history validator rather than repeated
in a parallel documentation ledger.

Every controlled change body records `Change`, `Reason`, `Impact`, `Risk`,
`Controls`, `Validation`, `Evidence`, `Source`, and `Release`. `Risk`
is `Low`, `Medium`, or `High`. Add `Rollback` when the change affects
persistence, migration, archive, activation, schemas, provider settings, release
behavior, or another high-risk boundary.

`Source` identifies the current authority or input used for the change, such as
the current `main` commit and the active task, issue, or design decision. It is
required evidence context, not a reconstruction-era source-commit mapping.
`Evidence` records validation or repository/provider facts that actually
support the change. A failed validation is never represented as successful.

Provider-setting changes are isolated controlled work: keep the expected state
in `config/github-repository-settings.json`, capture live GitHub state before and
after the change, and run `npm run verify:github-settings` with authorized admin
credentials.

Git and GitHub are the authority for superseded repository states, pull requests,
workflow runs, tags, and Releases. Current-tree Markdown does not maintain a
second reconstruction map, completed-change ledger, or release-history archive.
Corrections move forward under new YR IDs; published history is not rewritten.

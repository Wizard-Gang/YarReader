# Change management

YarReader uses permanent `YR-###` identifiers and controlled commit titles:

```text
[YR-040] [TYPE] Imperative title
```

New primary types follow the complete WG-ARCH-001 §16 vocabulary: `INIT`,
`FEAT`, `FIX`, `SEC`, `API`, `A11Y`, `I18N`, `AI`, `DB`, `OPS`,
`TEST`, `DOCS`, `REFACTOR`, `PERF`, `BUILD`, `REVERT`, and `CHORE`.
One change has one primary type. The published YR-035 `CI` type remains valid
as immutable history, but new automation changes use `OPS` or `BUILD`.

Branches use `yr-###-imperative-summary`.

Each commit body records the change, reason, impact boundary, Low/Medium/High
risk, controls, validation actually performed, exact evidence, source
provenance, and target release. High-risk persistence and filesystem changes
also state rollback. A failed validation is never represented as successful.

The reconstruction map in `docs/history/CHANGE-MAP.csv` connects each controlled
change to the audited source commit. New work after v1.0.0 uses `direct` mapping
to its own pull request and design evidence rather than historical provenance.

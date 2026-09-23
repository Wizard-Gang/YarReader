# Change management

YarReader uses permanent `YR-###` identifiers and controlled commit titles:

```text
[YR-051] [TYPE] Imperative title
```

Branches use `yr-###-imperative-summary`.

Controlled PRs land through squash-only merges. The exact validated PR head becomes
one permanent controlled commit on `main`; merge commits and rebase merges are not
controlled delivery methods. Verify merged-main CI and completed-branch cleanup.

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

## Planned-work lifecycle

When `IMPLEMENTATION_PLAN.md` exists, it is a current/future queue rather than a completed-work ledger. Reconcile it with current `main` before selecting work, then take the first open task unless the owner explicitly overrides priority. If that first task is blocked by an unsatisfied dependency or required external/provider action, stop on that task and record the blocker; do not silently skip to later work.

A planned task is retired by the controlled change that delivers it. Remove its task block in that branch/PR before merge so merged `main` cannot retain work that the merge itself completed. Update later tasks in the same change when delivery changes their scope, order, dependencies, or acceptance. If the delivered task is the final open task, delete `IMPLEMENTATION_PLAN.md` in that same change after moving only durable current-state rules into permanent documentation.

After the merge succeeds, finish the same turn with a complete copy-paste kickoff prompt for the next open task, including any real dependency or blocker. If the queue is exhausted, hand off a fresh-state re-audit instead. Git/GitHub remain the authority for the task that just left the active queue.

Provider-setting changes are isolated controlled work: keep the expected state
in `config/github-repository-settings.json`, capture live GitHub state before and
after the change. Use `npm run verify:github-settings` for a read-only live check;
`npm run apply:github-settings` is the only normal settings mutation command and
independently re-reads provider state after applying committed policy.

Git and GitHub are the authority for superseded repository states, pull requests,
workflow runs, tags, and Releases. Current-tree Markdown does not maintain a
second reconstruction map, completed-change ledger, or release-history archive.
Corrections move forward under new YR IDs; published history is not rewritten.

# AGENTS.md

## Repository authority

Read `ARCHITECTURE.md`, `CONTRIBUTING.md`, the applicable task, and the active root `IMPLEMENTATION_PLAN.md` when it exists before changing the repository.

Executable source and validated contracts define shipped behavior. Current architecture and policy Markdown explain the present system. `AGENTS.md` and an active `IMPLEMENTATION_PLAN.md` describe current rules and future work only; they do not retain completed-task or legacy implementation narratives. Superseded repository states, releases, pull requests, completed tasks, and implementation history come from Git/GitHub.

## Active implementation plan

When `IMPLEMENTATION_PLAN.md` exists, reconcile it with current `main` before choosing work:

1. remove any task block whose pull request is already merged; never maintain a `Done`, completed, or historical task list in the plan;
2. treat the first remaining open task as the default next assignment before unrelated repository work, unless the owner explicitly overrides the plan; if that first task is blocked by an unsatisfied dependency or required external/provider action, stop on that task and report the blocker instead of silently skipping ahead;
3. keep only current and future state in the plan: active scope, current findings, decisions, dependencies, open tasks, and acceptance expectations;
4. update the plan in the same controlled change whenever delivery changes future scope, ordering, dependencies, or acceptance criteria;
5. retire a planned task in its own delivering controlled change: remove that task block before merge so accepted `main` never retains work that the merge itself completed;
6. when the delivering change removes the final open task, delete `IMPLEMENTATION_PLAN.md` in that same change, moving only durable current-state rules into their permanent authority;
7. after a successful merge, finish the same turn with a complete copy-paste prompt for the next open planned task, including any real dependency or blocker; when no task remains, hand off the required fresh-state re-audit instead.

Do not create parallel legacy, completed-task, or migration-history Markdown to replace information removed from the active plan.

### `do needful`

When the owner says `do needful` (or an equivalent instruction to continue), do not wait for a separately numbered prompt. Treat it as authorization to resume the active repository workflow:

1. fetch current `main` and reconcile it with open pull requests and `IMPLEMENTATION_PLAN.md`;
2. merge any already-green/current authoritative PR first when merging is possible;
3. remove task blocks that earlier merges already completed and reconcile resolved findings before selecting new work;
4. select the first remaining open planned task unless the owner explicitly changes priority; if that first task is blocked, stop there and surface the blocker rather than choosing a later task;
5. carry that task through branch → implementation → validation → controlled commit → pull request → exact-head CI → merge;
6. include retirement of the delivered task in that same controlled change, deleting `IMPLEMENTATION_PLAN.md` instead when it is the final open task;
7. after a successful merge, finish the same turn with a complete copy-paste kickoff prompt for the next open planned task, or with the required fresh-state re-audit prompt when the queue is exhausted.

A `do needful` instruction is not permission to fabricate provider changes, validations, releases, or merges that the available session cannot actually perform. If a required external/admin action is unavailable, preserve the controlled branch/PR truthfully and make that blocker the first requirement in the handoff prompt.

## Controlled change discipline

Start from an up-to-date `main` and keep each controlled change limited to one permanent YR ID. Confirm the current sequence with `npm run check:history`.

Branches use `yr-###-imperative-summary`. Commit and pull-request titles use `[YR-###] [TYPE] Imperative summary` with one current WG-ARCH-001 §16 type. New automation work uses `OPS` or `BUILD`.

Controlled commit bodies include `Change`, `Reason`, `Impact`, `Risk`, `Controls`, `Validation`, `Evidence`, `Source`, and `Release`. Add `Rollback` when the change affects persistence, migration, archive, activation, schemas, provider settings, release behavior, or another high-risk boundary.

## Product and safety boundaries

YarReader is intentionally a local/offline product. Do not introduce a hosted service, Cloudflare Worker, network dependency, production environment selector, or deployment path unless a controlled architecture change explicitly changes that product boundary.

Preserve the defining invariant: ingestion may be complex, but the activated reader is a self-contained directory that can be copied elsewhere and opened through `file://`. Static HTML and page images must remain usable without JavaScript; browser TypeScript may progressively enhance that complete markup.

Do not commit runtime media, real catalogs, generated work or exports, downloaded covers, credentials, private URLs, private keys, machine-specific paths, device identifiers, or real series-curation inventories. Keep tests isolated from real media and workspace state.

The durable filesystem, catalog, archive, normalization, and export transaction invariants in `ARCHITECTURE.md` are not incidental implementation details. A presentation/tooling normalization change must not weaken them.

## Delivery loop

Unless a task explicitly stops earlier or explicitly says not to merge, a controlled change is done only when:

1. the branch is based on current `main` and contains only the assigned YR ID;
2. every modified, deleted, and untracked file is accounted for and unrelated work is preserved;
3. `npm ci`, `npm run check`, `npm run build`, and `git diff --check` pass;
4. the controlled commit and current documentation accurately record validation that actually occurred;
5. the branch is pushed and a pull request is opened with the matching controlled title;
6. required CI is green on the current PR head and the PR is still current/mergeable;
7. the ready PR is merged when merging is possible.

A prompt for the next sequential YR change does not override step 7. If the current PR is green, authoritative, current, and mergeable, merge it first, then begin the next sequential change. Do not leave a ready current PR open merely because the next requested prompt is one ID ahead.

Never report a validation, push, pull request, merge, release, provider change, or deployment as complete unless it actually occurred.

## CI failure troubleshooting

When required CI is red:

1. fetch the workflow run for the exact current PR head;
2. enumerate its jobs and identify every failing job;
3. fetch the complete failing job log for each failure before diagnosing it;
4. diagnose from the log body, not only a status summary, check name, annotation, or remembered failure;
5. fix only demonstrated regressions, then rerun/refetch CI and continue until the required set is green;
6. preserve the one-controlled-change history rule while troubleshooting.

If complete logs cannot be retrieved, report the exact connector/API permission or retrieval error instead of guessing.

## Release boundary

Ordinary controlled changes do not publish releases or deploy anything. YarReader currently has no hosted production deployment. Annotated semantic-version tags and GitHub Releases are separate release actions governed by `docs/RELEASE-MANAGEMENT.md`.

Published tags, GitHub Releases, and accepted history are immutable. Corrections move forward under new YR IDs.

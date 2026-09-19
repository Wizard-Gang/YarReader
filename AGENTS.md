# AGENTS.md

## Repository authority

Read `ARCHITECTURE.md`, `CONTRIBUTING.md`, the applicable task, and the active root `IMPLEMENTATION_PLAN.md` when it exists before changing the repository.

Executable source and validated contracts define shipped behavior. Current architecture and policy Markdown explain the present system. An active `IMPLEMENTATION_PLAN.md` may coordinate work and reserve upcoming YR IDs, but it is temporary and cannot silently redefine shipped behavior; the completing change retires it. Superseded repository states, releases, pull requests, and implementation history come from Git/GitHub rather than permanent current-state prose.

## Controlled change discipline

Start from an up-to-date `main` and keep each controlled change limited to one permanent YR ID. Confirm the current sequence with `npm run check:history`.

Branches use `yr-###-imperative-summary`. Commit and pull-request titles use `[YR-###] [TYPE] Imperative summary` with one current WG-ARCH-001 §16 type. The historical YR-035 `CI` title is immutable; new automation work uses `OPS` or `BUILD`.

Until the active normalization plan retires the reconstruction-era record shape, controlled commit bodies include `Change`, `Reason`, `Impact`, `Risk`, `Controls`, `Validation`, `Evidence`, `Source`, and `Release`. Add `Rollback` when the change affects persistence, migration, archive, activation, schemas, provider settings, release behavior, or another high-risk boundary.

Do not consume a later reserved YR ID before the preceding planned change is merged unless the owner explicitly changes the sequence.

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

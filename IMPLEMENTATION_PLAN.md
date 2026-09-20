# YarReader Repository Normalization Implementation Plan

Status: **Active**

Scope: streamline YarReader around the published WG-ARCH-001 repository baseline while preserving its defining product boundary: a local crash-recoverable ingestion/archive CLI that emits a self-contained offline reader which works from `file://`.

This file is the active planning source of truth for YR-049 through YR-053. Executable source, `ARCHITECTURE.md`, current policy documents, and released interfaces remain authoritative for shipped behavior. This plan contains only current and future work. Merged task blocks are removed instead of being retained as a completed-task ledger. YR-053 retires this plan after the durable rules have moved into their permanent authorities.

## Context

Current-state observations:

| Area | Current state |
|---|---|
| Runtime/toolchain | Node 26.9.0, npm 11.19.1, TypeScript 7.0.2, strict ESM |
| Commands | `dev`, `build`, `typecheck`, `test:node`, `test:browser`, `test`, `check`, `check:history`, `check:safety`, and `verify:github-settings` exist; `dev` is a local-only synthetic Vite viewer preview |
| Viewer build | Vite 8 owns the viewer build and emits content-hashed JavaScript/CSS plus `dist/viewer/manifest.json`; export resolves assets through that manifest; the viewer TypeScript program is strict and no-emit |
| Browser presentation | two first-party TypeScript enhancement modules plus Vite-owned content-hashed CSS/JavaScript; the external viewer bundle auto-starts from inert document configuration; React 19 remains export-time only with no hydration or client router; the Vitest DOM acceptance suite remains authoritative |
| HTML/security | typed React 19 components render complete portable documents with `renderToStaticMarkup`; fallback presentation is Vite-owned CSS; startup configuration is inert `data-yar-*` markup consumed by the external Vite viewer; generated portable HTML has no executable inline scripts, `<style>` elements, style attributes, or handler attributes and carries the enforced file-compatible CSP with no `unsafe-inline` |
| Export boundary | `src/export.ts` owns transaction/orchestration; `src/export-presentation.ts` owns React static documents; `src/export-assets.ts` owns manifest-driven viewer publication; `src/export-validation.ts` owns portable-export validation; `src/export-security.ts` owns the portable HTML/CSP security contract; static HTML/images remain complete before enhancement |
| Release history | ten checked-in files under `docs/releases/`; `release.yml` reads them to publish GitHub Releases |
| Current released version | `package.json` 1.0.1 with GitHub Releases through v1.0.1 |
| Historical documentation | reconstruction narrative plus `docs/history/**` duplicate superseded repository/release state that Git/GitHub already retain |
| GitHub settings | active `main` and `v*` rulesets match `config/github-repository-settings.json`; merge commits are the only merge method; merged branches are deleted |

## Plan maintenance

- Reconcile this file with current `main` before beginning work and remove task blocks already merged.
- Work the first remaining open task before unrelated repository work unless the owner explicitly changes priority.
- Update future tasks in the same controlled change when delivery changes their scope, dependency, order, or acceptance criteria.
- Do not add completed-task summaries, merge SHAs, PR ledgers, or other legacy narration here; Git/GitHub is the history authority.
- After a task merges, remove its block at the start of the next controlled change. When no open task remains, retire this file.
- `do needful` means resume this queue without waiting for a separately numbered prompt: merge any ready current PR first, purge merged task blocks/resolved findings, execute the first remaining open task through the full delivery loop, and end with a copy-paste prompt for the next open task.
- If an open task requires an unavailable external/admin capability, split only the blocked external action forward when necessary to keep repository-owned work moving; record the blocker explicitly rather than claiming completion.

## Product goal

Keep YarReader small, local, deterministic, and portable while bringing its repository, browser presentation, security policy, release authority, and GitHub settings onto the same conventions used by the rest of WizardGang.

Normalization must not turn YarReader into a hosted service. YarReader is the WG-ARCH-001 §27 offline-reader exception: it does not need Cloudflare Workers or Wrangler because its production artifact is a local CLI plus a portable static directory. Browser-facing parts still adopt the shared React/Vite/security rules where they apply.

## Decisions

These decisions govern the sequence unless a later controlled record explicitly changes one.

1. **Offline product boundary.** No Worker, server, cloud deployment, database service, or network dependency is introduced. `file://` portability remains a product invariant.
2. **Static-first presentation.** Library and reader documents remain complete and usable without JavaScript. First-party browser code only enhances already-complete markup.
3. **React rendering.** React 19 renders portable HTML at export/build time with `renderToStaticMarkup`. There is no client hydration and no client-side router.
4. **Browser assets.** Vite 8 builds viewer TypeScript and CSS into content-hashed files. Export consumes a generated Vite manifest rather than hard-coded output names.
5. **Testing split.** Existing pipeline and filesystem tests may remain on `node:test`. Vitest 5 owns tests that need TypeScript browser modules or a DOM.
6. **No unsafe inline code.** Portable HTML carries no inline event handlers, executable inline scripts, or inline styles. Its Content Security Policy does not allow `'unsafe-inline'`.
7. **Small export modules.** The current `src/export.ts` orchestration/rendering/asset/validation responsibilities are separated while preserving transaction and recovery behavior.
8. **Git/GitHub history authority.** Annotated tags, GitHub Releases, pull requests, workflow runs, and commits retain historical state. Current Markdown does not maintain a second per-version or reconstruction archive.
9. **Provider settings are controlled work.** GitHub settings changes are isolated, their expected state is committed, and before/after provider state is recorded.
10. **Controlled delivery.** Future changes branch from the latest merged `main`. A green, current, mergeable PR is merged unless the task explicitly says not to merge; a prompt for the next sequential ID does not leave the prior ready PR unmerged.
11. **Release target.** The normalization sequence prepares v1.1.0. The release tag itself is not pushed without an explicit release instruction.
12. **Private-data boundary.** Runtime media, catalogs, generated exports, covers, credentials, private URLs, personal paths, and real curation inventories never enter repository history.

## Findings this sequence closes

### F6 — Current-tree release Markdown duplicates GitHub Releases

`docs/releases/v*.md` is a parallel release archive, and `release.yml` depends on it. WG-ARCH-001 makes annotated tags and GitHub Releases the release-history authority.

### F7 — Release publication does not fully enforce the shared tag contract

The workflow verifies that a tag is annotated, but it does not require the checked-out `package.json` version to equal the semantic tag and still sources notes from repository Markdown.

### F9 — Reconstruction-era documentation remains in the current tree

`docs/RECONSTRUCTION.md` and `docs/history/**` narrate superseded implementation/publication state. That information is already available from immutable Git/GitHub history and should not stay as a second authority.

### F11 — The permanent architecture does not yet state the §27 exception

`ARCHITECTURE.md` accurately describes an offline static reader, but it does not explicitly state why Cloudflare/Workers deployment rules are not applicable or which parts of the browser baseline are still required.

### F12 — README and contributor guidance lag the post-YR-040 command model

The README still presents `typecheck` and `test` separately as the normal verification path instead of the canonical `npm run check` gate.

## Delivery sequence

Changes are sequential. The first task below is the current default assignment. Do not consume a later reserved YR ID before the prior change is merged unless the owner explicitly changes the plan.

### YR-049 — A11Y — Lock portable-reader accessibility

- audit the synthetic library and reader against the repository's WCAG 2.2 aligned — uncertified posture;
- preserve semantic landmarks and heading order, usable link/button names, visible focus, keyboard navigation, image/page alternatives, responsive reading modes, and non-color-only state;
- keep right-to-left reading behavior distinct from document language/direction metadata;
- add deterministic DOM tests for the accessibility invariants that can be automated and document the small manual browser acceptance set that cannot;
- make no certification claim.

### YR-050 — BUILD — Make GitHub Releases the only release archive

- update `release.yml` so it checks out the exact semantic annotated tag, requires `package.json` version to match it, runs `npm ci` and `npm run check`, and publishes GitHub-generated notes from Git/GitHub state;
- remove `docs/releases/**` and every workflow/document dependency on per-version Markdown;
- update `docs/RELEASE-MANAGEMENT.md` to describe only the current release procedure;
- keep YarReader release-only: there is no production server deployment stage because the product artifact is local/offline;
- do not move or rewrite any existing tag or GitHub Release.

Closes F6 and F7.

### YR-051 — DOCS — Retire reconstruction-era current-tree history

- remove `docs/RECONSTRUCTION.md` and historical ledgers under `docs/history/**` once no executable validator depends on them, and do not replace them with another legacy-document archive;
- simplify `scripts/check-controlled-history.mjs` and `docs/CHANGE-MANAGEMENT.md` so future direct work does not require reconstruction-specific source provenance or a parallel change map;
- keep exact immutable legacy exceptions beside the validator only where validation still needs them;
- update `ARCHITECTURE.md` with the permanent offline-reader §27 exception, React/Vite/static-first presentation boundary, and no-hosted-deployment rule;
- update README verification and documentation links to the canonical current-state commands/docs;
- retain Git/GitHub as the authority for superseded states and release history.

Closes F9, F11, and F12.

### YR-052 — TEST — Enforce repository-baseline conformance

- add a repository-baseline validator to `npm run check` covering toolchain pins, required commands/files, Vite/React/Vitest versions where applicable, release-history rules, and workflow expectations;
- verify no checked-in per-version release archive or reconstruction narrative has returned;
- verify browser assets are content hashed, portable documents are React-rendered/static-first, and no disallowed inline code ships;
- verify `npm ci`, `npm run check`, `npm run build`, and `git diff --check` from a clean checkout;
- make the validator describe the intentional no-Wrangler/no-Workers exception rather than reporting it as drift.

### YR-053 — BUILD — Prepare normalized v1.1.0 release

After YR-049 through YR-052 are merged and green:

- set `package.json` to 1.1.0 and reproduce the final release candidate from a clean checkout;
- move every durable rule from this plan into `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, or the relevant current policy document;
- delete this `IMPLEMENTATION_PLAN.md`;
- confirm the repository settings verifier matches actual GitHub state;
- confirm the current branch has no uncontrolled dependency PR that can be merged into the release line;
- merge the green/current PR under the merge-commit-only policy;
- stop before creating or pushing v1.1.0 unless the owner explicitly requests the release.

## Validation expectations

Every repository-changing task follows `AGENTS.md` and `docs/CHANGE-MANAGEMENT.md`.

At minimum before opening a pull request:

```text
npm ci
npm run check
npm run build
git diff --check
```

Additional validation is scoped by task:

- browser/presentation changes also run the synthetic portable-reader acceptance suite;
- security changes exercise a generated portable directory in a real browser when available and inspect policy violations;
- provider-setting changes record before/after GitHub API state and run the settings verifier;
- release changes reproduce the exact proposed tagged tree and compare `package.json` version with the tag;
- filesystem/archive changes retain the existing crash-recovery and no-real-media test boundaries.

## Non-goals

This sequence does not:

- redesign the library/reader UI;
- add cloud hosting, a Worker, Wrangler, D1, R2, Durable Objects, authentication, or a network API;
- change source identity, catalog schema, archive transaction semantics, normalization profile, or export-generation atomicity unless a later task explicitly proves that such a change is required;
- import real library data, covers, or personal paths into fixtures;
- rewrite existing published tags, Releases, commits, or historical PRs;
- add client hydration or a client-side router.

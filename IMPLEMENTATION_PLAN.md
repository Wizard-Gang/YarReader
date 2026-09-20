# YarReader Repository Normalization Implementation Plan

Status: **Active**

Scope: streamline YarReader around the published WG-ARCH-001 repository baseline while preserving its defining product boundary: a local crash-recoverable ingestion/archive CLI that emits a self-contained offline reader which works from `file://`.

This file is the active planning source of truth for YR-052 through YR-053. Executable source, `ARCHITECTURE.md`, current policy documents, and released interfaces remain authoritative for shipped behavior. This plan contains only current and future work. Merged task blocks are removed instead of being retained as a completed-task ledger. YR-053 retires this plan after the durable rules have moved into their permanent authorities.

## Context

Current-state observations:

| Area | Current state |
|---|---|
| Runtime/toolchain | Node 26.9.0, npm 11.19.1, TypeScript 7.0.2, strict ESM |
| Commands | `dev`, `build`, `typecheck`, `test:node`, `test:browser`, `test`, `check`, `check:history`, `check:safety`, `check:baseline`, and `verify:github-settings` exist; `typecheck` covers every TypeScript program; `dev` is a local-only synthetic Vite viewer preview |
| Viewer build | Vite 8 owns the viewer build and emits content-hashed JavaScript/CSS plus `dist/viewer/manifest.json`; export resolves assets through that manifest; the viewer TypeScript program is strict and no-emit |
| Browser presentation | two first-party TypeScript enhancement modules plus Vite-owned content-hashed CSS/JavaScript; the external viewer bundle auto-starts from inert document configuration; React 19 remains export-time only with no hydration or client router; the Vitest DOM acceptance suite remains authoritative |
| HTML/security | typed React 19 components render complete portable documents with `renderToStaticMarkup`; fallback presentation is Vite-owned CSS; startup configuration is inert `data-yar-*` markup consumed by the external Vite viewer; generated portable HTML has no executable inline scripts, `<style>` elements, style attributes, or handler attributes and carries the enforced file-compatible CSP with no `unsafe-inline` |
| Export boundary | `src/export.ts` owns transaction/orchestration; `src/export-presentation.ts` owns React static documents; `src/export-assets.ts` owns manifest-driven viewer publication; `src/export-validation.ts` owns portable-export validation; `src/export-security.ts` owns the portable HTML/CSP security contract; static HTML/images remain complete before enhancement |
| Release history | annotated semantic tags and GitHub Releases are the sole release archive; `release.yml` verifies the exact tagged tree and package version, runs the repository gate, and publishes generated notes from Git/GitHub state; there is no production deployment stage |
| Current released version | `package.json` 1.0.1 with GitHub Releases through v1.0.1 |
| Historical state | Git/GitHub are the sole authority for superseded repository states and release history; the current tree keeps no reconstruction narrative or parallel historical ledger |
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

## Delivery sequence

Changes are sequential. The first task below is the current default assignment. Do not consume a later reserved YR ID before the prior change is merged unless the owner explicitly changes the plan.

### YR-052 — TEST — Enforce repository-baseline conformance

- add a repository-baseline validator to `npm run check` covering toolchain pins, required commands/files, Vite/React/Vitest versions where applicable, release-history rules, and workflow expectations;
- verify no checked-in per-version release archive or reconstruction narrative has returned;
- verify browser assets are content hashed, portable documents are React-rendered/static-first, and no disallowed inline code ships;
- verify `npm ci`, `npm run check`, `npm run build`, and `git diff --check` from a clean checkout;
- make the validator describe the intentional no-Wrangler/no-Workers exception rather than reporting it as drift.

### YR-053 — BUILD — Prepare normalized v1.1.0 release

After YR-052 is merged and green:

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

# Active implementation plan

This is YarReader's current/future process-parity wave under WG-ARCH-001 §27 as accepted in `SouthernGentlemen/wizardgang-architecture-demo`. It takes priority over unqueued improvements. On `do needful`, fetch `main`, open PRs and exact-head CI; finish a green/current authoritative PR first, otherwise deliver only the first task. Each delivering PR removes its own block, adjusts later blocks when evidence changes, and ends with a prompt for the next task. Delete this file with its final task. Git/GitHub retain completed work.

YarReader remains an offline, portable `file://` reader: hosted deployment, a Worker, production environment and `npm run dev` server lifecycle are N/A. Its browser viewer, transactional filesystem/archive behavior, public-history safety gate, annotated releases and provider settings remain applicable. Use the repository's current merge policy; do not publish v1.1.0 merely because the package version has been prepared. Target one narrow outcome per web turn; re-audit from fresh state when this wave ends.

## Open tasks

### YR-059 — [TEST] Check committed PR whitespace against its base

- Dependency: YR-058 merged.
- Why: CI's bare `git diff --check` can miss whitespace already committed on the PR head.
- Scope: Use the actual PR base/head range in CI with a documented local equivalent; add a small failing fixture/test if practical.
- Non-goals: No merge-method change.
- Acceptance: A committed whitespace defect fails exact-head CI; clean changes pass.
- Validation: Focused whitespace fixture; `npm run check`; `git diff --check`.
- Authorities: `.github/workflows/ci.yml`, `CONTRIBUTING.md`.

### YR-060 — [TEST] Test repository-settings comparison without credentials

- Dependency: YR-059 merged.
- Why: Live settings verification exists, but `check` has no pure regression cases for its expected/actual ruleset projection.
- Scope: Extract/test missing, changed and matching main/tag settings without making provider calls in `check`; preserve the separate live verifier.
- Non-goals: No provider settings mutation.
- Acceptance: Material committed-settings drift fails local tests; live verification remains distinct.
- Validation: Focused settings tests; `npm run check`; `npm run verify:github-settings` when authorized; `git diff --check`.
- Authorities: `scripts/verify-github-settings.mjs`, settings baseline, `package.json`.

### YR-061 — [TEST] Guard the offline release boundary with local cases

- Dependency: YR-060 merged.
- Why: The release workflow checks annotated semantic tags and package identity, but local tests do not guard that boundary against workflow drift.
- Scope: Add focused release-identity cases for tag syntax, annotation, exact checkout and package-version agreement; wire them into `check`.
- Non-goals: No tag, GitHub Release, hosted deploy or publication in this task.
- Acceptance: A mismatched or lightweight tag is rejected before publication; valid exact-tag input passes.
- Validation: Focused release cases; `npm run check`; `git diff --check`.
- Authorities: `.github/workflows/release.yml`, `docs/RELEASE-MANAGEMENT.md`.

### YR-062 — [SEC] Resolve the current high-severity Sharp advisory

- Dependency: YR-061 merged.
- Why: Fresh `npm ci`/`npm audit` reports a high-severity `sharp` advisory in the current lockfile.
- Scope: Review and update only the affected Sharp version/range and lockfile to a compatible fixed version; preserve image processing and the offline product boundary.
- Non-goals: No broad dependency sweep or new runtime network requirement.
- Acceptance: `npm audit --audit-level=high` passes and image/reader tests remain green.
- Validation: `npm ci`; `npm audit --audit-level=high`; `npm run check`; `git diff --check`.
- Authorities: `package.json`, package lock, image tests.

### YR-063 — [BUILD] Keep dependency advisories as an explicit CI gate

- Dependency: YR-062 merged.
- Why: Public-history safety is strong, but the lockfile has no current network-advisory gate in CI.
- Scope: Add a named high-severity dependency audit to CI and local guidance, separate from credential-free/offline `check`; distinguish an advisory from registry unavailability.
- Non-goals: No package upgrade or new runtime network requirement for the reader.
- Acceptance: CI fails on high-severity advisories; a disconnected cloud agent reports the audit as unavailable, never green.
- Validation: Named audit command when network exists; `npm run check`; `git diff --check`.
- Authorities: `package.json`, `.github/workflows/ci.yml`, `SECURITY.md`.

## Recheck after this wave

Audit command/CI parity and process conformance from fresh `main` before another wave. Preserve the offline product boundary and decide separately whether the prepared package version should become an immutable release; a version string alone is not release authority.

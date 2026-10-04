# Implementation plan

## Open tasks

### YR-078 — [OPS] Tombstone the repository

- Dependency: Wizard-Gang/WizardGang WG-125 has released v1.3.0, so wizardgang.ai no longer describes or links YarReader (WG-123 removes it). YarReader has no Cloudflare footprint.
- Why: The owner retired YarReader on 2026-10-02 as part of the Cloudflare consolidation. It closes like the 2026-10-02 tombstones of Warcraft, FightLab, House and RealEstate: private, archived and read-only.
- Scope: In one controlled change, delete every tracked file except tombstone `AGENTS.md`, `CLAUDE.md` and `README.md` (plus `LICENSE`). The README says YarReader was retired and archived with no further development, and names the last pre-tombstone commit where the source and docs remain readable. Disable or remove workflows that would run on the tombstone commit. After the merge, make the repository private and archive it with live readback, then add a local `.git/hooks/pre-commit` that refuses commits.
- Non-goals: No release, tag, deployment or history rewrite; existing tags and Releases stay as they are.
- Acceptance: `main` holds only the tombstone files. The repository is private and archived on independent readback. The pre-tombstone commit SHA is recorded in the README and on the PR.
- Validation: Exact-head required CI on the tombstone PR, squash merge, then live readback of visibility and archive state.
- Authorities: AGENTS.md, README.md, config/github-repository-settings.json, owner direction of 2026-10-02 and 2026-10-04, and the House tombstone (HOUSE-002) as precedent.

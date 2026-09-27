# Implementation plan

## Open tasks

### YR-072 — [OPS] Codify and verify existing repository auto-merge

- Dependency: YR-071 plan-only queue publication has merged; preserve the current protected-main, CI, release, and deployment authorities.
- Why: GitHub already allows per-PR auto-merge, but the committed settings authority cannot detect or preserve that live control.
- Scope: Commit `allowAutoMerge: true` in the repository settings authority; compare live `allow_auto_merge` in the read-only verifier, include it in the bounded apply payload, and add a pure drift case. Document that repository auto-merge availability does not enroll individual PRs. Preserve current merge methods, strict current-with-main checks, bypass actors, automatic completed-branch deletion, and immutable release tags. Retire this task into the shared permanent empty queue.
- Non-goals: Do not auto-enroll unrelated PRs, change required check names, create a release, deploy production, or alter application behavior.
- Acceptance: Focused tests reject disabled auto-merge; canonical check and exact-head CI pass; live `allow_auto_merge` is true after independent readback; squash-only/current-main protection and release tags remain unchanged; one YR-072 squash commit lands on main with green post-merge CI and branch cleanup. The currently enabled live auto-merge remains true and the verifier proves it without unnecessary provider mutation.
- Validation: Pinned npm ci, focused settings cases, canonical credential-free check, separate advisory gate when applicable, committed-range whitespace check, exact-head required CI, live settings verification, post-merge CI, history and branch cleanup.
- Authorities: AGENTS.md, README.md, config/github-repository-settings.json, repository settings verifier/apply scripts and pure cases, current GitHub repository settings and rulesets.

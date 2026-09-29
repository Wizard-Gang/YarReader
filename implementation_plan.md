# Implementation plan

## Open tasks

### YR-074 — [OPS] Cut and publish verified releases from chat-driven main delivery

After successful CI for a push to the exact current `main` commit, create or verify the immutable annotated `v<package-version>` tag. Explicitly dispatch the Release workflow with that tag and expected commit because a tag pushed with `GITHUB_TOKEN` does not start another workflow. Verify the exact tag, annotation, package version, accepted main ancestry, and immutable GitHub Release before reporting success. Keep the existing source-only, offline product boundary and never create a hosted deployment. Update release documentation and focused workflow/identity tests. The current `1.1.0` package version is the first eligible release once this controlled task merges and CI passes; do not alter that version as part of this task.

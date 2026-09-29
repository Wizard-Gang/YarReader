# Release management

YarReader publishes source-only GitHub Releases from annotated semantic-version
tags. The annotated tag and its GitHub Release are the release-history authority;
the repository does not keep per-version release Markdown.

YarReader has no hosted production deployment stage. The released product is the
local/offline repository state used to build the CLI and the portable static
reader that opens from `file://`.

## Release procedure

1. Merge a controlled change with an intended semantic version in `package.json`
   to `main`. After CI passes on the exact current `main` commit, Release Cutter
   creates or verifies its annotated `v<package-version>` tag. A stale CI run
   does not cut a tag. An existing version tag remains at its original accepted
   main commit; later same-version merges do not move it.
2. Release Cutter explicitly dispatches `Release` with the tag and accepted
   commit. GitHub does not trigger a second workflow from a tag pushed with the
   workflow token. The Release workflow checks out that tag, proves its
   annotation, version, exact commit, and accepted-main ancestry, then runs
   `npm ci` and `npm run check` before publishing the GitHub Release.
3. Verify the Release workflow, tag object, and published GitHub Release.

For a manual recovery or investigation, use a clean checkout of the exact tag
and run:

   ```sh
   npm ci
   npm run check
   npm run build
   git diff --check
   ```

The `Release` workflow also accepts an intentional tag push, and a dispatch
with the existing tag and expected commit can recover an interrupted cutter.
Neither route changes an existing tag. The current `1.1.0` package version is
the first eligible chat-driven release after this change reaches validated main.

Published tags and GitHub Releases are immutable. Corrections move forward
through a new controlled change and a new semantic version/tag.

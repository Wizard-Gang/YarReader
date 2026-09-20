# Release management

YarReader publishes source-only GitHub Releases from annotated semantic-version
tags. The annotated tag and its GitHub Release are the release-history authority;
the repository does not keep per-version release Markdown.

YarReader has no hosted production deployment stage. The released product is the
local/offline repository state used to build the CLI and the portable static
reader that opens from `file://`.

## Release procedure

1. Merge the release-preparation change to `main` and confirm required CI is
   green.
2. From a clean checkout of that exact `main` commit, run:

   ```sh
   npm ci
   npm run check
   npm run build
   git diff --check
   ```

3. Confirm `package.json` contains the intended semantic version.
4. Create an annotated `v<package-version>` tag on that exact commit and push
   the tag. Never move or replace a published tag.
5. The `Release` workflow checks out the exact pushed tag, proves that the tag
   is semantic and annotated, verifies that `package.json` matches it, runs
   `npm ci` and `npm run check`, and creates the GitHub Release with notes
   generated from Git/GitHub state.
6. Verify the Release workflow and resulting GitHub Release.

Published tags and GitHub Releases are immutable. Corrections move forward
through a new controlled change and a new semantic version/tag.

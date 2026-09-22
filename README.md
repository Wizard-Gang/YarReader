# YarReader

YarReader is a local ingestion pipeline and portable static reader for comics and other page-oriented publications. It converts mixed source files into a content-addressed archive and verified offline library.

**[Architecture](ARCHITECTURE.md)** · **[Release management](docs/RELEASE-MANAGEMENT.md)**

## Run locally

```bash
npm ci
npm run build
npm link
yar paths
```

The default workspace is `~/Documents/media`. Override it with `--workspace` or `YAR_WORKSPACE`:

```bash
yar --workspace /path/to/media init
yar --workspace /path/to/media update --stable-seconds 0
```

## Command contract

Install the pinned dependency graph first with `npm ci`. The repository pins Node
26.9.0 in `.node-version` and npm 11.19.1 in `package.json`.

| Command | Use it for | Current side effects / prerequisites |
| --- | --- | --- |
| `npm run dev` | Interactive viewer development | Starts Vite on `127.0.0.1:5173` and opens `/dev/viewer/index.html`. It is a local development server only; it is not a hosted-production lifecycle and does not run repository acceptance. |
| `npm run typecheck` | Type-checking the Node, viewer, and browser-test programs | All three TypeScript invocations are validation-only and use `--noEmit`; running this command does not create production/compiler output in `dist`. |
| `npm test` / `npm run test` | Node and browser test suites | Runs `npm run build` first, so it writes production/compiler output to `dist`, then runs Node tests from `dist/test` and Vitest browser-module/DOM tests. |
| `npm run build` | Production build output | Compiles the Node/test TypeScript program into `dist` and builds the viewer bundle into `dist/viewer`. It does not run the test suites. |
| `npm run check` | Credential-free local repository acceptance | Runs `typecheck`, `test`, another `build`, controlled-history validation, public-safety validation, and repository-baseline validation. It does not contact GitHub for live settings. |
| `npm run verify:github-settings` | Compare live GitHub repository/ruleset settings with `config/github-repository-settings.json` | Provider/network-aware and separate from `check`; use GitHub API credentials with enough access to read the repository and rulesets when required. The command verifies only and does not mutate settings. |

The current command graph intentionally still contains temporary duplicate work:
`test` performs one full production build, `check` performs another after
`test`, and CI performs a third standalone `npm run build` after `check`.
Later planned build work owns removal of the duplicate production builds;
documentation here describes the current executable truth.

Before opening a pull request, run:

```bash
npm ci
npm run check
npm run build
git diff --check
```

Release publication is separate from ordinary development and acceptance. An
annotated semantic-version tag matching `package.json` triggers the Release
workflow, which verifies the exact tag state and creates the GitHub Release.
Preparing a version string does not publish a release; see
[Release management](docs/RELEASE-MANAGEMENT.md).

YarReader has no hosted production deployment, Worker, or production-environment
lifecycle. The released product remains the local/offline CLI plus portable static
reader that opens through `file://`.

## Structure

- `src/` contains the CLI, adapters, catalog, archive, and export pipeline.
- `src/viewer/` contains the static reader source.
- `src/domain.ts` contains the validated data contracts.
- `test/` contains pipeline, recovery, and reader tests.
- `scripts/` contains build and repository checks.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Change management](docs/CHANGE-MANAGEMENT.md)
- [Release management](docs/RELEASE-MANAGEMENT.md)
- [Accessibility](docs/ACCESSIBILITY.md)

Superseded repository states and release history are retained by Git and GitHub,
not by a parallel current-tree history archive.

## Deployment

YarReader has no hosted production deployment. `yar update` activates a verified
static library generation, and `yar portable /path/to/destination` copies it into
a self-contained directory for offline use through `file://`.

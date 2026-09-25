# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through this repository's GitHub
**Report a vulnerability** advisory flow. Do not open a public issue for a
suspected vulnerability.

Include the affected release or commit, observed impact, and reproducible steps
that use synthetic files rather than private library data.

## Data and filesystem boundary

YarReader processes untrusted archive paths and mutates user-managed files only
through explicit normalization and archive gates. Relevant reports include path
traversal, symlink escape, incomplete-input activation, archive loss, export
integrity bypass, unsafe remote-cover handling, and disclosure of workspace
state.

No credential, real catalog, media file, downloaded cover, personal path,
private URL, device identifier, or private curation inventory belongs in the
repository, its history, tests, documentation, or release artifacts.

## Dependency advisories

`npm run security:dependency-advisories` is the explicit live high-severity dependency-advisory gate. It queries the npm advisory service separately from credential-free `npm run check`: a clean completed audit is green, a high/critical finding fails, and registry/advisory-service unavailability is reported as unavailable and remains non-green. CI runs this named gate after `npm ci` and before the offline repository acceptance gate.

## Supported versions

Security fixes target the latest release. Published releases are not rewritten;
corrections move forward in a new `[YR-###] [SEC]` change and patch release.

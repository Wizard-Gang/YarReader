import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const execFileAsync = promisify(execFile);
const failures = [];

function fail(message) {
  failures.push(message);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

async function read(relative) {
  return readFile(path.join(root, relative), "utf8");
}

async function exists(relative) {
  try {
    await stat(path.join(root, relative));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function runGit(cwd, ...args) {
  return execFileAsync("git", args, { cwd, encoding: "utf8" });
}

async function proveCommittedWhitespaceRange() {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "yarreader-whitespace-"));
  const fixture = path.join(fixtureRoot, "fixture.txt");

  try {
    await runGit(fixtureRoot, "init", "--quiet");
    await runGit(fixtureRoot, "config", "user.name", "YarReader baseline");
    await runGit(fixtureRoot, "config", "user.email", "baseline@example.invalid");

    await writeFile(fixture, "base\n", "utf8");
    await runGit(fixtureRoot, "add", "fixture.txt");
    await runGit(fixtureRoot, "commit", "--quiet", "-m", "base");
    const { stdout: baseStdout } = await runGit(fixtureRoot, "rev-parse", "HEAD");
    const base = baseStdout.trim();

    await writeFile(fixture, "base\nclean\n", "utf8");
    await runGit(fixtureRoot, "add", "fixture.txt");
    await runGit(fixtureRoot, "commit", "--quiet", "-m", "clean");
    const { stdout: cleanStdout } = await runGit(fixtureRoot, "rev-parse", "HEAD");
    const cleanHead = cleanStdout.trim();
    await runGit(fixtureRoot, "diff", "--check", `${base}...${cleanHead}`);

    await writeFile(fixture, "base\nclean\ntrailing   \n", "utf8");
    await runGit(fixtureRoot, "add", "fixture.txt");
    await runGit(fixtureRoot, "commit", "--quiet", "-m", "defect");
    const { stdout: defectStdout } = await runGit(fixtureRoot, "rev-parse", "HEAD");
    const defectHead = defectStdout.trim();

    let rejected = false;
    try {
      await runGit(fixtureRoot, "diff", "--check", `${base}...${defectHead}`);
    } catch {
      rejected = true;
    }
    expect(rejected, "committed-range whitespace proof must reject a committed trailing-whitespace defect");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function collect(relative) {
  const base = path.join(root, relative);
  const entries = await readdir(base, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await collect(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function hasLine(text, line) {
  return text.split(/\r?\n/).includes(line);
}

function dependencyVersion(pkg, name) {
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
}

function majorIs(version, major) {
  return typeof version === "string" && new RegExp(`^${major}\\.`).test(version);
}

const requiredFiles = [
  ".gitignore",
  ".node-version",
  ".npmrc",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.viewer.json",
  "tsconfig.browser-test.json",
  "vite.viewer.config.ts",
  "vitest.config.ts",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "scripts/validate-release-identity.mjs",
  "test/release-identity.test.mjs",
  "scripts/dependency-advisory-policy.mjs",
  "scripts/audit-dependencies.mjs",
  "test/dependency-advisory-policy.test.mjs",
  "config/github-repository-settings.json",
  "docs/CHANGE-MANAGEMENT.md",
  "docs/RELEASE-MANAGEMENT.md",
  "src/export.ts",
  "src/export-assets.ts",
  "src/export-presentation.ts",
  "src/export-security.ts",
  "src/export-validation.ts",
  "test/browser/portable-independence.test.ts",
];

for (const file of requiredFiles) {
  expect(await exists(file), `required repository file is missing: ${file}`);
}

const [
  packageText,
  nodeVersionText,
  npmrc,
  tsconfigText,
  viewerTsconfigText,
  browserTsconfigText,
  architecture,
  ci,
  release,
  releaseIdentityValidator,
  releaseIdentityTest,
  viteConfig,
  exportSource,
  exportAssets,
  presentation,
  security,
  exportValidation,
  portableTest,
  githubSettingsPolicy,
  githubSettingsVerifier,
  githubSettingsProvider,
  githubSettingsApply,
  githubSettingsTest,
] = await Promise.all([
  read("package.json"),
  read(".node-version"),
  read(".npmrc"),
  read("tsconfig.json"),
  read("tsconfig.viewer.json"),
  read("tsconfig.browser-test.json"),
  read("ARCHITECTURE.md"),
  read(".github/workflows/ci.yml"),
  read(".github/workflows/release.yml"),
  read("scripts/validate-release-identity.mjs"),
  read("test/release-identity.test.mjs"),
  read("vite.viewer.config.ts"),
  read("src/export.ts"),
  read("src/export-assets.ts"),
  read("src/export-presentation.ts"),
  read("src/export-security.ts"),
  read("src/export-validation.ts"),
  read("test/browser/portable-independence.test.ts"),
  read("scripts/github-settings-policy.mjs"),
  read("scripts/verify-github-settings.mjs"),
  read("scripts/github-settings-provider.mjs"),
  read("scripts/apply-github-settings.mjs"),
  read("test/github-settings-policy.test.mjs"),
]);

const pkg = JSON.parse(packageText);
const nodeVersion = nodeVersionText.trim();
expect(/^26\.\d+\.\d+$/.test(nodeVersion), ".node-version must pin an exact Node 26 release");
expect(pkg.engines?.node === "26.x", "engines.node must be 26.x");
expect(pkg.engines?.npm === "11.x", "engines.npm must be 11.x");
expect(/^npm@11\.\d+\.\d+$/.test(pkg.packageManager ?? ""), "packageManager must pin an exact npm 11 release");
expect(pkg.type === "module", 'package.json must declare "type": "module"');
expect(hasLine(npmrc, "engine-strict=true"), ".npmrc must enable engine-strict");
expect(hasLine(npmrc, "strict-allow-scripts=true"), ".npmrc must enable strict install-script allowlisting");
expect(pkg.allowScripts && typeof pkg.allowScripts === "object", "package.json must define allowScripts");
expect(pkg.allowScripts?.["sharp@0.35.4"] === true, "sharp install scripts must be explicitly approved");

expect(majorIs(dependencyVersion(pkg, "typescript"), 7), "TypeScript must remain on major 7");
expect(majorIs(dependencyVersion(pkg, "vite"), 8), "Vite must remain on major 8");
expect(majorIs(dependencyVersion(pkg, "vitest"), 5), "Vitest must remain on major 5");
expect(majorIs(dependencyVersion(pkg, "react"), 19), "React must remain on major 19");
expect(majorIs(dependencyVersion(pkg, "react-dom"), 19), "react-dom must remain on major 19");

const requiredCommands = [
  "dev",
  "build",
  "typecheck",
  "test:node",
  "test:browser",
  "test:settings",
  "test:release",
  "test",
  "check",
  "check:history",
  "check:safety",
  "check:baseline",
  "audit:high",
  "test:audit-policy",
  "verify:github-settings",
  "apply:github-settings",
  "test:github-settings",
];
for (const command of requiredCommands) {
  expect(typeof pkg.scripts?.[command] === "string" && pkg.scripts[command].length > 0, `required command is missing: ${command}`);
}
expect(pkg.scripts?.dev === "vite --config vite.viewer.config.ts", "dev must remain the local-only synthetic Vite preview");
expect(pkg.scripts?.build === "tsc -p tsconfig.json && vite build --config vite.viewer.config.ts", "build must remain deterministic and deployment-free");
expect(pkg.scripts?.typecheck?.includes("tsc -p tsconfig.json --noEmit"), "typecheck must validate the primary TypeScript program without emitting");
expect(pkg.scripts?.typecheck?.includes("tsconfig.viewer.json"), "typecheck must include the viewer TypeScript program");
expect(pkg.scripts?.typecheck?.includes("tsconfig.browser-test.json"), "typecheck must include the browser-test/tooling TypeScript program");
expect(pkg.scripts?.["test:settings"] === "node --test --test-reporter=spec test/github-settings-policy.test.mjs", "test:settings must run the credential-free repository-settings policy cases");
expect(pkg.scripts?.["test:github-settings"] === "npm run test:settings", "test:github-settings must reuse the pure settings cases");
expect(pkg.scripts?.["apply:github-settings"] === "node scripts/apply-github-settings.mjs", "apply:github-settings must be the explicit settings mutation command");
expect(pkg.scripts?.["test:release"] === "node --test --test-reporter=spec test/release-identity.test.mjs", "test:release must run the credential-free release-identity cases");
expect(pkg.scripts?.["audit:high"] === "node scripts/audit-dependencies.mjs", "audit:high must own the explicit live npm advisory boundary");
expect(pkg.scripts?.["test:audit-policy"] === "node --test --test-reporter=spec test/dependency-advisory-policy.test.mjs", "test:audit-policy must run deterministic local advisory classification cases");
expect(pkg.scripts?.test === "npm run build && npm run test:node && npm run test:settings && npm run test:release && npm run test:audit-policy && npm run test:browser", "test must own exactly one production build and run Node, settings, release, audit-policy, and browser suites once");
expect(pkg.scripts?.check === "npm run typecheck && npm test && npm run check:history && npm run check:safety && npm run check:baseline", "check must invoke the self-contained test command once without a redundant direct build");
expect(pkg.scripts?.check?.includes("npm run check:history"), "check must include controlled-history validation");
expect(pkg.scripts?.check?.includes("npm run check:safety"), "check must include public-safety validation");
expect(pkg.scripts?.check?.includes("npm run check:baseline"), "check must include repository-baseline validation");
expect(!pkg.scripts?.check?.includes("verify:github-settings"), "check must remain credential-free and must not invoke the live GitHub settings verifier");
expect(!pkg.scripts?.check?.includes("audit:high"), "check must remain offline and must not invoke the live dependency-advisory gate");
expect(githubSettingsPolicy.includes("compareGithubRepositorySettings"), "repository-settings policy must expose the pure comparison boundary");
expect(!githubSettingsPolicy.includes("fetch("), "repository-settings policy comparison must not call the network");
expect(githubSettingsVerifier.includes('from "./github-settings-policy.mjs"'), "live settings verifier must reuse the pure comparison boundary");
expect(githubSettingsVerifier.includes("fetchLiveGithubSettings"), "live settings verifier must use the read-only provider boundary");
expect(githubSettingsProvider.includes("GH_ADMIN_TOKEN") && githubSettingsProvider.includes("GH_TOKEN"), "settings provider must use the shared admin credential path");
expect(!githubSettingsProvider.includes("GITHUB_TOKEN"), "settings provider must not introduce another token variable");
expect(githubSettingsApply.includes("applyGithubSettings"), "settings apply must use the bounded provider mutation path");
expect(githubSettingsTest.includes("compareGithubRepositorySettings"), "settings tests must exercise the shared pure comparison boundary");

for (const [name, text] of [
  ["tsconfig.json", tsconfigText],
  ["tsconfig.viewer.json", viewerTsconfigText],
  ["tsconfig.browser-test.json", browserTsconfigText],
]) {
  expect(JSON.parse(text).compilerOptions?.strict === true, `${name} must enable strict TypeScript`);
}

expect(!(await exists("CHANGELOG.md")), "CHANGELOG.md must not become a parallel release history");
expect(!(await exists("docs/releases")), "docs/releases/** must not return");
expect(!(await exists("docs/RECONSTRUCTION.md")), "docs/RECONSTRUCTION.md must not return");
expect(!(await exists("docs/history")), "docs/history/** must not return");

expect(ci.includes("pull_request:"), "CI must run for pull requests");
expect(ci.includes("branches: [main]"), "CI must run for pushes to main");
expect(ci.includes("fetch-depth: 0"), "CI must fetch full Git history for committed-range validation");
expect(ci.includes("node-version-file: .node-version"), "CI must use .node-version");
for (const command of ["npm ci", "npm run check"]) {
  expect(ci.includes(`- run: ${command}`), `CI must run ${command}`);
}
expect(ci.includes("name: Audit high-severity dependencies"), "CI must name the live dependency-advisory gate");
expect(ci.includes("run: npm run audit:high"), "CI must run the explicit high-severity dependency audit");
expect(ci.indexOf("run: npm run audit:high") < ci.indexOf("- run: npm run check"), "CI must run the live dependency audit before credential-free check");
expect(ci.includes("name: Check committed whitespace"), "CI must name the committed whitespace gate");
expect(ci.includes("github.event.pull_request.base.sha"), "PR whitespace validation must use the authoritative pull-request base SHA");
expect(ci.includes("github.event.pull_request.head.sha"), "PR whitespace validation must use the authoritative pull-request head SHA");
expect(ci.includes('git diff --check "$PR_BASE_SHA...$PR_HEAD_SHA"'), "PR whitespace validation must check the committed merge-base range");
expect(ci.includes("github.event.before"), "push whitespace validation must use the pushed before SHA");
expect(ci.includes("github.sha"), "push whitespace validation must use the pushed head SHA");
expect(ci.includes('git diff --check "$PUSH_BEFORE_SHA" "$PUSH_HEAD_SHA"'), "push whitespace validation must check the pushed committed range");
expect(!ci.includes("- run: git diff --check"), "CI must not rely on a bare working-tree-only whitespace command");
expect(!ci.includes("- run: npm run build"), "CI must not repeat the production build already owned by check -> test");
expect(ci.includes("Validate pull-request title"), "CI must validate controlled pull-request titles");

expect(release.includes("tags: ['v*']"), "release workflow must be tag-driven");
expect(release.includes('git fetch --force --no-tags origin "$tag_ref:$tag_ref"'), "release workflow must fetch the exact pushed tag ref before local identity validation");
expect(release.includes('node scripts/validate-release-identity.mjs "$GITHUB_REF_NAME"'), "release workflow must delegate tag identity validation to the shared local authority");
expect(!release.includes("git cat-file -t"), "release workflow must not duplicate annotated-tag validation outside the shared authority");
expect(!release.includes("package_version="), "release workflow must not duplicate package-version validation outside the shared authority");
expect(releaseIdentityValidator.includes("validateReleaseIdentity"), "release identity validator must expose the shared validation boundary");
expect(releaseIdentityValidator.includes("isSemanticReleaseTag"), "release identity validator must own semantic tag syntax");
expect(!releaseIdentityValidator.includes("fetch("), "release identity validator must not call the network");
expect(!releaseIdentityValidator.includes("gh release"), "release identity validator must not publish through GitHub");
expect(releaseIdentityTest.includes("validateReleaseIdentity"), "release identity tests must exercise the shared validation boundary");
expect(releaseIdentityTest.includes(".github/workflows/release.yml"), "release identity tests must guard workflow delegation to the shared validation boundary");
expect(release.includes("npm ci"), "release workflow must install exact dependencies");
expect(release.includes("npm run check"), "release workflow must run the repository gate");
expect(release.includes("--generate-notes"), "GitHub Releases must use GitHub-generated notes");
expect(release.includes("--verify-tag"), "GitHub Release publication must verify the pushed tag");
expect(!/\bwrangler\b|cloudflare\/wrangler-action|\bdeploy(?:ment)?\b/i.test(release), "release workflow must not contain a hosted deployment stage");

expect(viteConfig.includes('manifest: "manifest.json"'), "Vite must emit the viewer manifest");
expect(viteConfig.includes('entryFileNames: "assets/viewer-[hash].js"'), "Vite JavaScript must be content hashed");
expect(viteConfig.includes('assetFileNames: "assets/viewer-[hash][extname]"'), "Vite assets must be content hashed");
expect(exportAssets.includes("VIEWER_MANIFEST"), "export assets must resolve through the Vite manifest");
expect(exportAssets.includes("loadViewerAssets"), "export assets must expose manifest-driven viewer loading");
expect(exportValidation.includes("Portable export viewer assets differ from the generated Vite manifest"), "export validation must compare shipped viewer assets with the Vite manifest");

const builtManifest = JSON.parse(await read("dist/viewer/manifest.json"));
const builtEntries = Object.values(builtManifest);
const builtEntry = builtManifest["src/viewer/entry.ts"] ?? builtEntries.find((entry) => entry?.isEntry === true);
expect(Boolean(builtEntry), "built Vite manifest must contain the viewer entry");
if (builtEntry) {
  expect(/^assets\/viewer-[A-Za-z0-9_-]{6,}\.js$/.test(builtEntry.file ?? ""), "built viewer JavaScript must have a content-hashed filename");
  const styles = [...new Set([
    ...(builtEntry.css ?? []),
    ...builtEntries.map((entry) => entry?.file).filter((file) => typeof file === "string" && file.endsWith(".css")),
  ])];
  expect(styles.length > 0, "built viewer manifest must contain at least one stylesheet");
  for (const style of styles) {
    expect(/^assets\/viewer-[A-Za-z0-9_-]{6,}\.css$/.test(style), `built stylesheet must have a content-hashed filename: ${style}`);
  }
}

expect(presentation.includes("renderToStaticMarkup"), "portable documents must render through React static markup");
expect(presentation.includes("createElement"), "portable documents must be typed React component output");
expect(exportSource.includes("export { validateExport };"), "validateExport must remain exported through src/export.ts");
expect(!presentation.includes("dangerouslySetInnerHTML"), "portable React presentation must not use raw HTML insertion");
expect(!/\bstyle\s*:/.test(presentation), "portable React presentation must not emit style attributes");

const sourceFiles = (await collect("src")).filter((file) => /\.(?:ts|tsx)$/.test(file));
for (const file of sourceFiles) {
  const text = await read(file);
  expect(!/\bcreateRoot\b|\bhydrateRoot\b|\bhydrat(?:e|ion)\b/i.test(text), `client React mounting/hydration is forbidden in ${file}`);
}
expect(!Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).some((name) => /react-router|@tanstack\/router/i.test(name)), "client-side router dependencies are forbidden");

const csp = /export const PORTABLE_CSP = "([^"]+)"/.exec(security)?.[1] ?? "";
expect(csp.length > 0, "portable CSP must be statically declared");
expect(!csp.includes("unsafe-inline"), "portable CSP must not allow unsafe-inline");
expect(csp.includes("connect-src 'none'"), "portable CSP must block runtime connections");
for (const marker of [
  "Portable HTML contains an executable inline script",
  "Portable HTML contains an inline style element",
  "Portable HTML contains an inline style attribute",
  "Portable HTML contains an inline event handler",
  "Portable HTML contains a javascript: URL",
]) {
  expect(security.includes(marker), `portable HTML security must enforce: ${marker}`);
}
expect(exportValidation.includes("assertPortableHtmlSecurity(text, relative)"), "portable export validation must enforce HTML security");
expect(portableTest.includes("no shipped document or script contains a remote URL"), "portable acceptance must retain remote-URL rejection");
expect(portableTest.includes("driving the whole reader touches no network entry point"), "portable acceptance must retain runtime no-network coverage");

await proveCommittedWhitespaceRange();

const offlineMarker = "WG-ARCH-001 §27 offline-reader exception";
expect(architecture.includes(offlineMarker), "ARCHITECTURE.md must declare the permanent §27 offline-reader exception");
expect(architecture.includes("There is no `createRoot`, `hydrateRoot`, hydration"), "architecture must retain the React static-only boundary");
expect(/not a\s+hosted application/i.test(architecture), "architecture must retain the no-hosted-application boundary");
expect(!(await exists("wrangler.jsonc")) && !(await exists("wrangler.json")) && !(await exists("wrangler.toml")), "YarReader's offline-reader exception requires no Wrangler configuration");
expect(!(await exists("src/worker")) && !(await exists("src/worker.ts")), "YarReader's offline-reader exception requires no Worker implementation");
const workflowFiles = await readdir(path.join(root, ".github", "workflows"));
expect(!workflowFiles.some((file) => /^deploy(?:\.|-)/i.test(file)), "YarReader's offline-reader exception requires no deployment workflow");
expect(!Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).some((name) => /wrangler|@cloudflare\//i.test(name)), "YarReader's offline-reader exception requires no Cloudflare runtime dependency");
expect(!Object.entries(pkg.scripts ?? {}).some(([name, command]) => /deploy/i.test(name) || /\bwrangler\b|cloudflare/i.test(command)), "YarReader's offline-reader exception requires no deploy/Wrangler command");

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Validated WG-ARCH-001 §27 repository baseline with YarReader offline-reader exception (no Wrangler, Workers, or hosted deployment).\n");
}

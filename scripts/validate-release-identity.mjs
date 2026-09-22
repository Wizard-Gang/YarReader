import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SEMANTIC_RELEASE_TAG = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export function isSemanticReleaseTag(tag) {
  return typeof tag === "string" && SEMANTIC_RELEASE_TAG.test(tag);
}

async function git(repoRoot, ...args) {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  return stdout.trim();
}

export async function validateReleaseIdentity({
  tag,
  repoRoot = process.cwd(),
  packagePath = "package.json",
} = {}) {
  if (!isSemanticReleaseTag(tag)) {
    throw new Error(`Release tag must be semantic and start with v: ${tag ?? ""}`);
  }

  const tagRef = `refs/tags/${tag}`;
  let objectType;
  try {
    objectType = await git(repoRoot, "cat-file", "-t", tagRef);
  } catch {
    throw new Error(`Release tag must exist locally and be annotated: ${tag}`);
  }
  if (objectType !== "tag") {
    throw new Error(`Release tag must be annotated: ${tag}`);
  }

  const taggedCommit = await git(repoRoot, "rev-parse", `${tagRef}^{commit}`);
  const checkedOutCommit = await git(repoRoot, "rev-parse", "HEAD");
  if (checkedOutCommit !== taggedCommit) {
    throw new Error(`Checkout is not the commit identified by ${tag}`);
  }

  const packageFile = path.resolve(repoRoot, packagePath);
  const pkg = JSON.parse(await readFile(packageFile, "utf8"));
  if (tag !== `v${pkg.version}`) {
    throw new Error(`Tag ${tag} does not match package.json version ${pkg.version}`);
  }

  return { tag, taggedCommit, checkedOutCommit, packageVersion: pkg.version };
}

const invokedAsCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  try {
    const result = await validateReleaseIdentity({ tag: process.argv[2] });
    process.stdout.write(`Release identity valid for ${result.tag} at ${result.checkedOutCommit}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

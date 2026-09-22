import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { isSemanticReleaseTag, validateReleaseIdentity } from "../scripts/validate-release-identity.mjs";

const execFileAsync = promisify(execFile);

async function git(repoRoot, ...args) {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  return stdout.trim();
}

async function withRepository(packageVersion, callback) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "yarreader-release-identity-"));
  try {
    await git(repoRoot, "init", "--quiet");
    await git(repoRoot, "config", "user.name", "YarReader release test");
    await git(repoRoot, "config", "user.email", "release-test@example.invalid");
    await writeFile(path.join(repoRoot, "package.json"), `${JSON.stringify({ version: packageVersion }, null, 2)}\n`, "utf8");
    await git(repoRoot, "add", "package.json");
    await git(repoRoot, "commit", "--quiet", "-m", "fixture");
    await callback(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function annotate(repoRoot, tag) {
  await git(repoRoot, "tag", "-a", tag, "-m", tag);
}

test("valid semantic release-tag syntax passes", () => {
  for (const tag of ["v0.0.0", "v1.2.3", "v2.0.0-rc.1", "v3.4.5+build.7"]) {
    assert.equal(isSemanticReleaseTag(tag), true, tag);
  }
});

test("malformed or non-semantic release-tag syntax fails", () => {
  for (const tag of ["1.2.3", "v1.2", "v01.2.3", "v1.02.3", "v1.2.03", "release-v1.2.3"]) {
    assert.equal(isSemanticReleaseTag(tag), false, tag);
  }
});

test("annotated tags are accepted while lightweight tags are rejected", async () => {
  await withRepository("1.1.0", async (repoRoot) => {
    await annotate(repoRoot, "v1.1.0");
    await validateReleaseIdentity({ tag: "v1.1.0", repoRoot });

    await git(repoRoot, "tag", "v1.1.1");
    await assert.rejects(
      validateReleaseIdentity({ tag: "v1.1.1", repoRoot }),
      /Release tag must be annotated: v1\.1\.1/,
    );
  });
});

test("tag must resolve to the exact checked-out commit", async () => {
  await withRepository("1.1.0", async (repoRoot) => {
    await annotate(repoRoot, "v1.1.0");
    await writeFile(path.join(repoRoot, "next.txt"), "next\n", "utf8");
    await git(repoRoot, "add", "next.txt");
    await git(repoRoot, "commit", "--quiet", "-m", "next");

    await assert.rejects(
      validateReleaseIdentity({ tag: "v1.1.0", repoRoot }),
      /Checkout is not the commit identified by v1\.1\.0/,
    );
  });
});

test("tag version must match package.json", async () => {
  await withRepository("1.2.0", async (repoRoot) => {
    await annotate(repoRoot, "v1.1.0");
    await assert.rejects(
      validateReleaseIdentity({ tag: "v1.1.0", repoRoot }),
      /Tag v1\.1\.0 does not match package\.json version 1\.2\.0/,
    );
  });
});

test("valid exact annotated tag and package version pass", async () => {
  await withRepository("1.1.0", async (repoRoot) => {
    await annotate(repoRoot, "v1.1.0");
    const expectedCommit = await git(repoRoot, "rev-parse", "HEAD");
    const result = await validateReleaseIdentity({ tag: "v1.1.0", repoRoot });
    assert.equal(result.taggedCommit, expectedCommit);
    assert.equal(result.checkedOutCommit, expectedCommit);
    assert.equal(result.packageVersion, "1.1.0");
  });
});

test("Release workflow delegates local identity validation to the tested authority", async () => {
  const workflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.match(workflow, /node scripts\/validate-release-identity\.mjs "\$GITHUB_REF_NAME"/);
  assert.match(workflow, /gh release create "\$GITHUB_REF_NAME" --title "\$GITHUB_REF_NAME" --generate-notes --verify-tag/);
  assert.doesNotMatch(workflow, /git cat-file -t/);
  assert.doesNotMatch(workflow, /package_version=/);
});

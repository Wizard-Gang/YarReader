import { readFile } from "node:fs/promises";

const expected = JSON.parse(await readFile(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"));
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function api(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} for ${path}: ${text}`);
  }
  return response.json();
}

function requireEqual(actual, wanted, label, failures) {
  if (actual !== wanted) failures.push(`${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
}

function includesAll(actual, wanted) {
  return wanted.every((value) => actual.includes(value));
}

const failures = [];
const repositoryPath = `/repos/${expected.repository}`;
const repository = await api(repositoryPath);

requireEqual(repository.default_branch, expected.defaultBranch, "default branch", failures);
requireEqual(repository.allow_merge_commit, expected.mergeMethods.merge, "merge commits", failures);
requireEqual(repository.allow_squash_merge, expected.mergeMethods.squash, "squash merges", failures);
requireEqual(repository.allow_rebase_merge, expected.mergeMethods.rebase, "rebase merges", failures);
requireEqual(repository.delete_branch_on_merge, expected.deleteBranchOnMerge, "delete branch on merge", failures);

const summaries = await api(`${repositoryPath}/rulesets?includes_parents=false`);
const details = [];
for (const summary of summaries) {
  details.push(await api(`${repositoryPath}/rulesets/${summary.id}`));
}

for (const [key, ruleExpectation] of Object.entries(expected.rulesets)) {
  const candidates = details.filter((ruleset) => {
    const include = ruleset.conditions?.ref_name?.include ?? [];
    return ruleset.target === ruleExpectation.target && includesAll(include, ruleExpectation.include);
  });
  if (candidates.length !== 1) {
    failures.push(`${key} ruleset: expected exactly one matching ruleset, found ${candidates.length}`);
    continue;
  }

  const ruleset = candidates[0];
  requireEqual(ruleset.enforcement, ruleExpectation.enforcement, `${key} enforcement`, failures);
  const rules = ruleset.rules ?? [];
  const types = rules.map((rule) => rule.type);
  if (!includesAll(types, ruleExpectation.requiredRules)) {
    failures.push(`${key} rules: expected ${ruleExpectation.requiredRules.join(", ")}; got ${types.join(", ")}`);
  }

  if (ruleExpectation.requiredStatusChecks) {
    const checkRule = rules.find((rule) => rule.type === "required_status_checks");
    const contexts = (checkRule?.parameters?.required_status_checks ?? []).map((check) => check.context);
    if (!includesAll(contexts, ruleExpectation.requiredStatusChecks)) {
      failures.push(`${key} required checks: expected ${ruleExpectation.requiredStatusChecks.join(", ")}; got ${contexts.join(", ")}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`GitHub repository settings match ${expected.repository}.\n`);
}

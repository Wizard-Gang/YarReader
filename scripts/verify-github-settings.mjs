import { readFile } from "node:fs/promises";
import { compareGithubRepositorySettings } from "./github-settings-policy.mjs";

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

const repositoryPath = `/repos/${expected.repository}`;
const repository = await api(repositoryPath);
const summaries = await api(`${repositoryPath}/rulesets?includes_parents=false`);
const rulesets = [];
for (const summary of summaries) {
  rulesets.push(await api(`${repositoryPath}/rulesets/${summary.id}`));
}

const failures = compareGithubRepositorySettings(expected, repository, rulesets);
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`GitHub repository settings match ${expected.repository}.\n`);
}

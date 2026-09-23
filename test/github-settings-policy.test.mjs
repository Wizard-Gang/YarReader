import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compareGithubRepositorySettings,
  configuredMergeMethods,
  rulesetPayload,
} from "../scripts/github-settings-policy.mjs";
import {
  applyGithubSettings,
  fetchLiveGithubSettings,
  githubApi,
} from "../scripts/github-settings-provider.mjs";

const expected = JSON.parse(await readFile(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"));

function matchingActual() {
  return {
    repository: {
      full_name: expected.repository,
      default_branch: expected.defaultBranch,
      allow_merge_commit: expected.mergeMethods.mergeCommit,
      allow_squash_merge: expected.mergeMethods.squash,
      allow_rebase_merge: expected.mergeMethods.rebase,
      delete_branch_on_merge: expected.deleteBranchOnMerge,
    },
    rulesets: Object.values(expected.rulesets).map((policy, index) => ({ id: index + 1, ...rulesetPayload(expected, policy) })),
  };
}

function failuresFor(mutate) {
  const actual = matchingActual();
  mutate(actual);
  return compareGithubRepositorySettings(expected, actual.repository, actual.rulesets).join("\n");
}

function main(actual) {
  return actual.rulesets.find((ruleset) => ruleset.name === expected.rulesets.main.name);
}

function tag(actual) {
  return actual.rulesets.find((ruleset) => ruleset.name === expected.rulesets.releaseTags.name);
}

function rule(ruleset, type) {
  return ruleset.rules.find((item) => item.type === type);
}

test("committed authority permits squash only and matching settings pass", () => {
  assert.deepEqual(configuredMergeMethods(expected), ["squash"]);
  assert.deepEqual(compareGithubRepositorySettings(expected, ...Object.values(matchingActual())), []);
});

test("repository merge and cleanup drift fails", () => {
  assert.match(failuresFor((actual) => { actual.repository.allow_squash_merge = false; }), /squash merges/);
  assert.match(failuresFor((actual) => { actual.repository.allow_merge_commit = true; }), /merge commits/);
  assert.match(failuresFor((actual) => { actual.repository.allow_rebase_merge = true; }), /rebase merges/);
  assert.match(failuresFor((actual) => { actual.repository.delete_branch_on_merge = false; }), /delete branch on merge/);
});

test("main ruleset protects exact main and controlled PR merge policy", () => {
  assert.match(failuresFor((actual) => { actual.rulesets.shift(); }), /main ruleset/);
  assert.match(failuresFor((actual) => { main(actual).enforcement = "evaluate"; }), /main enforcement/);
  assert.match(failuresFor((actual) => { main(actual).conditions.ref_name.include = ["refs/heads/other"]; }), /main include/);
  assert.match(failuresFor((actual) => { main(actual).bypass_actors = [{ actor_id: 1 }]; }), /main bypass actors/);
  assert.match(failuresFor((actual) => { main(actual).rules = main(actual).rules.filter((item) => item.type !== "deletion"); }), /main rules/);
  assert.match(failuresFor((actual) => { main(actual).rules = main(actual).rules.filter((item) => item.type !== "non_fast_forward"); }), /main rules/);
  assert.match(failuresFor((actual) => { main(actual).rules = main(actual).rules.filter((item) => item.type !== "pull_request"); }), /main rules/);
  assert.match(failuresFor((actual) => { rule(main(actual), "pull_request").parameters.allowed_merge_methods = ["merge"]; }), /main merge methods/);
});

test("required exact-head checks and current-main enforcement cannot weaken", () => {
  assert.match(failuresFor((actual) => { rule(main(actual), "required_status_checks").parameters.required_status_checks = [{ context: "verify" }]; }), /main required checks/);
  assert.match(failuresFor((actual) => { rule(main(actual), "required_status_checks").parameters.strict_required_status_checks_policy = false; }), /main current-with-main/);
});

test("release tags remain immutable with zero bypass actors", () => {
  assert.match(failuresFor((actual) => { actual.rulesets.pop(); }), /releaseTags ruleset/);
  assert.match(failuresFor((actual) => { tag(actual).bypass_actors = [{ actor_id: 1 }]; }), /releaseTags bypass actors/);
  assert.match(failuresFor((actual) => { tag(actual).rules = [{ type: "deletion" }]; }), /releaseTags rules/);
  assert.match(failuresFor((actual) => { tag(actual).rules = [{ type: "update" }]; }), /releaseTags rules/);
});

function fakeProvider() {
  const state = matchingActual();
  const calls = [];
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method ?? "GET";
    calls.push({ path, method });
    if (path.endsWith("/rulesets") && method === "GET") return response(state.rulesets.map(({ id, name }) => ({ id, name })));
    const detail = path.match(/\/rulesets\/(\d+)$/);
    if (detail && method === "GET") return response(state.rulesets.find(({ id }) => id === Number(detail[1])));
    if (path.endsWith("/rulesets") && method === "POST") {
      const value = { id: state.rulesets.length + 1, ...JSON.parse(options.body) };
      state.rulesets.push(value);
      return response(value, 201);
    }
    if (detail && method === "PUT") {
      const id = Number(detail[1]);
      const value = { id, ...JSON.parse(options.body) };
      state.rulesets = state.rulesets.map((item) => item.id === id ? value : item);
      return response(value);
    }
    if (path.endsWith(expected.repository) && method === "PATCH") {
      Object.assign(state.repository, JSON.parse(options.body));
      return response(state.repository);
    }
    if (path.endsWith(expected.repository) && method === "GET") return response(state.repository);
    return response({ message: "unexpected request" }, 500);
  };
  return { state, calls, fetchImpl };
}

test("verification is read-only and apply independently re-reads", async () => {
  const provider = fakeProvider();
  await fetchLiveGithubSettings(expected, { token: "fixture", fetchImpl: provider.fetchImpl });
  assert.ok(provider.calls.every(({ method }) => method === "GET"));
  provider.calls.length = 0;
  await applyGithubSettings(expected, { token: "fixture", fetchImpl: provider.fetchImpl });
  const lastWrite = provider.calls.findLastIndex(({ method }) => method !== "GET");
  assert.ok(lastWrite >= 0);
  assert.ok(provider.calls.slice(lastWrite + 1).every(({ method }) => method === "GET"));
  assert.ok(provider.calls.slice(lastWrite + 1).length >= 3);
});

test("missing token and read/write permission failures are distinct", async () => {
  await assert.rejects(githubApi("/repos/Wizard-Gang/YarReader"), { code: "GITHUB_AUTH_REQUIRED" });
  const denied = async () => new Response(JSON.stringify({ message: "denied" }), { status: 403 });
  await assert.rejects(githubApi("/repos/Wizard-Gang/YarReader", { token: "fixture", fetchImpl: denied }),
    { code: "GITHUB_ADMIN_READ_DENIED" });
  await assert.rejects(githubApi("/repos/Wizard-Gang/YarReader", { token: "fixture", method: "PATCH", fetchImpl: denied }),
    { code: "GITHUB_ADMIN_WRITE_DENIED" });
});

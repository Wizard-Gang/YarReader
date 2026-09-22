import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compareGithubRepositorySettings } from "../scripts/github-settings-policy.mjs";

const expected = JSON.parse(await readFile(new URL("../config/github-repository-settings.json", import.meta.url), "utf8"));

function matchingActual() {
  return {
    repository: {
      default_branch: "main",
      allow_merge_commit: true,
      allow_squash_merge: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
    },
    rulesets: [
      {
        target: "branch",
        enforcement: "active",
        conditions: { ref_name: { include: ["~DEFAULT_BRANCH"] } },
        rules: [
          { type: "deletion" },
          { type: "non_fast_forward" },
          { type: "pull_request" },
          {
            type: "required_status_checks",
            parameters: {
              required_status_checks: [
                { context: "verify" },
                { context: "change-id" },
              ],
            },
          },
        ],
      },
      {
        target: "tag",
        enforcement: "active",
        conditions: { ref_name: { include: ["refs/tags/v*"] } },
        rules: [
          { type: "deletion" },
          { type: "update" },
        ],
      },
    ],
  };
}

function compare(actual) {
  return compareGithubRepositorySettings(expected, actual.repository, actual.rulesets);
}

test("matching committed repository settings pass", () => {
  assert.deepEqual(compare(matchingActual()), []);
});

test("missing required main status checks fail", () => {
  const actual = matchingActual();
  const checkRule = actual.rulesets[0].rules.find((rule) => rule.type === "required_status_checks");
  checkRule.parameters.required_status_checks = [{ context: "verify" }];

  assert.match(compare(actual).join("\n"), /main required checks: expected verify, change-id; got verify/);
});

test("changed main ruleset enforcement fails", () => {
  const actual = matchingActual();
  actual.rulesets[0].enforcement = "evaluate";

  assert.match(compare(actual).join("\n"), /main enforcement: expected "active", got "evaluate"/);
});

test("missing release-tag update protection fails", () => {
  const actual = matchingActual();
  actual.rulesets[1].rules = [{ type: "deletion" }];

  assert.match(compare(actual).join("\n"), /releaseTags rules: expected deletion, update; got deletion/);
});

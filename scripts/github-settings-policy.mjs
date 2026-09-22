function requireEqual(actual, wanted, label, failures) {
  if (actual !== wanted) {
    failures.push(`${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
  }
}

function includesAll(actual, wanted) {
  return wanted.every((value) => actual.includes(value));
}

export function compareGithubRepositorySettings(expected, repository, rulesets) {
  const failures = [];

  requireEqual(repository.default_branch, expected.defaultBranch, "default branch", failures);
  requireEqual(repository.allow_merge_commit, expected.mergeMethods.merge, "merge commits", failures);
  requireEqual(repository.allow_squash_merge, expected.mergeMethods.squash, "squash merges", failures);
  requireEqual(repository.allow_rebase_merge, expected.mergeMethods.rebase, "rebase merges", failures);
  requireEqual(repository.delete_branch_on_merge, expected.deleteBranchOnMerge, "delete branch on merge", failures);

  for (const [key, ruleExpectation] of Object.entries(expected.rulesets)) {
    const candidates = rulesets.filter((ruleset) => {
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

  return failures;
}

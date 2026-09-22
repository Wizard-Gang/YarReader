import assert from "node:assert/strict";
import test from "node:test";
import { classifyDependencyAudit } from "../scripts/dependency-advisory-policy.mjs";

test("classifies a completed audit with no high-severity findings as clean", () => {
  assert.deepEqual(
    classifyDependencyAudit({
      status: 0,
      stdout: JSON.stringify({ metadata: { vulnerabilities: { high: 0, critical: 0 } } }),
    }),
    { kind: "clean", high: 0, critical: 0 },
  );
});

test("classifies high or critical findings as advisories", () => {
  assert.deepEqual(
    classifyDependencyAudit({
      status: 1,
      stdout: JSON.stringify({ metadata: { vulnerabilities: { high: 2, critical: 1 } } }),
    }),
    { kind: "advisory", high: 2, critical: 1 },
  );
});

test("classifies registry unavailability as unavailable, never clean", () => {
  const outcome = classifyDependencyAudit({
    status: 1,
    stdout: JSON.stringify({ error: { code: "EAI_AGAIN", summary: "request to the npm advisory service failed" } }),
    stderr: "network unavailable",
  });
  assert.equal(outcome.kind, "unavailable");
  assert.match(outcome.detail, /advisory service failed/i);
});

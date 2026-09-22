import { spawnSync } from "node:child_process";
import { classifyDependencyAudit } from "./dependency-advisory-policy.mjs";

const auditArgs = ["audit", "--audit-level=high", "--json"];
const npmExecPath = process.env.npm_execpath;
const result = npmExecPath
  ? spawnSync(process.execPath, [npmExecPath, ...auditArgs], { encoding: "utf8" })
  : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", auditArgs, { encoding: "utf8" });

if (result.error) {
  process.stderr.write(`Dependency advisory audit unavailable: ${result.error.message}\n`);
  process.exitCode = 2;
} else {
  const outcome = classifyDependencyAudit({
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });

  if (outcome.kind === "clean") {
    process.stdout.write("Dependency advisory audit completed: no high-severity advisories.\n");
  } else if (outcome.kind === "advisory") {
    process.stderr.write(`Dependency advisory audit failed: high=${outcome.high}, critical=${outcome.critical}.\n`);
    if (result.stdout?.trim()) process.stderr.write(`${result.stdout.trim()}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`Dependency advisory audit unavailable: ${outcome.detail}\n`);
    process.exitCode = 2;
  }
}

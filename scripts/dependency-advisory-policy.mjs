const VULNERABILITY_LEVELS = ["high", "critical"];

function parseAuditReport(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function countLevel(report, level) {
  const value = Number(report?.metadata?.vulnerabilities?.[level]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function classifyDependencyAudit({ status, stdout = "", stderr = "" }) {
  const report = parseAuditReport(stdout);
  const hasMetadata = Boolean(report?.metadata?.vulnerabilities && typeof report.metadata.vulnerabilities === "object");
  const counts = Object.fromEntries(VULNERABILITY_LEVELS.map((level) => [level, countLevel(report, level)]));

  if (hasMetadata && (counts.high > 0 || counts.critical > 0)) {
    return { kind: "advisory", ...counts };
  }

  if (status === 0 && hasMetadata) {
    return { kind: "clean", ...counts };
  }

  const detail = [
    report?.error?.summary,
    report?.error?.detail,
    stderr.trim(),
    stdout.trim(),
    `npm audit exited with status ${String(status)} without a usable advisory report.`,
  ].find((value) => typeof value === "string" && value.length > 0);

  return { kind: "unavailable", detail };
}

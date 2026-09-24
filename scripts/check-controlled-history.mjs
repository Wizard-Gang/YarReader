import { execFileSync } from "node:child_process";

/*
 * Enumerate only controlled commits, parents before children.
 *
 * `main` is merged with merge commits, so history now contains merge commits
 * that are not themselves controlled changes: the pull-request merge on `main`
 * and the synthetic merge a pull-request CI checkout creates. `--no-merges`
 * drops both, and `--topo-order` keeps the remaining controlled commits in
 * their real sequence rather than in commit-timestamp order.
 */
const raw = execFileSync("git", ["log", "--reverse", "--topo-order", "--no-merges", "--format=%H%x1f%s%x1f%b%x1e"], { encoding: "utf8" });
const records = raw.split("\x1e").map((record) => record.trim()).filter(Boolean);

const currentTypes = new Set([
  "INIT",
  "FEAT",
  "FIX",
  "SEC",
  "API",
  "A11Y",
  "I18N",
  "AI",
  "DB",
  "OPS",
  "TEST",
  "DOCS",
  "REFACTOR",
  "PERF",
  "BUILD",
  "REVERT",
  "CHORE",
]);
// Exact exceptions for immutable published history stay beside this validator.
const legacyTypes = new Map([["YR-035", "CI"]]);
const titlePattern = /^\[YR-(\d{3,})\] \[([A-Z0-9]+)\] .+/;
const requiredSections = ["Change", "Reason", "Impact", "Risk", "Controls", "Validation", "Evidence", "Source", "Release"];
const seen = new Set();
const earlyMaintenance = new Set();
let expectedNumber = 1;
const failures = [];

records.forEach((record) => {
  const [sha = "", subject = "", body = ""] = record.split("\x1f");
  const match = titlePattern.exec(subject);
  if (!match) {
    failures.push(`${sha.slice(0, 12)} has an invalid controlled title: ${subject}`);
    return;
  }

  const id = `YR-${match[1]}`;
  const type = match[2];
  while (earlyMaintenance.has(expectedNumber)) expectedNumber += 1;
  const maintenance = /^Portfolio-Plan-Maintenance: true$/m.test(body);
  const number = Number(match[1]);
  const expected = `YR-${String(expectedNumber).padStart(3, "0")}`;
  const legacyType = legacyTypes.get(id);

  if (!currentTypes.has(type) && legacyType !== type) {
    failures.push(`${id} uses unsupported type ${type}`);
  }
  if (type === "CI" && legacyType !== "CI") {
    failures.push(`${id} uses legacy type CI; use OPS or BUILD for new automation changes`);
  }
  if (maintenance && number > expectedNumber) earlyMaintenance.add(number);
  else if (id !== expected) failures.push(`${sha.slice(0, 12)} uses ${id}; expected ${expected}`);
  else expectedNumber += 1;
  if (seen.has(id)) failures.push(`${id} is duplicated`);
  seen.add(id);

  for (const section of requiredSections) {
    if (!new RegExp(`(?:^|\\n)${section}:`, "m").test(body)) failures.push(`${id} is missing ${section}:`);
  }
  if (!/(?:^|\n)Risk:\s*(?:\n\s*)?(?:Low|Medium|High)\b/m.test(body)) failures.push(`${id} has no Low, Medium, or High risk`);
  if (!/(?:^|\n)Release:\s*(?:\n\s*)?v\d+\.\d+\.\d+\b/m.test(body)) failures.push(`${id} has no semantic release`);
});

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${records.length} sequential controlled changes.\n`);
}

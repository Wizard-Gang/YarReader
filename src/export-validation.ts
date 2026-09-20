import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadViewerAssets } from "./export-assets.js";
import { listTree, safeJoin, sha256File } from "./fs.js";
import { assertPortableHtmlSecurity } from "./export-security.js";

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generation: z.number().int().positive(),
  units: z.array(z.object({ id: z.string(), pageCount: z.number().int().positive() }).strict()),
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/))
}).strict();
export type Manifest = z.infer<typeof ManifestSchema>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function runBounded<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await task(items[index]!, index);
    }
  }));
}

export async function validateExport(root: string): Promise<{ files: number; units: number; pages: number; manifestSha256: string }> {
  const rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error(`Export is not a directory: ${root}`);
  const manifestPath = path.join(root, "manifest.json");
  const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);
  const actual = (await listTree(root)).filter((relative) => relative !== "manifest.json").sort();
  const expected = Object.keys(manifest.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Export file membership differs from its manifest");

  const viewer = await loadViewerAssets();
  const expectedViewer = [...viewer.files].sort();
  const actualViewer = expected
    .filter((relative) => relative.startsWith("assets/") && relative !== "assets/favicon.svg")
    .sort();
  if (JSON.stringify(actualViewer) !== JSON.stringify(expectedViewer)) {
    throw new Error("Portable export viewer assets differ from the generated Vite manifest");
  }

  const manifestFiles = Object.entries(manifest.files);
  await runBounded(manifestFiles, 16, async ([relative, expectedHash]) => {
    const file = safeJoin(root, ...relative.split("/"));
    if (await sha256File(file) !== expectedHash) throw new Error(`Export hash mismatch: ${relative}`);
    if (/\.(?:html|js|css|json)$/i.test(relative)) {
      const text = await readFile(file, "utf8");
      if (relative.endsWith(".html")) assertPortableHtmlSecurity(text, relative);
      if (/file:\/\/\/|\/Users\/|[A-Za-z]:\\\\/.test(text)) throw new Error(`Machine path leaked into export: ${relative}`);
      if (/\bfetch\s*\(|XMLHttpRequest|indexedDB|serviceWorker|\bimport\s*\(/i.test(text)) throw new Error(`Network/runtime API is forbidden in portable export: ${relative}`);
    }
  });

  const rootHtml = await readFile(path.join(root, "index.html"), "utf8");
  if (!/<main\b[^>]*\bdata-library\b/i.test(rootHtml)) throw new Error("Portable root index is missing its static library markup");
  for (const style of viewer.styles) {
    if (!rootHtml.includes(`href="./${escapeHtml(style)}"`)) throw new Error(`Portable root index is missing Vite stylesheet: ${style}`);
  }
  if (!rootHtml.includes(`src="./${escapeHtml(viewer.script)}"`)) throw new Error("Portable root index is missing the Vite viewer script");

  for (const unit of manifest.units) {
    const rootHref = path.posix.join("library", unit.id, "index.html");
    if (!rootHtml.includes(`href="${escapeHtml(rootHref)}"`)) throw new Error(`Portable root index is missing a static unit link: ${unit.id}`);
    const unitIndex = safeJoin(root, "library", ...unit.id.split("/"), "index.html");
    const html = await readFile(unitIndex, "utf8");
    const rootPrefix = "../".repeat(unit.id.split("/").length + 1);
    for (const style of viewer.styles) {
      if (!html.includes(`href="${escapeHtml(rootPrefix + style)}"`)) throw new Error(`Portable unit is missing Vite stylesheet: ${unit.id}:${style}`);
    }
    if (!html.includes(`src="${escapeHtml(rootPrefix + viewer.script)}"`)) throw new Error(`Portable unit is missing the Vite viewer script: ${unit.id}`);
    const pagePrefix = `${path.posix.join("library", unit.id, "pages")}/`;
    const expectedPages = expected
      .filter((relative) => relative.startsWith(pagePrefix) && !relative.slice(pagePrefix.length).includes("/"))
      .map((relative) => relative.slice(pagePrefix.length))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const representedPages = [...html.matchAll(/<img\b[^>]*\bsrc=["']pages\/([^"']+)["']/gi)]
      .map((match) => match[1]!)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    if (expectedPages.length !== unit.pageCount || JSON.stringify(representedPages) !== JSON.stringify(expectedPages)) {
      throw new Error(`Portable unit HTML does not represent every expected page image: ${unit.id}`);
    }
  }

  const pages = manifest.units.reduce((sum, unit) => sum + unit.pageCount, 0);
  if (pages === 0 && manifest.units.length > 0) throw new Error("Export units contain no pages");
  return { files: expected.length + 1, units: manifest.units.length, pages, manifestSha256: await sha256File(manifestPath) };
}

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fsyncFile } from "./fs.js";

const ViteManifestEntrySchema = z.object({
  file: z.string().min(1),
  css: z.array(z.string().min(1)).optional(),
  assets: z.array(z.string().min(1)).optional(),
  imports: z.array(z.string().min(1)).optional(),
  dynamicImports: z.array(z.string().min(1)).optional(),
  isEntry: z.boolean().optional()
}).passthrough();
const ViteManifestSchema = z.record(z.string(), ViteManifestEntrySchema);
const VIEWER_ENTRY = "src/viewer/entry.ts";
const VIEWER_ROOT = fileURLToPath(new URL("../viewer/", import.meta.url));
const VIEWER_MANIFEST = path.join(VIEWER_ROOT, "manifest.json");

export interface ViewerAssets {
  script: string;
  styles: readonly string[];
  files: readonly string[];
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Library"><rect width="64" height="64" rx="12" fill="#17191f"/><rect x="12" y="14" width="12" height="36" rx="2" fill="#6ea8fe"/><rect x="27" y="14" width="10" height="36" rx="2" fill="#9aa1b1"/><rect x="40" y="18" width="12" height="32" rx="2" fill="#e8eaf0"/></svg>\n`;

export async function writeAndSync(file: string, content: string | Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  await fsyncFile(file);
}

function portableViewerPath(relative: string): string {
  const normalized = relative.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) ||
      parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Vite viewer manifest contains an unsafe asset path: ${relative}`);
  }
  return normalized;
}

export async function loadViewerAssets(): Promise<ViewerAssets> {
  const manifest = ViteManifestSchema.parse(JSON.parse(await readFile(VIEWER_MANIFEST, "utf8")) as unknown);
  const entry = manifest[VIEWER_ENTRY] ?? Object.values(manifest).find((candidate) => candidate.isEntry === true);
  if (!entry) throw new Error(`Vite viewer manifest has no entry for ${VIEWER_ENTRY}`);
  if ((entry.imports?.length ?? 0) > 0 || (entry.dynamicImports?.length ?? 0) > 0) {
    throw new Error("Portable viewer must build as one classic JavaScript bundle with no chunk imports");
  }

  const script = portableViewerPath(entry.file);
  const styles = [...new Set([
    ...(entry.css ?? []),
    ...Object.values(manifest)
      .map((candidate) => candidate.file)
      .filter((file) => file.endsWith(".css"))
  ].map(portableViewerPath))];
  if (!script.endsWith(".js") || styles.length === 0 || styles.some((style) => !style.endsWith(".css"))) {
    throw new Error("Vite viewer manifest must identify one JavaScript entry and at least one stylesheet");
  }
  const files = [...new Set([script, ...styles, ...(entry.assets ?? []).map(portableViewerPath)])];
  for (const relative of files) {
    const info = await stat(path.join(VIEWER_ROOT, ...relative.split("/")));
    if (!info.isFile()) throw new Error(`Vite viewer asset is missing: ${relative}`);
  }
  return { script, styles, files };
}

export async function writeViewerAssets(stage: string, viewer: ViewerAssets): Promise<void> {
  for (const relative of viewer.files) {
    await writeAndSync(
      path.join(stage, ...relative.split("/")),
      await readFile(path.join(VIEWER_ROOT, ...relative.split("/")))
    );
  }
  await writeAndSync(path.join(stage, "assets", "favicon.svg"), FAVICON);
}

import { copyFile, cp, link, lstat, mkdir, readlink, rename, rm, stat, symlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CatalogStore } from "./catalog.js";
import { nowIso, type Catalog, type UnitRecord } from "./domain.js";
import { fsyncDirectory, fsyncFile, listTree, safeJoin, sha256File } from "./fs.js";
import { verifyNormalization } from "./normalization.js";
import { applyCatalogCuration, loadSeriesCuration } from "./series-metadata.js";
import { loadViewerAssets, writeAndSync, writeViewerAssets } from "./export-assets.js";
import { renderLeafHtml, renderRootHtml, unitTitle } from "./export-presentation.js";
import { ManifestSchema, validateExport, type Manifest } from "./export-validation.js";

export { validateExport };

export interface ExportHooks { beforeActivation?: (stage: string) => Promise<void> }

async function runBounded<T>(items: readonly T[], concurrency: number, task: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await task(items[index]!, index);
    }
  }));
}

function selectedRelease(unit: UnitRecord) {
  return unit.releases.find((release) => release.sourceId === unit.selectedRelease.sourceId && release.unitKey === unit.selectedRelease.unitKey);
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function unitMetadata(unit: UnitRecord, catalog: Catalog) {
  const release = selectedRelease(unit)!;
  const source = catalog.sources[release.sourceId];
  const inspectedUnit = source?.inspection.units.find((candidate) => candidate.key === release.unitKey);
  return { ...(source?.inspection.metadata ?? {}), ...(inspectedUnit?.metadata ?? {}) };
}

function catalogPayload(units: UnitRecord[], catalog: Catalog, seriesCovers: ReadonlySet<string>): string {
  const items = units.map((unit) => {
    const release = selectedRelease(unit)!;
    const normalization = release.normalization!;
    const metadata = unitMetadata(unit, catalog);
    const firstPage = path.basename(normalization.pages[0]!.file);
    const firstMatch = /^(\d+)\.([a-z0-9]+)$/i.exec(firstPage);
    if (!firstMatch) throw new Error(`Normalized page is not canonically numbered: ${unit.id}:${firstPage}`);
    const pageDigits = firstMatch[1]!.length;
    const pageExtension = firstMatch[2]!.toLowerCase();
    normalization.pages.forEach((page, index) => {
      const expected = `${pad(index + 1, pageDigits)}.${pageExtension}`;
      if (path.basename(page.file).toLowerCase() !== expected.toLowerCase()) throw new Error(`Normalized page sequence is not canonical: ${unit.id}:${page.file}`);
    });
    const itemPath = `library/${unit.id}/`;
    const sequence = unit.sequence ?? unit.chapter ?? unit.issue ?? unit.volume ?? 0;
    const discoveredAt = catalog.sources[release.sourceId]?.discoveredAt;
    const seriesMetadata = catalog.seriesMetadata[unit.seriesSlug];
    const readingMode = seriesMetadata?.readingMode ?? metadata.readingMode ?? (metadata.direction === "rtl" ? "rtl" : "ltr");
    const genres = [...new Map([
      ...(seriesMetadata?.genres ?? []),
      ...(metadata.genres ?? []),
      ...(metadata.tags ?? [])
    ].map((genre) => [genre.toLocaleLowerCase("en"), genre])).values()].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
    return {
      path: itemPath,
      seriesSlug: unit.seriesSlug,
      series: unit.series,
      title: unitTitle(unit),
      ...(unit.volume !== undefined ? { volume: unit.volume } : {}),
      ...(unit.chapter !== undefined ? { chapter: unit.chapter } : {}),
      ...(unit.issue !== undefined ? { issue: unit.issue } : {}),
      sequence,
      ...(unit.year !== undefined ? { year: unit.year } : {}),
      ...(metadata.authors?.length ? { authors: metadata.authors } : {}),
      ...(metadata.artists?.length ? { artists: metadata.artists } : {}),
      ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
      ...(metadata.tags?.length ? { tags: metadata.tags } : {}),
      ...(genres.length ? { genres } : {}),
      ...(metadata.summary ? { summary: metadata.summary } : {}),
      ...(metadata.language ? { language: metadata.language } : {}),
      readingMode,
      direction: readingMode === "rtl" ? "rtl" : "ltr",
      pageCount: normalization.pageCount,
      pageExtension,
      pageRoot: "pages/",
      pageDigits,
      ...(readingMode === "scroll" ? { pageSizes: normalization.pages.map((page) => [page.width, page.height]) } : {}),
      cover: `${itemPath}pages/${firstPage}`,
      thumbnail: `${itemPath}thumbnail.webp`,
      ...(seriesCovers.has(unit.seriesSlug) ? { seriesCover: `covers/${unit.seriesSlug}.webp` } : {}),
      added: discoveredAt ? Math.floor(Date.parse(discoveredAt) / 1000) : 0,
      sortTitle: `${unit.series.toLocaleLowerCase("en")} ${pad(sequence, 8)}`
    };
  });
  const payload = JSON.stringify({ schemaVersion: 1, generator: "YarReader", itemCount: items.length, items }).replaceAll("<", "\\u003c");
  return `window.COMIC_LIBRARY = ${payload};\nwindow.YAR_LIBRARY = window.COMIC_LIBRARY;\n`;
}

async function publishImmutable(source: string, destination: string): Promise<void> {
  try {
    await link(source, destination);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EXDEV" && code !== "EPERM" && code !== "ENOTSUP" && code !== "EOPNOTSUPP") throw error;
    await copyFile(source, destination);
  }
  await fsyncFile(destination);
}

async function publishSeriesCovers(store: CatalogStore, stage: string, units: readonly UnitRecord[]): Promise<Set<string>> {
  const available = new Set<string>();
  for (const slug of new Set(units.map((unit) => unit.seriesSlug))) {
    const source = safeJoin(store.paths.covers, `${slug}.webp`);
    try {
      const info = await stat(source);
      if (!info.isFile()) continue;
      await mkdir(path.join(stage, "covers"), { recursive: true });
      await publishImmutable(source, path.join(stage, "covers", `${slug}.webp`));
      available.add(slug);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return available;
}

async function unitThumbnail(store: CatalogStore, normalization: NonNullable<ReturnType<typeof selectedRelease>>["normalization"]): Promise<string> {
  if (!normalization?.pages.length) throw new Error("Cannot generate a thumbnail for an empty normalization");
  const firstPage = normalization.pages[0]!;
  const destination = safeJoin(store.paths.thumbnails, `${firstPage.sha256}.webp`);
  try {
    const info = await stat(destination);
    if (info.isFile() && info.size > 0) return destination;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(store.paths.thumbnails, { recursive: true });
  const sourceRoot = safeJoin(store.paths.work, ...normalization.workRelative.split("/"));
  const temporary = path.join(store.paths.thumbnails, `.${firstPage.sha256}.${process.pid}.webp.tmp`);
  await rm(temporary, { force: true });
  try {
    await sharp(safeJoin(sourceRoot, firstPage.file))
      .rotate()
      .resize(320, 480, { fit: "cover", position: "attention" })
      .webp({ quality: 74, effort: 4 })
      .toFile(temporary);
    await fsyncFile(temporary);
    await rename(temporary, destination);
    await fsyncDirectory(store.paths.thumbnails);
    return destination;
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function buildStage(store: CatalogStore, catalog: Catalog, stage: string, generation: number): Promise<Manifest> {
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const units = Object.values(catalog.units).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  await runBounded(units, 8, async (unit) => {
    const release = selectedRelease(unit);
    if (!release?.normalization || !(await verifyNormalization(store, release.normalization))) throw new Error(`Selected release is not normalized: ${unit.id}`);
  });
  const viewer = await loadViewerAssets();
  await writeViewerAssets(stage, viewer);
  const seriesCovers = await publishSeriesCovers(store, stage, units);
  await writeAndSync(path.join(stage, "catalog.js"), catalogPayload(units, catalog, seriesCovers));
  await writeAndSync(path.join(stage, "index.html"), renderRootHtml(units, viewer));
  const manifestUnits: Manifest["units"] = [];
  for (const unit of units) {
    const normalization = selectedRelease(unit)!.normalization!;
    const unitRoot = safeJoin(stage, "library", ...unit.id.split("/"));
    const pagesRoot = path.join(unitRoot, "pages");
    await mkdir(pagesRoot, { recursive: true });
    const sourceRoot = safeJoin(store.paths.work, ...normalization.workRelative.split("/"));
    const pageNames = normalization.pages.map((page) => path.basename(page.file));
    await runBounded(normalization.pages, 8, async (page, index) => {
      const outputName = pageNames[index]!;
      const expectedName = `${pad(index + 1, outputName.slice(0, outputName.indexOf(".")).length)}${path.extname(outputName)}`;
      if (outputName.toLowerCase() !== expectedName.toLowerCase()) throw new Error(`Normalized page sequence is not canonical: ${unit.id}:${page.file}`);
      await publishImmutable(safeJoin(sourceRoot, page.file), path.join(pagesRoot, outputName));
    });
    await publishImmutable(await unitThumbnail(store, normalization), path.join(unitRoot, "thumbnail.webp"));
    const rootPrefix = "../".repeat(unit.id.split("/").length + 1);
    await writeAndSync(path.join(unitRoot, "index.html"), renderLeafHtml(unit, rootPrefix, pageNames, viewer));
    await fsyncDirectory(pagesRoot);
    await fsyncDirectory(unitRoot);
    manifestUnits.push({ id: unit.id, pageCount: normalization.pages.length });
  }

  const files: Record<string, string> = {};
  const stagedFiles = await listTree(stage);
  const stagedHashes = new Array<string>(stagedFiles.length);
  await runBounded(stagedFiles, 16, async (relative, index) => {
    stagedHashes[index] = await sha256File(safeJoin(stage, ...relative.split("/")));
  });
  stagedFiles.forEach((relative, index) => { files[relative] = stagedHashes[index]!; });
  const manifest = ManifestSchema.parse({ schemaVersion: 1, generation, units: manifestUnits, files });
  await writeAndSync(path.join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fsyncDirectory(stage);
  return manifest;
}

async function activeTarget(store: CatalogStore): Promise<string | undefined> {
  try {
    const info = await lstat(store.paths.activeExport);
    if (!info.isSymbolicLink()) throw new Error(`Active export must be an atomic generation symlink: ${store.paths.activeExport}`);
    const target = await readlink(store.paths.activeExport);
    const resolved = path.resolve(store.paths.exportRoot, target);
    if (!resolved.startsWith(`${path.resolve(store.paths.exportRoot)}${path.sep}`)) throw new Error("Active export symlink escapes export root");
    return resolved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function materializePortableExport(store: CatalogStore, destination: string): Promise<{ destination: string; files: number; units: number; pages: number; manifestSha256: string }> {
  const target = await activeTarget(store);
  if (!target) throw new Error("No active export exists");
  await validateExport(target);

  const destinationRoot = path.resolve(destination);
  if (await pathExists(destinationRoot)) throw new Error(`Portable export destination already exists: ${destinationRoot}`);
  const parent = path.dirname(destinationRoot);
  await mkdir(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(destinationRoot)}.portable-${process.pid}`);
  await rm(temporary, { recursive: true, force: true });

  try {
    await cp(target, temporary, { recursive: true, dereference: true, errorOnExist: true, force: false, preserveTimestamps: true });
    await validateExport(temporary);
    await rename(temporary, destinationRoot);
    const validation = await validateExport(destinationRoot);
    return { destination: destinationRoot, ...validation };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function activate(store: CatalogStore, generationName: string): Promise<void> {
  const target = safeJoin(store.paths.exportRoot, generationName);
  await validateExport(target);
  const temporaryLink = path.join(store.paths.exportRoot, `.library-001.activate-${process.pid}`);
  await rm(temporaryLink, { force: true });
  await symlink(generationName, temporaryLink, "dir");
  await rename(temporaryLink, store.paths.activeExport);
  await fsyncDirectory(store.paths.exportRoot);
}

async function recoverLatest(store: CatalogStore, catalog: Catalog, hooks: ExportHooks): Promise<number | undefined> {
  const pending = Object.values(catalog.exportBuilds).filter((build) => build.status === "prepared" || build.status === "validated" || build.status === "failed").sort((a, b) => b.generation - a.generation)[0];
  if (!pending) return undefined;
  const stage = safeJoin(store.paths.exportRoot, pending.stageName);
  const generationRoot = safeJoin(store.paths.exportRoot, pending.generationName);
  if (pending.status === "failed") {
    try {
      const validation = await validateExport(stage);
      pending.status = "validated";
      pending.manifestSha256 = validation.manifestSha256;
      delete pending.error;
      await store.save(catalog);
    } catch {
      return undefined;
    }
  }
  try {
    if (await (async () => { try { await lstat(generationRoot); return true; } catch { return false; } })()) {
      await validateExport(generationRoot);
    } else {
      const validation = await validateExport(stage);
      pending.manifestSha256 = validation.manifestSha256;
      pending.status = "validated";
      await store.save(catalog);
      if (hooks.beforeActivation) await hooks.beforeActivation(stage);
      await rename(stage, generationRoot);
      await fsyncDirectory(store.paths.exportRoot);
    }
    await activate(store, pending.generationName);
    pending.status = "activated"; pending.activatedAt = nowIso(); catalog.activeExportGeneration = pending.generation;
    await store.save(catalog);
    return pending.generation;
  } catch (error) {
    if (pending.status === "prepared") { pending.status = "failed"; pending.error = (error as Error).message; await store.save(catalog); }
    throw error;
  }
}

export async function exportLibrary(store: CatalogStore, hooks: ExportHooks = {}): Promise<{ generation: number; units: number; pages: number; files: number; recovered: boolean }> {
  const catalog = await store.load();
  const recovered = await recoverLatest(store, catalog, hooks);
  if (recovered !== undefined) {
    const validation = await validateExport(store.paths.activeExport);
    return { generation: recovered, units: validation.units, pages: validation.pages, files: validation.files, recovered: true };
  }
  const curation = applyCatalogCuration(catalog, await loadSeriesCuration(store.paths.curation));
  if (curation.changed) await store.save(catalog);
  const generation = Math.max(0, ...Object.values(catalog.exportBuilds).map((build) => build.generation)) + 1;
  const key = String(generation);
  const stageName = `.library-001.staging-g${String(generation).padStart(6, "0")}`;
  const generationName = `.library-001.g${String(generation).padStart(6, "0")}`;
  catalog.exportBuilds[key] = {
    generation,
    status: "prepared",
    stageName,
    generationName,
    unitIds: Object.keys(catalog.units).sort(),
    preparedAt: nowIso()
  };
  await store.save(catalog);
  const stage = safeJoin(store.paths.exportRoot, stageName);
  try {
    await buildStage(store, catalog, stage, generation);
    const validation = await validateExport(stage);
    const build = catalog.exportBuilds[key]!;
    build.status = "validated"; build.manifestSha256 = validation.manifestSha256;
    await store.save(catalog);
    if (hooks.beforeActivation) await hooks.beforeActivation(stage);
    const generationRoot = safeJoin(store.paths.exportRoot, generationName);
    await rename(stage, generationRoot);
    await fsyncDirectory(store.paths.exportRoot);
    await activate(store, generationName);
    build.status = "activated"; build.activatedAt = nowIso(); catalog.activeExportGeneration = generation;
    await store.save(catalog);
    return { generation, units: validation.units, pages: validation.pages, files: validation.files, recovered: false };
  } catch (error) {
    const build = catalog.exportBuilds[key]!;
    if (build.status === "prepared") { build.status = "failed"; build.error = (error as Error).message; await store.save(catalog); }
    throw error;
  }
}

export async function validateActiveExport(store: CatalogStore) {
  const target = await activeTarget(store);
  if (!target) throw new Error("No active export exists");
  return validateExport(target);
}

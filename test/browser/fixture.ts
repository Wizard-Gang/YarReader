/*
 * Synthetic portable-library fixture for the Vitest browser boundary.
 *
 * Everything here is generated: solid-colour PNGs, invented series names and an
 * invented curation file. No real media, cover art, catalog, curation inventory
 * or machine-specific path ever reaches this suite.
 *
 * The fixture drives the compiled product (`dist/`) rather than the TypeScript
 * sources, because the portable viewer assets the exporter publishes live next
 * to the compiled exporter. The suite therefore asserts against exactly the
 * artifact `npm run build` produces.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM, type DOMWindow } from "jsdom";
import sharp from "sharp";
import { classify } from "../../dist/src/classification.js";
import { exportLibrary, materializePortableExport } from "../../dist/src/export.js";
import { normalize } from "../../dist/src/normalization.js";
import { CatalogStore } from "../../dist/src/catalog.js";
import { initializePaths, resolvePaths } from "../../dist/src/paths.js";
import { scan } from "../../dist/src/scanner.js";
import { createBundleFromFiles } from "../../dist/src/zip.js";

/* Vitest runs from the repository root, which is this config's project root. */
const REPOSITORY_ROOT = process.cwd();

interface ViteManifestEntry {
  readonly file: string;
  readonly css?: readonly string[];
  readonly assets?: readonly string[];
  readonly isEntry?: boolean;
}

export interface ViewerBuildAssets {
  readonly script: string;
  readonly styles: readonly string[];
  readonly files: readonly string[];
}

export async function viewerBuildAssets(): Promise<ViewerBuildAssets> {
  const manifest = JSON.parse(
    await readFile(path.join(REPOSITORY_ROOT, "dist", "viewer", "manifest.json"), "utf8"),
  ) as Record<string, ViteManifestEntry>;
  const entry = manifest["src/viewer/entry.ts"] ?? Object.values(manifest).find((candidate) => candidate.isEntry === true);
  if (!entry) throw new Error("dist/viewer/manifest.json has no viewer entry");
  const styles = [...new Set([
    ...(entry.css ?? []),
    ...Object.values(manifest).map((candidate) => candidate.file).filter((file) => file.endsWith(".css")),
  ])];
  const files = [...new Set([entry.file, ...styles, ...(entry.assets ?? [])])];
  return { script: entry.file, styles, files };
}

/** One synthetic series in the fixture library. */
export interface FixtureSeries {
  readonly series: string;
  readonly seriesSlug: string;
  readonly readingMode: "ltr" | "rtl" | "scroll";
  readonly genres: readonly string[];
  readonly numbers: readonly number[];
}

/**
 * Three reading modes, three genres and a multi-unit series, so the library
 * document has something real to group, sort and filter.
 */
export const FIXTURE_SERIES: readonly FixtureSeries[] = [
  { series: "Example Atlas", seriesSlug: "example-atlas", readingMode: "ltr", genres: ["Adventure", "Example"], numbers: [1, 2] },
  { series: "Example Mirror", seriesSlug: "example-mirror", readingMode: "rtl", genres: ["Example", "Mystery"], numbers: [1] },
  { series: "Example Tower", seriesSlug: "example-tower", readingMode: "scroll", genres: ["Example"], numbers: [1] },
];

export const FIXTURE_PAGE_COUNT = 3;
const PAGE_COLOURS = ["#204060", "#603040", "#306040"];

export interface PortableFixture {
  /** Self-contained portable export directory, as copied for distribution. */
  readonly root: string;
  /** Absolute path of the library index document. */
  readonly indexHtml: string;
  readonly units: number;
  readonly pages: number;
  readonly files: number;
  cleanup(): Promise<void>;
}

async function syntheticPng(file: string, colour: string): Promise<string> {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: 8, height: 12, channels: 3, background: colour } }).png().toFile(file);
  return file;
}

function comicInfo(series: string, number: number): Buffer {
  return Buffer.from(
    `<?xml version="1.0"?><ComicInfo><Series>${series}</Series><Number>${number}</Number>` +
      `<Title>Example Chapter ${number}</Title><Year>2026</Year><Writer>Example Writer</Writer>` +
      `<Penciller>Example Artist</Penciller><Publisher>Example Press</Publisher>` +
      `<Summary>Synthetic fixture unit.</Summary></ComicInfo>`,
  );
}

/**
 * Build a real portable export from synthetic inputs by running the shipped
 * ingestion pipeline, then materialize it as a standalone copied directory.
 */
export async function buildPortableFixture(): Promise<PortableFixture> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "yarreader-browser-"));
  const paths = await resolvePaths(path.join(workspace, "media"));
  await initializePaths(paths);
  const store = new CatalogStore(paths);
  await store.initialize();

  for (const entry of FIXTURE_SERIES) {
    for (const number of entry.numbers) {
      const stagingDirectory = path.join(workspace, "synthetic", `${entry.seriesSlug}-${number}`);
      const pages: string[] = [];
      for (let index = 0; index < FIXTURE_PAGE_COUNT; index += 1) {
        pages.push(await syntheticPng(path.join(stagingDirectory, `${index + 1}.png`), PAGE_COLOURS[index % PAGE_COLOURS.length]!));
      }
      await createBundleFromFiles(
        pages.map((source, index) => ({ source, name: `${String(index + 1).padStart(3, "0")}.png` })),
        path.join(paths.source, `${entry.series} ${String(number).padStart(3, "0")}.cbz`),
        [{ name: "ComicInfo.xml", data: comicInfo(entry.series, number) }],
      );
    }
  }

  await scan(store, 0);
  await classify(store);
  await normalize(store);
  await writeFile(
    paths.curation,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        series: FIXTURE_SERIES.map((entry) => ({
          series: entry.series,
          seriesSlug: entry.seriesSlug,
          readingMode: entry.readingMode,
          genres: [...entry.genres],
        })),
        merges: [],
      },
      null,
      2,
    )}\n`,
  );
  await exportLibrary(store);

  const destination = path.join(workspace, "portable");
  const materialized = await materializePortableExport(store, destination);
  return {
    root: materialized.destination,
    indexHtml: path.join(materialized.destination, "index.html"),
    units: materialized.units,
    pages: materialized.pages,
    files: materialized.files,
    cleanup: async () => rm(workspace, { recursive: true, force: true }),
  };
}

/** Every file in the portable directory, as export-root-relative POSIX paths. */
export async function inventory(root: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (directory: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else found.push(relative);
    }
  };
  await walk(root, "");
  return found.sort();
}

/**
 * Parse a generated document exactly as a browser with JavaScript disabled
 * would see it: no script ever runs.
 */
export async function staticDocument(file: string): Promise<Document> {
  const dom = new JSDOM(await readFile(file, "utf8"), { url: pathToFileURL(file).href });
  return dom.window.document;
}

/** A loaded document with the shipped first-party viewer modules applied. */
export interface EnhancedDocument {
  readonly window: DOMWindow;
  readonly document: Document;
  close(): void;
}

/**
 * Load a generated document and then run the shipped first-party viewer modules
 * against it, the way the portable reader progressively enhances itself.
 *
 * Scripts are evaluated explicitly instead of being fetched by JSDOM, so the
 * suite controls exactly which first-party assets execute and nothing is ever
 * retrieved over a network.
 */
export async function enhancedDocument(
  fixtureRoot: string,
  file: string,
): Promise<EnhancedDocument> {
  const dom = new JSDOM(await readFile(file, "utf8"), {
    url: pathToFileURL(file).href,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.eval(await readFile(path.join(fixtureRoot, "catalog.js"), "utf8"));
  const viewer = await viewerBuildAssets();
  dom.window.eval(await readFile(path.join(fixtureRoot, viewer.script), "utf8"));
  return { window: dom.window, document: dom.window.document, close: () => dom.window.close() };
}

/** Start options accepted by the portable library module. */
export interface LibraryStartOptions { root?: string; mount?: string; label?: string }
/** Start options accepted by the portable reader module. */
export interface ReaderStartOptions { path?: string; root?: string; mount?: string }

/** The library module the export publishes, as the generated document calls it. */
export function libraryModule(window: DOMWindow): { start(options?: LibraryStartOptions): void } {
  const found = (window as unknown as { ComicLibrary?: { start(options?: LibraryStartOptions): void } }).ComicLibrary;
  if (!found) throw new Error("viewer bundle did not publish its library start entry point");
  return found;
}

/** The reader module the export publishes, as the generated document calls it. */
export function readerModule(window: DOMWindow): { start(options?: ReaderStartOptions): void } {
  const found = (window as unknown as { ComicReader?: { start(options?: ReaderStartOptions): void } }).ComicReader;
  if (!found) throw new Error("viewer bundle did not publish its reader start entry point");
  return found;
}

/** Press a key against the document, the way a keyboard user would. */
export function pressKey(enhanced: EnhancedDocument, key: string, init: { shiftKey?: boolean } = {}): void {
  enhanced.document.dispatchEvent(
    new enhanced.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
  );
}

/** Network entry points replaced by a trap before the viewer modules run. */
export const TRAPPED_NETWORK_APIS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "Worker",
  "SharedWorker",
  "navigator.sendBeacon",
  "navigator.serviceWorker.register",
] as const;

/** A loaded document whose network entry points record any use instead of working. */
export interface TrappedDocument extends EnhancedDocument {
  /** Every trapped API the viewer modules touched; an empty list is the pass. */
  readonly networkCalls: string[];
}

/**
 * Load a document, replace every network entry point with a recorder, and only
 * then run the shipped viewer modules. Anything the portable reader tries to
 * retrieve over a network is recorded rather than performed.
 */
export async function networkTrappedDocument(
  fixtureRoot: string,
  file: string,
): Promise<TrappedDocument> {
  const dom = new JSDOM(await readFile(file, "utf8"), {
    url: pathToFileURL(file).href,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const networkCalls: string[] = [];
  const target = dom.window as unknown as Record<string, unknown> & { navigator: Record<string, unknown> };
  for (const api of TRAPPED_NETWORK_APIS) {
    const [namespace, member, nested] = api.split(".");
    const record = (): never => {
      networkCalls.push(api);
      throw new Error(`the portable reader must not call ${api}`);
    };
    if (nested !== undefined) {
      Object.defineProperty(target.navigator, member!, { configurable: true, value: { [nested]: record } });
    } else if (member !== undefined) {
      Object.defineProperty(target.navigator, member, { configurable: true, value: record });
    } else {
      Object.defineProperty(target, namespace!, { configurable: true, writable: true, value: record });
    }
  }
  dom.window.eval(await readFile(path.join(fixtureRoot, "catalog.js"), "utf8"));
  const viewer = await viewerBuildAssets();
  dom.window.eval(await readFile(path.join(fixtureRoot, viewer.script), "utf8"));
  return { window: dom.window, document: dom.window.document, close: () => dom.window.close(), networkCalls };
}

/** Text of a shipped portable asset, for inventory and no-network assertions. */
export async function assetText(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

export { REPOSITORY_ROOT };

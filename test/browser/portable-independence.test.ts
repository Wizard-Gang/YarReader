/*
 * The defining product invariant: an activated export is a self-contained
 * directory that can be copied elsewhere and opened through `file://`.
 *
 * This suite inventories exactly what ships in that directory and proves the
 * portable reader depends on no network and no runtime API.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  FIXTURE_PAGE_COUNT,
  FIXTURE_SERIES,
  REPOSITORY_ROOT,
  buildPortableFixture,
  inventory,
  TRAPPED_NETWORK_APIS,
  networkTrappedDocument,
  staticDocument,
  type PortableFixture,
  type TrappedDocument,
  type ViewerBuildAssets,
  viewerBuildAssets,
} from "./fixture.js";


/** APIs a portable `file://` reader must never depend on. */
const FORBIDDEN_RUNTIME_APIS = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "serviceWorker",
  "sendBeacon",
  "importScripts",
  "new Worker",
  "navigator.onLine",
  "localhost",
  "127.0.0.1",
];

let fixture: PortableFixture;
let files: string[];
let viewerAssets: ViewerBuildAssets;

beforeAll(async () => {
  viewerAssets = await viewerBuildAssets();
  fixture = await buildPortableFixture();
  files = await inventory(fixture.root);
});
afterAll(async () => fixture?.cleanup());

const unitPaths = FIXTURE_SERIES.flatMap((entry) =>
  entry.numbers.map((number) => `library/${entry.seriesSlug}/issue-${String(number).padStart(4, "0")}`),
);

describe("browser asset inventory", () => {
  test("ships exactly the Vite-manifest assets plus the portable root files", () => {
    const expectedRoot = [
      "assets/favicon.svg",
      "catalog.js",
      "index.html",
      "manifest.json",
      ...viewerAssets.files,
    ].sort();
    expect(files.filter((file) => !file.startsWith("library/"))).toEqual(expectedRoot);
    expect(viewerAssets.script).toMatch(/^assets\/viewer-[^/]+\.js$/);
    for (const style of viewerAssets.styles) expect(style).toMatch(/^assets\/viewer-[^/]+\.css$/);
    for (const fixed of ["reader.js", "library.js", "reader.css", "library.css"]) expect(files).not.toContain(fixed);
  });

  test("ships exactly one complete directory per unit", () => {
    for (const unit of unitPaths) {
      const owned = files.filter((file) => file.startsWith(`${unit}/`));
      expect(owned).toEqual([
        `${unit}/index.html`,
        ...Array.from({ length: FIXTURE_PAGE_COUNT }, (_, index) => `${unit}/pages/${String(index + 1).padStart(6, "0")}.webp`),
        `${unit}/thumbnail.webp`,
      ]);
    }
    expect(files.filter((file) => file.endsWith("/index.html"))).toHaveLength(unitPaths.length);
  });

  test("every shipped viewer asset is byte-identical to its Vite build output", async () => {
    for (const asset of viewerAssets.files) {
      const shipped = await readFile(path.join(fixture.root, asset));
      const built = await readFile(path.join(REPOSITORY_ROOT, "dist", "viewer", asset));
      expect(shipped.equals(built)).toBe(true);
    }
  });

  test("the manifest accounts for every shipped file", async () => {
    const manifest = JSON.parse(await readFile(path.join(fixture.root, "manifest.json"), "utf8")) as {
      units: { pageCount: number }[];
    };
    expect(manifest.units).toHaveLength(unitPaths.length);
    expect(manifest.units.reduce((sum, unit) => sum + unit.pageCount, 0)).toBe(fixture.pages);
    expect(files).toContain("manifest.json");
  });
});

describe("no network or runtime API dependency", () => {
  const shipped = () => files.filter((file) => file.endsWith(".html") || file.endsWith(".js") || file.endsWith(".css"));

  test("no shipped document or script references a forbidden runtime API", async () => {
    for (const file of shipped()) {
      const text = await readFile(path.join(fixture.root, file), "utf8");
      for (const api of FORBIDDEN_RUNTIME_APIS) {
        expect(text, `${file} must not reference ${api}`).not.toContain(api);
      }
    }
  });

  test("no shipped document or script contains a remote URL", async () => {
    for (const file of shipped()) {
      const text = await readFile(path.join(fixture.root, file), "utf8");
      expect(text, `${file} must not contain an absolute URL`).not.toMatch(/https?:\/\//);
      expect(text, `${file} must not contain a protocol-relative URL`).not.toMatch(/(^|[^:a-z])\/\/[a-z0-9-]+\.[a-z]{2,}/i);
    }
  });

  test("nothing shipped leaks a machine-specific path", async () => {
    for (const file of shipped()) {
      const text = await readFile(path.join(fixture.root, file), "utf8");
      for (const marker of ["/Users/", "/home/", "/var/folders/", "/private/tmp", "C:\\"]) {
        expect(text, `${file} must not contain ${marker}`).not.toContain(marker);
      }
      expect(text).not.toContain(fixture.root);
    }
  });

  test("every reference in every document resolves inside the export directory", async () => {
    for (const file of files.filter((candidate) => candidate.endsWith(".html"))) {
      const document = await staticDocument(path.join(fixture.root, file));
      const references = [
        ...[...document.querySelectorAll("[href]")].map((element) => element.getAttribute("href")),
        ...[...document.querySelectorAll("[src]")].map((element) => element.getAttribute("src")),
      ].filter((value): value is string => typeof value === "string" && value.length > 0);
      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) {
        expect(reference, `${file} -> ${reference}`).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
        expect(reference, `${file} -> ${reference}`).not.toMatch(/^\/\//);
        expect(reference.startsWith("/"), `${file} -> ${reference}`).toBe(false);
        const resolved = path.resolve(fixture.root, path.dirname(file), reference);
        expect(resolved.startsWith(fixture.root + path.sep), `${file} -> ${reference}`).toBe(true);
        expect(files, `${file} -> ${reference}`).toContain(path.relative(fixture.root, resolved).split(path.sep).join("/"));
      }
    }
  });
});

/**
 * Prove the trap is armed before trusting an empty result, so these tests
 * cannot pass merely because the recorder was never installed.
 */
function assertTrapArmed(enhanced: TrappedDocument): void {
  expect(() => (enhanced.window as unknown as { fetch: () => unknown }).fetch()).toThrow(/must not call fetch/);
  expect(enhanced.networkCalls).toEqual(["fetch"]);
  enhanced.networkCalls.length = 0;
}

describe("the enhanced viewer never reaches for a network API", () => {
  test("every documented network entry point is replaced before the viewer runs", async () => {
    const enhanced = await networkTrappedDocument(fixture.root, fixture.indexHtml);
    try {
      for (const api of TRAPPED_NETWORK_APIS) {
        const [namespace, member, nested] = api.split(".");
        const window = enhanced.window as unknown as Record<string, unknown> & { navigator: Record<string, unknown> };
        const holder = nested !== undefined ? (window.navigator[member!] as Record<string, unknown>)
          : member !== undefined ? window.navigator
          : window;
        expect(typeof holder[nested ?? member ?? namespace!], `${api} must be trapped`).toBe("function");
      }
    } finally {
      enhanced.close();
    }
  });

  test("driving the whole reader touches no network entry point", async () => {
    const unit = `${unitPaths[0]!}/`;
    const enhanced = await networkTrappedDocument(fixture.root, path.join(fixture.root, unit, "index.html"));
    try {
      assertTrapArmed(enhanced);
      expect(enhanced.document.querySelector(".yar-counter")?.textContent).toBe(`1 / ${FIXTURE_PAGE_COUNT}`);

      for (const key of ["ArrowDown", "ArrowDown", "ArrowUp", "End", "Home", "m", "m", "m", "d", "w", "p"]) {
        enhanced.document.dispatchEvent(
          new enhanced.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
      }
      for (const button of enhanced.document.querySelectorAll<HTMLButtonElement>(".yar-bar-bottom button")) button.click();

      expect(enhanced.networkCalls).toEqual([]);
    } finally {
      enhanced.close();
    }
  });

  test("driving the whole library touches no network entry point", async () => {
    const enhanced = await networkTrappedDocument(fixture.root, fixture.indexHtml);
    try {
      assertTrapArmed(enhanced);
      for (const tab of enhanced.document.querySelectorAll<HTMLButtonElement>("nav.yar-tabs button.yar-tab")) tab.click();
      for (const format of enhanced.document.querySelectorAll<HTMLButtonElement>("button.yar-format-button")) format.click();
      const clear = enhanced.document.querySelector<HTMLButtonElement>(".yar-active-filters .yar-chip-clear");
      clear?.click();
      expect(enhanced.document.querySelectorAll(".yar-results .yar-card").length).toBeGreaterThan(0);
      expect(enhanced.networkCalls).toEqual([]);
    } finally {
      enhanced.close();
    }
  });
});

/*
 * Acceptance baseline for one portable unit reader document, read exactly as a
 * browser with JavaScript disabled would read it.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { FIXTURE_PAGE_COUNT, buildPortableFixture, staticDocument, type PortableFixture } from "./fixture.js";

const UNIT_PATH = "library/example-atlas/issue-0001/";
const UNIT_SERIES = "Example Atlas";
const UNIT_TITLE = "Example Chapter 1";

let fixture: PortableFixture;
let document: Document;
let unitFile: string;

beforeAll(async () => {
  fixture = await buildPortableFixture();
  unitFile = path.join(fixture.root, UNIT_PATH, "index.html");
  document = await staticDocument(unitFile);
});
afterAll(async () => fixture?.cleanup());

describe("document metadata", () => {
  test("identifies the unit it renders", () => {
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.getAttribute("data-yar-unit")).toBe(UNIT_PATH);
    expect(document.title).toBe(`${UNIT_SERIES} - ${UNIT_TITLE}`);
  });

  test("declares encoding, viewport, colour scheme and generator", () => {
    expect(document.querySelector("meta[charset]")?.getAttribute("charset")).toBe("utf-8");
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute("content")).toContain("width=device-width");
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe("dark light");
    expect(document.querySelector('meta[name="generator"]')?.getAttribute("content")).toBe("YarReader");
  });

  test("declares a strict file-compatible CSP with no unsafe inline allowance", () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' file:");
    expect(csp).toContain("style-src 'self' file:");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
  });

  test("reaches shared assets through a relative prefix only", async () => {
    const references = [
      document.querySelector('link[rel="icon"]')?.getAttribute("href"),
      ...[...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute("href")),
    ].filter((value): value is string => typeof value === "string");
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith("../")).toBe(true);
      await expect(access(path.join(fixture.root, UNIT_PATH, reference))).resolves.toBeUndefined();
    }
  });
});

describe("page images are usable without JavaScript", () => {
  test("every page ships as a complete image element", async () => {
    const images = [...document.querySelectorAll("main[data-pages] img")];
    expect(images).toHaveLength(FIXTURE_PAGE_COUNT);
    for (const [index, image] of images.entries()) {
      const source = image.getAttribute("src") ?? "";
      expect(source).toBe(`pages/${String(index + 1).padStart(6, "0")}.webp`);
      expect(image.getAttribute("alt")).toBe(`Page ${index + 1}`);
      expect(image.getAttribute("decoding")).toBe("async");
      await expect(access(path.join(fixture.root, UNIT_PATH, source))).resolves.toBeUndefined();
    }
  });

  test("the first page loads eagerly and the rest stay lazy", () => {
    const loading = [...document.querySelectorAll("main[data-pages] img")].map((image) => image.getAttribute("loading"));
    expect(loading[0]).toBe("eager");
    expect(loading.slice(1)).toEqual(Array(FIXTURE_PAGE_COUNT - 1).fill("lazy"));
  });

  test("pages are in document order with no inline script, style or handler attribute", () => {
    const main = document.querySelector("main[data-pages]")!;
    expect(main.querySelector("script")).toBeNull();
    expect(document.querySelector("style,[style]")).toBeNull();
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of element.getAttributeNames()) expect(attribute.startsWith("on")).toBe(false);
    }
  });

  test("startup configuration is inert markup", () => {
    const main = document.querySelector<HTMLElement>("main[data-pages]")!;
    expect(main.getAttribute("data-yar-start")).toBe("reader");
    expect(main.getAttribute("data-yar-path")).toBe(UNIT_PATH);
    expect(main.getAttribute("data-yar-root")).toBe("../../../");
  });
});

describe("static navigation", () => {
  test("a real relative anchor returns to the library index", async () => {
    const back = document.querySelector("main[data-pages] header a");
    expect(back?.textContent?.trim()).toBe("Library");
    const href = back?.getAttribute("href") ?? "";
    expect(href).toBe("../../../index.html");
    await expect(access(path.join(fixture.root, UNIT_PATH, href))).resolves.toBeUndefined();
    expect(path.resolve(fixture.root, UNIT_PATH, href)).toBe(path.resolve(fixture.indexHtml));
  });

  test("the series is named in the static header", () => {
    expect(document.querySelector("main[data-pages] header")?.textContent).toContain(UNIT_SERIES);
  });
});

describe("reading modes are described by the catalog, not by markup", () => {
  test("each synthetic series keeps its curated reading mode and direction", async () => {
    const source = await readFile(path.join(fixture.root, "catalog.js"), "utf8");
    const payload = JSON.parse(source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1)) as {
      items: { path: string; seriesSlug: string; readingMode: string; direction: string; pageSizes?: number[][] }[];
    };
    const bySlug = new Map(payload.items.map((item) => [item.seriesSlug, item]));
    expect(bySlug.get("example-atlas")).toMatchObject({ readingMode: "ltr", direction: "ltr" });
    expect(bySlug.get("example-mirror")).toMatchObject({ readingMode: "rtl", direction: "rtl" });
    expect(bySlug.get("example-tower")).toMatchObject({ readingMode: "scroll", direction: "ltr" });
    expect(bySlug.get("example-tower")?.pageSizes).toHaveLength(FIXTURE_PAGE_COUNT);
    expect(bySlug.get("example-atlas")?.pageSizes).toBeUndefined();
  });
});

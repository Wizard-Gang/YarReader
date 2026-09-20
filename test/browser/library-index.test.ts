/*
 * Acceptance baseline for the portable library index, read exactly as a browser
 * with JavaScript disabled would read it.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  FIXTURE_SERIES,
  buildPortableFixture,
  staticDocument,
  type PortableFixture,
  type ViewerBuildAssets,
  viewerBuildAssets,
} from "./fixture.js";

let fixture: PortableFixture;
let document: Document;
let viewerAssets: ViewerBuildAssets;

beforeAll(async () => {
  viewerAssets = await viewerBuildAssets();
  fixture = await buildPortableFixture();
  document = await staticDocument(fixture.indexHtml);
});
afterAll(async () => fixture?.cleanup());

const expectedUnits = FIXTURE_SERIES.reduce((total, entry) => total + entry.numbers.length, 0);

describe("document metadata", () => {
  test("declares language, encoding, viewport, colour scheme and generator", () => {
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.querySelector("meta[charset]")?.getAttribute("charset")).toBe("utf-8");
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute("content")).toContain("width=device-width");
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe("dark light");
    expect(document.querySelector('meta[name="generator"]')?.getAttribute("content")).toBe("YarReader");
  });

  test("carries a title and a relative icon", () => {
    expect(document.title.trim().length).toBeGreaterThan(0);
    const icon = document.querySelector('link[rel="icon"]')?.getAttribute("href");
    expect(icon).toBe("./assets/favicon.svg");
  });

  test("is static markup with no React runtime or hydration marker", () => {
    expect(document.querySelector("[data-reactroot]")).toBeNull();
    expect([...document.querySelectorAll("script[src]")].some((script) => (script.getAttribute("src") ?? "").includes("react"))).toBe(false);
  });

  test("declares a strict file-compatible CSP with no unsafe inline allowance", () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' file:");
    expect(csp).toContain("style-src 'self' file:");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
  });

  test("references only relative stylesheets", () => {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute("href") ?? "");
    expect(sheets.length).toBeGreaterThan(0);
    for (const href of sheets) expect(href.startsWith("./")).toBe(true);
  });
});

describe("static library structure", () => {
  test("exposes a landmark with exactly one top-level heading", () => {
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    const main = document.querySelector("main[data-library]");
    expect(main).not.toBeNull();
    expect(main?.id).toBe("library");
    expect(document.documentElement.hasAttribute("dir")).toBe(false);
  });

  test("groups every synthetic series into its own ordered section", () => {
    const sections = [...document.querySelectorAll("main[data-library] section")];
    expect(sections).toHaveLength(FIXTURE_SERIES.length);
    const headings = sections.map((section) => section.querySelector("h2")?.textContent);
    expect(headings).toEqual([...FIXTURE_SERIES].map((entry) => entry.series).sort((a, b) => a.localeCompare(b, "en")));
    for (const section of sections) expect(section.querySelector("ol")).not.toBeNull();
  });
});

describe("static links are usable without JavaScript", () => {
  test("every unit is reachable through a real relative anchor", async () => {
    const links = [...document.querySelectorAll("main[data-library] ol li a")];
    expect(links).toHaveLength(expectedUnits);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("");
      expect(href.startsWith("/")).toBe(false);
      expect(href).not.toMatch(/^[a-z]+:/i);
      expect(href.endsWith("/index.html")).toBe(true);
      expect(link.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      await expect(access(path.join(fixture.root, href))).resolves.toBeUndefined();
    }
  });

  test("navigation needs no inline script, style, handler attribute or placeholder target", () => {
    const main = document.querySelector("main[data-library]")!;
    expect(main.querySelector("script")).toBeNull();
    expect(document.querySelector("style,[style]")).toBeNull();
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of element.getAttributeNames()) expect(attribute.startsWith("on")).toBe(false);
    }
    for (const link of main.querySelectorAll("a")) expect(link.getAttribute("href")).not.toBe("#");
  });

  test("startup configuration is inert markup", () => {
    const main = document.querySelector<HTMLElement>("main[data-library]")!;
    expect(main.getAttribute("data-yar-start")).toBe("library");
    expect(main.getAttribute("data-yar-root")).toBe("./");
    expect(main.getAttribute("data-yar-label")).toBe("YarReader");
  });
});

describe("progressive enhancement boundary", () => {
  test("scripts are additive, deferred to the end and first-party relative", () => {
    const scripts = [...document.querySelectorAll("script")];
    const sourced = scripts.filter((script) => script.hasAttribute("src"));
    expect(sourced).toHaveLength(scripts.length);
    expect(sourced.map((script) => script.getAttribute("src"))).toEqual(["./catalog.js", `./${viewerAssets.script}`]);
    const main = document.querySelector("main[data-library]")!;
    for (const script of scripts) {
      expect(main.compareDocumentPosition(script) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

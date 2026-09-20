/*
 * Behavioural baseline for the shipped first-party viewer modules.
 *
 * These run the real Vite viewer bundle the exporter publishes,
 * against the synthetic portable documents, so a later build or presentation
 * change has something concrete to be compared against.
 */
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  buildPortableFixture,
  enhancedDocument,
  pressKey,
  readerModule,
  type EnhancedDocument,
  type PortableFixture,
} from "./fixture.js";

const LTR_UNIT = "library/example-atlas/issue-0001/";
const RTL_UNIT = "library/example-mirror/issue-0001/";
const UNIT_ROOT = "../../../";

let fixture: PortableFixture;
const open: EnhancedDocument[] = [];

beforeAll(async () => { fixture = await buildPortableFixture(); });
afterEach(() => { while (open.length) open.pop()!.close(); });
afterAll(async () => fixture?.cleanup());

async function startedLibrary(): Promise<EnhancedDocument> {
  const enhanced = await enhancedDocument(fixture.root, fixture.indexHtml);
  open.push(enhanced);
  return enhanced;
}

async function startedReader(unitPath: string): Promise<EnhancedDocument> {
  const enhanced = await enhancedDocument(fixture.root, path.join(fixture.root, unitPath, "index.html"));
  open.push(enhanced);
  return enhanced;
}

/** Controls a keyboard user reaches without a custom tab stop. */
const NATIVELY_FOCUSABLE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

/**
 * Every click target must either be a natively focusable, labelled control, or
 * be one of the named pointer-only affordances whose action is also bound to a
 * keyboard shortcut. Listing the exceptions explicitly means a newly introduced
 * unfocusable click target fails this baseline instead of passing silently.
 */
function assertKeyboardOperable(container: Element, pointerOnly: readonly string[] = []): void {
  const clickable = [...container.querySelectorAll("*")].filter(
    (element) => typeof (element as HTMLElement & { onclick?: unknown }).onclick === "function",
  );
  expect(clickable.length).toBeGreaterThan(0);

  const unfocusable = clickable.filter((element) => !NATIVELY_FOCUSABLE.has(element.tagName));
  expect(unfocusable.map((element) => element.className).sort()).toEqual([...pointerOnly].sort());

  const controls = clickable.filter((element) => NATIVELY_FOCUSABLE.has(element.tagName));
  expect(controls.length).toBeGreaterThan(0);
  for (const element of controls) {
    if (element.tagName === "BUTTON") expect(element.getAttribute("type")).toBe("button");
    if (element.tagName === "A") expect(element.getAttribute("href")).toBeTruthy();
    expect(element.getAttribute("tabindex")).not.toBe("-1");
    expect((element.textContent ?? "").trim() || element.getAttribute("aria-label") || "").not.toBe("");
  }
}

describe("library module", () => {
  test("publishes both documented entry points", async () => {
    const enhanced = await enhancedDocument(fixture.root, fixture.indexHtml);
    open.push(enhanced);
    const globals = enhanced.window as unknown as Record<string, { start?: unknown }>;
    expect(typeof globals.ComicLibrary?.start).toBe("function");
    expect(typeof globals.YarLibrary?.start).toBe("function");
    expect(globals.YarLibrary?.start).toBe(globals.ComicLibrary?.start);
  });

  test("reads the catalog that the export generated", async () => {
    const enhanced = await enhancedDocument(fixture.root, fixture.indexHtml);
    open.push(enhanced);
    const catalog = (enhanced.window as unknown as { COMIC_LIBRARY: { itemCount: number; items: unknown[] } }).COMIC_LIBRARY;
    expect(catalog.itemCount).toBe(fixture.units);
    expect(catalog.items).toHaveLength(fixture.units);
  });

  test("auto-starts from inert document configuration", async () => {
    const { document } = await startedLibrary();
    expect(document.querySelector(".yar-library")).not.toBeNull();
    expect(document.querySelector("[style]")).toBeNull();
  });

  test("builds search, sort, genre and format controls", async () => {
    const { document } = await startedLibrary();
    const search = document.querySelector<HTMLInputElement>("input.yar-search")!;
    expect(search.type).toBe("search");
    expect(search.getAttribute("aria-label")).toBe("Search the library");

    const selects = [...document.querySelectorAll("select.yar-select")];
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const genre = document.querySelector<HTMLSelectElement>("select.yar-genre-select")!;
    expect(genre.getAttribute("aria-label")).toBe("Filter by genre");
    const genreOptions = [...genre.options].map((option) => option.value);
    expect(genreOptions[0]).toBe("");
    expect(genreOptions).toContain("Adventure");
    expect(genreOptions).toContain("Mystery");

    const formats = [...document.querySelectorAll("button.yar-format-button")].map((button) => button.textContent);
    expect(formats).toEqual(["All formats", "Manga (RTL)", "Comics (LTR)", "Webtoons (Scroll)"]);
    expect(document.querySelector('[aria-label="Library filters"]')).not.toBeNull();
  });

  test("opens on the series view and switches to chapters", async () => {
    const { document } = await startedLibrary();
    const tabs = [...document.querySelectorAll<HTMLButtonElement>("nav.yar-tabs button.yar-tab")];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Series", "Chapters"]);
    expect(tabs[0]!.className).toContain("yar-tab-on");
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(3);

    tabs[1]!.click();
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(fixture.units);
    const cards = [...document.querySelectorAll<HTMLAnchorElement>(".yar-results a.yar-card")];
    for (const card of cards) expect(card.href.startsWith("file:")).toBe(true);
  });

  test("format filtering narrows the library and records the active filter", async () => {
    const { document, window } = await startedLibrary();
    document.querySelector<HTMLButtonElement>("nav.yar-tabs button.yar-tab:nth-child(2)")!.click();
    const manga = [...document.querySelectorAll<HTMLButtonElement>("button.yar-format-button")]
      .find((button) => button.textContent === "Manga (RTL)")!;
    expect(manga.getAttribute("aria-pressed")).toBe("false");

    manga.click();
    expect(document.querySelector("button.yar-format-button-on")?.textContent).toBe("Manga (RTL)");
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(1);
    expect(document.querySelector(".yar-results .yar-card-series")?.textContent).toBe("Example Mirror");
    expect(window.location.hash).toContain("format=rtl");
    expect(document.querySelector(".yar-active-filters .yar-chip-active")?.textContent).toContain("format: Manga");
  });

  test("genre filtering and clearing restore the whole library", async () => {
    const { document } = await startedLibrary();
    document.querySelector<HTMLButtonElement>("nav.yar-tabs button.yar-tab:nth-child(2)")!.click();
    const genre = document.querySelector<HTMLSelectElement>("select.yar-genre-select")!;
    genre.value = "Mystery";
    genre.onchange!(new genre.ownerDocument.defaultView!.Event("change"));
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(1);

    document.querySelector<HTMLButtonElement>(".yar-active-filters .yar-chip-clear")!.click();
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(fixture.units);
  });

  test("an unmatched filter reports an empty result instead of failing", async () => {
    const { document } = await startedLibrary();
    const genre = document.querySelector<HTMLSelectElement>("select.yar-genre-select")!;
    const missing = document.createElement("option");
    missing.value = "Nonexistent Example Genre";
    genre.appendChild(missing);
    genre.value = missing.value;
    genre.onchange!(new genre.ownerDocument.defaultView!.Event("change"));
    expect(document.querySelector(".yar-empty h2")?.textContent).toBe("Nothing matches");
  });

  test("every library action is keyboard operable", async () => {
    const { document } = await startedLibrary();
    assertKeyboardOperable(document.querySelector(".yar-library")!);
  });

  test("the reader-facing globals stay separate objects sharing one entry point", async () => {
    const enhanced = await enhancedDocument(fixture.root, fixture.indexHtml);
    open.push(enhanced);
    const globals = enhanced.window as unknown as Record<string, unknown>;
    expect(globals.YarLibrary).not.toBe(globals.ComicLibrary);
  });
});

describe("reader module", () => {
  test("publishes both documented entry points", async () => {
    const enhanced = await enhancedDocument(fixture.root, path.join(fixture.root, LTR_UNIT, "index.html"));
    open.push(enhanced);
    const globals = enhanced.window as unknown as Record<string, { start?: unknown }>;
    expect(typeof globals.ComicReader?.start).toBe("function");
    expect(typeof globals.YarReader?.start).toBe("function");
    expect(globals.YarReader?.start).toBe(globals.ComicReader?.start);
  });

  test("auto-starts from inert document configuration without inline styles", async () => {
    const { document } = await startedReader(LTR_UNIT);
    expect(document.querySelector(".yar-app")).not.toBeNull();
    expect(document.querySelector("[style]")).toBeNull();
  });

  test("renders reader controls and a page counter", async () => {
    const { document } = await startedReader(LTR_UNIT);
    expect(document.querySelector(".yar-app")).not.toBeNull();
    expect(document.querySelector(".yar-counter")?.textContent).toBe("1 / 3");

    const labels = [...document.querySelectorAll(".yar-bar-top .yar-tools button")].map((button) => button.getAttribute("title"));
    expect(labels).toEqual(["Reading mode (m)", "Reading direction (d)", "Fit mode (w / p)", "Zoom out", "Zoom in", "Fullscreen (f)"]);

    const slider = document.querySelector<HTMLInputElement>("input.yar-slider")!;
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("3");
    expect(slider.getAttribute("aria-label")).toBe("Jump to page");

    const jump = document.querySelector<HTMLInputElement>("input.yar-jump")!;
    expect(jump.type).toBe("number");
    expect(jump.getAttribute("aria-label")).toBe("Page number");

    const nav = [...document.querySelectorAll(".yar-bar-bottom button.yar-btn-nav")].map((button) => button.textContent);
    expect(nav).toEqual(["Prev", "Next"]);
  });

  test("keeps a working relative link back to the library", async () => {
    const { document } = await startedReader(LTR_UNIT);
    const link = document.querySelector<HTMLAnchorElement>(".yar-bar-top a.yar-btn")!;
    expect(link.textContent).toBe("Library");
    expect(link.getAttribute("href")).toBe(`${UNIT_ROOT}index.html`);
  });

  test("sets the document title from the catalog entry", async () => {
    const { document } = await startedReader(LTR_UNIT);
    expect(document.title).toBe("Example Atlas - Example Chapter 1");
  });

  test("keyboard navigation moves through the unit and clamps at both ends", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const counter = () => enhanced.document.querySelector(".yar-counter")?.textContent;
    expect(counter()).toBe("1 / 3");
    pressKey(enhanced, "ArrowDown");
    expect(counter()).toBe("2 / 3");
    pressKey(enhanced, "ArrowUp");
    expect(counter()).toBe("1 / 3");
    pressKey(enhanced, "End");
    expect(counter()).toBe("3 / 3");
    pressKey(enhanced, "ArrowDown");
    expect(counter()).toBe("3 / 3");
    pressKey(enhanced, "Home");
    expect(counter()).toBe("1 / 3");
    pressKey(enhanced, "ArrowUp");
    expect(counter()).toBe("1 / 3");
    pressKey(enhanced, " ");
    expect(counter()).toBe("2 / 3");
    pressKey(enhanced, " ", { shiftKey: true });
    expect(counter()).toBe("1 / 3");
  });

  test("reading modes cycle and the curated default is honoured", async () => {
    const ltr = await startedReader(LTR_UNIT);
    const modeButton = ltr.document.querySelector(".yar-bar-top .yar-tools button")!;
    expect(modeButton.textContent).toBe("Paged");
    pressKey(ltr, "m");
    expect(modeButton.textContent).toBe("Spread");
    pressKey(ltr, "m");
    expect(modeButton.textContent).toBe("Scroll");
    pressKey(ltr, "m");
    expect(modeButton.textContent).toBe("Paged");

    const scroll = await startedReader("library/example-tower/issue-0001/");
    expect(scroll.document.querySelector(".yar-bar-top .yar-tools button")?.textContent).toBe("Scroll");
  });

  test("reading direction follows the curated series and can be toggled", async () => {
    const ltr = await startedReader(LTR_UNIT);
    const direction = () => ltr.document.querySelectorAll(".yar-bar-top .yar-tools button")[1]?.textContent;
    expect(direction()).toBe("LTR");
    pressKey(ltr, "d");
    expect(direction()).toBe("RTL");

    const rtl = await startedReader(RTL_UNIT);
    expect(rtl.document.querySelectorAll(".yar-bar-top .yar-tools button")[1]?.textContent).toBe("RTL");
  });

  test("right-to-left reading inverts the horizontal arrow keys", async () => {
    const rtl = await startedReader(RTL_UNIT);
    const counter = () => rtl.document.querySelector(".yar-counter")?.textContent;
    expect(counter()).toBe("1 / 3");
    pressKey(rtl, "ArrowLeft");
    expect(counter()).toBe("2 / 3");
    pressKey(rtl, "ArrowRight");
    expect(counter()).toBe("1 / 3");

    const ltr = await startedReader(LTR_UNIT);
    const ltrCounter = () => ltr.document.querySelector(".yar-counter")?.textContent;
    pressKey(ltr, "ArrowRight");
    expect(ltrCounter()).toBe("2 / 3");
    pressKey(ltr, "ArrowLeft");
    expect(ltrCounter()).toBe("1 / 3");
  });

  test("fit mode responds to its documented keys", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const fit = () => enhanced.document.querySelectorAll(".yar-bar-top .yar-tools button")[2]?.textContent;
    expect(fit()).toBe("Fit width");
    pressKey(enhanced, "p");
    expect(fit()).toBe("Fit page");
    pressKey(enhanced, "w");
    expect(fit()).toBe("Fit width");
  });

  test("typing in a reader field never triggers a page shortcut", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const jump = enhanced.document.querySelector<HTMLInputElement>("input.yar-jump")!;
    jump.dispatchEvent(new enhanced.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(enhanced.document.querySelector(".yar-counter")?.textContent).toBe("1 / 3");
  });

  test("the page control jumps directly to a requested page", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const jump = enhanced.document.querySelector<HTMLInputElement>("input.yar-jump")!;
    jump.value = "3";
    jump.onchange!(new enhanced.window.Event("change"));
    expect(enhanced.document.querySelector(".yar-counter")?.textContent).toBe("3 / 3");
  });

  test("an unknown unit path reports a catalog error instead of rendering", async () => {
    const enhanced = await enhancedDocument(fixture.root, path.join(fixture.root, LTR_UNIT, "index.html"));
    open.push(enhanced);
    readerModule(enhanced.window).start({ path: "library/not-a-real-unit/issue-9999/", root: UNIT_ROOT });
    expect(enhanced.document.querySelector(".yar-error h1")?.textContent).toBe("This unit is not in the catalog");
  });

  test("every reader control is keyboard operable", async () => {
    const { document } = await startedReader(LTR_UNIT);
    /*
     * `yar-stage` carries the pointer-only tap zones: the left third, right
     * third and centre of the page area. Each one repeats an action that the
     * keyboard tests above already drive, so it is a redundant affordance
     * rather than a control that only a pointer can reach.
     */
    assertKeyboardOperable(document.querySelector(".yar-app")!, ["yar-stage"]);
  });
});

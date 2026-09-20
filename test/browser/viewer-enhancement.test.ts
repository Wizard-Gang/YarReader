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

function isKeyboardFocusable(element: Element): boolean {
  return NATIVELY_FOCUSABLE.has(element.tagName) || element.getAttribute("tabindex") === "0";
}

/** Every click target must be keyboard reachable and expose a meaningful name. */
function assertKeyboardOperable(container: Element): void {
  const clickable = [...container.querySelectorAll("*")].filter(
    (element) => typeof (element as HTMLElement & { onclick?: unknown }).onclick === "function",
  );
  expect(clickable.length).toBeGreaterThan(0);

  const unfocusable = clickable.filter((element) => !isKeyboardFocusable(element));
  expect(unfocusable).toEqual([]);

  for (const element of clickable) {
    if (element.tagName === "BUTTON") expect(element.getAttribute("type")).toBe("button");
    if (element.tagName === "A") expect(element.getAttribute("href")).toBeTruthy();
    expect(element.getAttribute("tabindex")).not.toBe("-1");
    expect(
      element.getAttribute("aria-label") ||
        (element.textContent ?? "").trim() ||
        element.getAttribute("title") ||
        "",
    ).not.toBe("");
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
    expect(selects[0]?.getAttribute("aria-label")).toBe("Sort library");

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
    const tabsNav = document.querySelector("nav.yar-tabs")!;
    expect(tabsNav.getAttribute("aria-label")).toBe("Library views");
    const tabs = [...tabsNav.querySelectorAll<HTMLButtonElement>("button.yar-tab")];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Series", "Chapters"]);
    expect(tabs[0]!.className).toContain("yar-tab-on");
    expect(tabs.map((tab) => tab.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(3);

    tabs[1]!.click();
    const updatedTabs = [...document.querySelectorAll<HTMLButtonElement>("nav.yar-tabs button.yar-tab")];
    expect(updatedTabs.map((tab) => tab.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
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
    expect(document.querySelector("button.yar-format-button-on")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".yar-results .yar-card")).toHaveLength(1);
    expect(document.querySelector(".yar-results .yar-card-series")?.textContent).toBe("Example Mirror");
    expect(window.location.hash).toContain("format=rtl");
    const chip = document.querySelector(".yar-active-filters .yar-chip-active");
    expect(chip?.textContent).toContain("format: Manga");
    expect(chip?.getAttribute("aria-label")).toBe("Remove format filter: Manga");
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
    expect(document.querySelector("main#reader")?.getAttribute("aria-labelledby")).toBe("yar-reader-heading");
    expect(document.querySelector("h1#yar-reader-heading")?.textContent).toBe("Example Chapter 1");
    expect(document.querySelector(".yar-counter")?.textContent).toBe("1 / 3");
    expect(document.querySelector(".yar-counter")?.getAttribute("role")).toBe("status");
    expect(document.querySelector(".yar-toast")?.getAttribute("role")).toBe("status");

    const stage = document.querySelector<HTMLElement>(".yar-stage")!;
    expect(stage.getAttribute("role")).toBe("region");
    expect(stage.getAttribute("aria-label")).toBe("Reader pages");
    expect(stage.getAttribute("tabindex")).toBe("0");
    expect(stage.getAttribute("aria-keyshortcuts")).toContain("ArrowRight");

    const labels = [...document.querySelectorAll(".yar-bar-top .yar-tools button")].map((button) => button.getAttribute("title"));
    expect(labels).toEqual(["Reading mode (m)", "Reading direction (d)", "Fit mode (w / p)", "Zoom out", "Zoom in", "Fullscreen (f)"]);
    const accessibleLabels = [...document.querySelectorAll(".yar-bar-top .yar-tools button")].map((button) => button.getAttribute("aria-label"));
    expect(accessibleLabels).toEqual([
      "Reading mode: Paged",
      "Reading direction: left to right",
      "Fit mode: width",
      "Zoom out",
      "Zoom in",
      "Toggle fullscreen",
    ]);

    const slider = document.querySelector<HTMLInputElement>("input.yar-slider")!;
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("3");
    expect(slider.getAttribute("aria-label")).toBe("Jump to page");
    expect(slider.getAttribute("aria-valuetext")).toBe("Page 1 of 3");

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
    expect(rtl.document.documentElement.getAttribute("lang")).toBe("en");
    expect(rtl.document.documentElement.hasAttribute("dir")).toBe(false);
    expect(rtl.document.querySelector(".yar-app")?.getAttribute("data-direction")).toBe("rtl");
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

  test("focused native controls keep their native keyboard behavior", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const mode = enhanced.document.querySelector<HTMLButtonElement>(".yar-bar-top .yar-tools button")!;
    mode.focus();
    const accepted = mode.dispatchEvent(
      new enhanced.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    );
    expect(accepted).toBe(true);
    expect(enhanced.document.querySelector(".yar-counter")?.textContent).toBe("1 / 3");
    expect(mode.textContent).toBe("Paged");
  });

  test("the page region is keyboard reachable without pointer input", async () => {
    const enhanced = await startedReader(LTR_UNIT);
    const stage = enhanced.document.querySelector<HTMLElement>(".yar-stage")!;
    stage.focus();
    stage.dispatchEvent(
      new enhanced.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
    expect(enhanced.document.querySelector(".yar-counter")?.textContent).toBe("2 / 3");
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

  test("every reader action is keyboard reachable and named", async () => {
    const { document } = await startedReader(LTR_UNIT);
    assertKeyboardOperable(document.querySelector(".yar-app")!);
  });
});

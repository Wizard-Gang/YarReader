import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UnitRecord } from "./domain.js";
import type { ViewerAssets } from "./export-assets.js";
import { PORTABLE_CSP } from "./export-security.js";

export function unitTitle(unit: UnitRecord): string {
  if (unit.title) return unit.title;
  const number = unit.chapter ?? unit.issue ?? unit.volume ?? unit.sequence;
  const label = unit.unitType.charAt(0).toUpperCase() + unit.unitType.slice(1);
  return number === undefined ? label : `${label} ${number}`;
}

function staticDocument(element: ReactNode): string {
  return `<!doctype html>\n${renderToStaticMarkup(element)}\n`;
}

function securityMeta(): ReactNode {
  return createElement("meta", { httpEquiv: "Content-Security-Policy", content: PORTABLE_CSP });
}

function viewerStyleLinks(viewer: ViewerAssets, prefix: string): ReactNode[] {
  return viewer.styles.map((style) =>
    createElement("link", {
      key: style,
      rel: "stylesheet",
      href: prefix + style
    })
  );
}

function LibrarySections({ units }: { units: readonly UnitRecord[] }): ReactNode {
  const groups = new Map<string, UnitRecord[]>();
  for (const unit of units) {
    const group = groups.get(unit.series) ?? [];
    group.push(unit);
    groups.set(unit.series, group);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true, sensitivity: "base" }))
    .map(([series, members]) =>
      createElement(
        "section",
        { key: series },
        createElement("h2", null, series),
        createElement(
          "ol",
          null,
          ...members.map((unit) =>
            createElement(
              "li",
              { key: unit.id },
              createElement("a", { href: path.posix.join("library", unit.id, "index.html") }, unitTitle(unit))
            )
          )
        )
      )
    );
}

function RootDocument({ units, viewer }: { units: readonly UnitRecord[]; viewer: ViewerAssets }): ReactNode {
  return createElement(
    "html",
    { lang: "en" },
    createElement(
      "head",
      null,
      createElement("meta", { charSet: "utf-8" }),
      createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }),
      createElement("meta", { name: "color-scheme", content: "dark light" }),
      createElement("meta", { name: "generator", content: "YarReader" }),
      securityMeta(),
      createElement("title", null, "YarReader"),
      createElement("link", { rel: "icon", href: "./assets/favicon.svg", type: "image/svg+xml" }),
      ...viewerStyleLinks(viewer, "./")
    ),
    createElement(
      "body",
      { className: "yar-library-body" },
      createElement("h1", null, "YarReader"),
      createElement(
        "main",
        {
          id: "library",
          "data-library": "",
          "data-yar-start": "library",
          "data-yar-root": "./",
          "data-yar-label": "YarReader",
          className: "yar-static-library"
        },
        createElement(LibrarySections, { units })
      ),
      createElement("script", { src: "./catalog.js" }),
      createElement("script", { src: `./${viewer.script}` })
    )
  );
}

function UnitDocument({
  unit,
  rootPrefix,
  pageNames,
  viewer
}: {
  unit: UnitRecord;
  rootPrefix: string;
  pageNames: readonly string[];
  viewer: ViewerAssets;
}): ReactNode {
  const itemPath = `library/${unit.id}/`;
  return createElement(
    "html",
    { lang: "en", "data-yar-unit": itemPath },
    createElement(
      "head",
      null,
      createElement("meta", { charSet: "utf-8" }),
      createElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }),
      createElement("meta", { name: "color-scheme", content: "dark light" }),
      createElement("meta", { name: "generator", content: "YarReader" }),
      securityMeta(),
      createElement("title", null, `${unit.series} - ${unitTitle(unit)}`),
      createElement("link", { rel: "icon", href: `${rootPrefix}assets/favicon.svg`, type: "image/svg+xml" }),
      ...viewerStyleLinks(viewer, rootPrefix)
    ),
    createElement(
      "body",
      { className: "yar-reader-body" },
      createElement(
        "main",
        {
          id: "reader",
          className: "reader-fallback",
          "data-pages": "",
          "data-yar-start": "reader",
          "data-yar-path": itemPath,
          "data-yar-root": rootPrefix,
          "aria-labelledby": "reader-title"
        },
        createElement(
          "header",
          null,
          createElement("a", { href: `${rootPrefix}index.html` }, "Library"),
          createElement("span", { "aria-hidden": "true" }, " · "),
          createElement("span", null, unit.series),
          createElement("span", { "aria-hidden": "true" }, " · "),
          createElement("h1", { id: "reader-title", className: "yar-static-reader-title" }, unitTitle(unit))
        ),
        ...pageNames.map((page, index) =>
          createElement("img", {
            key: page,
            src: `pages/${page}`,
            loading: index === 0 ? "eager" : "lazy",
            decoding: "async",
            alt: `Page ${index + 1} of ${pageNames.length}`
          })
        )
      ),
      createElement("script", { src: `${rootPrefix}catalog.js` }),
      createElement("script", { src: `${rootPrefix}${viewer.script}` })
    )
  );
}

export function renderRootHtml(units: readonly UnitRecord[], viewer: ViewerAssets): string {
  return staticDocument(createElement(RootDocument, { units, viewer }));
}

export function renderLeafHtml(
  unit: UnitRecord,
  rootPrefix: string,
  pageNames: readonly string[],
  viewer: ViewerAssets
): string {
  return staticDocument(createElement(UnitDocument, { unit, rootPrefix, pageNames, viewer }));
}

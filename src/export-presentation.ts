import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UnitRecord } from "./domain.js";
import type { ViewerAssets } from "./export-assets.js";

const FALLBACK_CSS = `:root{color-scheme:dark;background:#111;color:#eee;font:16px system-ui,sans-serif}body{margin:0 auto;max-width:80rem;padding:1rem}a{color:#9bd}.yar-static-library section{border-top:1px solid #333;margin-top:1rem}.yar-static-library ol{line-height:1.7}.yar-reader-body{max-width:none;padding:0}.reader-fallback header{position:sticky;top:0;background:#111e;padding:.6rem;z-index:2}.reader-fallback img{display:block;max-width:100%;height:auto;margin:0 auto}`;

function jsString(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function unitTitle(unit: UnitRecord): string {
  if (unit.title) return unit.title;
  const number = unit.chapter ?? unit.issue ?? unit.volume ?? unit.sequence;
  const label = unit.unitType.charAt(0).toUpperCase() + unit.unitType.slice(1);
  return number === undefined ? label : `${label} ${number}`;
}

function staticDocument(element: ReactNode): string {
  return `<!doctype html>\n${renderToStaticMarkup(element)}\n`;
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
      createElement("title", null, "YarReader"),
      createElement("link", { rel: "icon", href: "./assets/favicon.svg", type: "image/svg+xml" }),
      createElement("style", { dangerouslySetInnerHTML: { __html: FALLBACK_CSS } }),
      ...viewerStyleLinks(viewer, "./")
    ),
    createElement(
      "body",
      { className: "yar-library-body" },
      createElement("h1", null, "YarReader"),
      createElement(
        "main",
        { id: "library", "data-library": "", className: "yar-static-library" },
        createElement(LibrarySections, { units })
      ),
      createElement("script", { src: "./catalog.js" }),
      createElement("script", { src: `./${viewer.script}` }),
      createElement("script", {
        dangerouslySetInnerHTML: { __html: '\n  ComicLibrary.start({ root: "./", label: "YarReader" });\n' }
      })
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
      createElement("title", null, `${unit.series} - ${unitTitle(unit)}`),
      createElement("link", { rel: "icon", href: `${rootPrefix}assets/favicon.svg`, type: "image/svg+xml" }),
      createElement("style", { dangerouslySetInnerHTML: { __html: FALLBACK_CSS } }),
      ...viewerStyleLinks(viewer, rootPrefix)
    ),
    createElement(
      "body",
      { className: "yar-reader-body" },
      createElement(
        "main",
        { id: "reader", className: "reader-fallback", "data-pages": "" },
        createElement(
          "header",
          null,
          createElement("a", { href: `${rootPrefix}index.html` }, "Library"),
          " · ",
          unit.series
        ),
        ...pageNames.map((page, index) =>
          createElement("img", {
            key: page,
            src: `pages/${page}`,
            loading: index === 0 ? "eager" : "lazy",
            decoding: "async",
            alt: `Page ${index + 1}`
          })
        )
      ),
      createElement("script", { src: `${rootPrefix}catalog.js` }),
      createElement("script", { src: `${rootPrefix}${viewer.script}` }),
      createElement("script", {
        dangerouslySetInnerHTML: {
          __html: `\n  ComicReader.start({ path: ${jsString(itemPath)}, root: ${jsString(rootPrefix)} });\n`
        }
      })
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

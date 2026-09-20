import assert from "node:assert/strict";
import test from "node:test";
import { assertPortableHtmlSecurity, PORTABLE_CSP } from "../src/export-security.js";

const SAFE = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${PORTABLE_CSP}"><link rel="stylesheet" href="./viewer.css"></head><body><main data-yar-start="library"></main><script src="./catalog.js"></script><script src="./viewer.js"></script></body></html>`;

test("portable HTML security accepts external-only local content", () => {
  assert.doesNotThrow(() => assertPortableHtmlSecurity(SAFE, "safe.html"));
});

test("portable HTML security accepts React-escaped CSP serialization", () => {
  const serialized = SAFE.replace(PORTABLE_CSP, PORTABLE_CSP.replaceAll("'", "&#x27;"));
  assert.doesNotThrow(() => assertPortableHtmlSecurity(serialized, "react-static.html"));
});

for (const [name, mutation, expected] of [
  ["inline script", '<script>window.bad = true</script>', /inline script/],
  ["style element", "<style>body{display:none}</style>", /style element/],
  ["style attribute", '<div style="display:none"></div>', /style attribute/],
  ["event handler", '<button onclick="bad()">bad</button>', /event handler/],
  ["javascript URL", '<a href="javascript:bad()">bad</a>', /javascript: URL/],
] as const) {
  test(`portable HTML security rejects ${name}`, () => {
    assert.throws(
      () => assertPortableHtmlSecurity(SAFE.replace("</body>", `${mutation}</body>`), "bad.html"),
      expected,
    );
  });
}

test("portable HTML security rejects a missing or unsafe-inline CSP", () => {
  assert.throws(
    () => assertPortableHtmlSecurity(SAFE.replace(PORTABLE_CSP, "default-src 'self'; script-src 'unsafe-inline'"), "bad-csp.html"),
    /required Content Security Policy|unsafe inline/,
  );
});

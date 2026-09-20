export const PORTABLE_CSP = "default-src 'none'; script-src 'self' file:; style-src 'self' file:; img-src 'self' file: data:; font-src 'self' file:; media-src 'self' file:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'";

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function hasRequiredCsp(html: string): boolean {
  const meta = /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html)?.[0];
  if (!meta) return false;
  const content = /\bcontent=(["'])(.*?)\1/i.exec(meta)?.[2];
  return content !== undefined && decodeHtmlAttribute(content) === PORTABLE_CSP;
}

export function assertPortableHtmlSecurity(html: string, label: string): void {
  if (!hasRequiredCsp(html)) throw new Error(`Portable HTML is missing the required Content Security Policy: ${label}`);
  if (/['"]unsafe-inline['"]/i.test(html)) throw new Error(`Portable HTML CSP allows unsafe inline content: ${label}`);
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>/i.test(html)) throw new Error(`Portable HTML contains an executable inline script: ${label}`);
  if (/<style\b/i.test(html)) throw new Error(`Portable HTML contains an inline style element: ${label}`);
  if (/\sstyle\s*=/i.test(html)) throw new Error(`Portable HTML contains an inline style attribute: ${label}`);
  if (/\son[a-z0-9_-]+\s*=/i.test(html)) throw new Error(`Portable HTML contains an inline event handler: ${label}`);
  if (/\b(?:href|src)\s*=\s*["']\s*javascript:/i.test(html)) throw new Error(`Portable HTML contains a javascript: URL: ${label}`);
}

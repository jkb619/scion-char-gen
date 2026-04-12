/**
 * Build an absolute URL for this app’s HTTP APIs.
 * Uses `document.baseURI` (the page’s URL, including any path prefix) so `api/bundle` resolves next to
 * the app root the user actually opened — not the host root, which breaks behind reverse proxies.
 * Falls back to resolving from this module path when `document` is unavailable.
 *
 * @param {string} path — e.g. `api/bundle` or `api/data/tags` (leading slash optional)
 */
export function apiUrl(path) {
  const p = String(path).replace(/^\//, "");
  if (typeof document !== "undefined" && document.baseURI) {
    const base = document.baseURI.endsWith("/") ? document.baseURI : `${document.baseURI}/`;
    return new URL(p, base).href;
  }
  return new URL(`../../${p}`, import.meta.url).href;
}

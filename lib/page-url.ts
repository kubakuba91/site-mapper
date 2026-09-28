import type { CrawledPage } from "./types";
export function manualPage(raw: string, baseUrl: string): CrawledPage {
  const path = raw.trim();
  if (
    !path ||
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  )
    throw new Error("Enter a site-relative path, such as /about");
  const base = new URL(baseUrl);
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base.origin);
  url.hash = "";
  if (url.origin !== base.origin)
    throw new Error("Page must belong to this site");
  return {
    url: url.href,
    path: url.pathname + url.search,
    title: null,
    description: null,
    statusCode: 0,
  };
}

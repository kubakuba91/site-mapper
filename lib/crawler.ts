import { XMLParser } from "fast-xml-parser";
import type { BasicAuth, CrawlError, CrawledPage } from "./types";

const DEFAULT_PAGE_LIMIT = 200;
const DEFAULT_DEPTH_LIMIT = 4;
const REQUEST_TIMEOUT_MS = 15000;
const CONCURRENCY = 8;

function authHeaders(auth?: BasicAuth): HeadersInit {
  if (!auth || (!auth.username && !auth.password)) return {};
  const token = Buffer.from(`${auth.username ?? ""}:${auth.password ?? ""}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function fetchWithTimeout(url: string, auth?: BasicAuth): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { ...authHeaders(auth), "User-Agent": "redirect-mapper/1.0" },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

function toAbsoluteUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function isSameOrigin(base: string, target: string): boolean {
  try {
    return new URL(base).origin === new URL(target).origin;
  } catch {
    return false;
  }
}

function extractInternalLinks(html: string, pageUrl: string): string[] {
  const links = new Set<string>();
  const hrefRegex = /<a\s+[^>]*href\s*=\s*["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
    const abs = toAbsoluteUrl(pageUrl, raw);
    if (abs && isSameOrigin(pageUrl, abs)) links.add(abs);
  }
  return Array.from(links);
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

function extractMetaDescription(html: string): string | null {
  const m =
    /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i.exec(html) ||
    /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i.exec(html);
  return m ? m[1].trim() : null;
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

async function fetchSitemapUrls(sitemapUrl: string, auth: BasicAuth | undefined, seen: Set<string>): Promise<string[]> {
  if (seen.has(sitemapUrl)) return [];
  seen.add(sitemapUrl);

  let res: Response;
  try {
    res = await fetchWithTimeout(sitemapUrl, auth);
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.sitemapindex) {
    const idx = obj.sitemapindex as Record<string, unknown>;
    const entries = Array.isArray(idx.sitemap) ? idx.sitemap : idx.sitemap ? [idx.sitemap] : [];
    const childUrls: string[] = [];
    for (const entry of entries as Record<string, unknown>[]) {
      const loc = entry?.loc;
      if (typeof loc === "string") {
        const nested = await fetchSitemapUrls(loc, auth, seen);
        childUrls.push(...nested);
      }
    }
    return childUrls;
  }

  if (obj.urlset) {
    const urlset = obj.urlset as Record<string, unknown>;
    const entries = Array.isArray(urlset.url) ? urlset.url : urlset.url ? [urlset.url] : [];
    const urls: string[] = [];
    for (const entry of entries as Record<string, unknown>[]) {
      const loc = entry?.loc;
      if (typeof loc === "string") urls.push(loc);
    }
    return urls;
  }

  return [];
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
}

async function fetchPageDetails(
  url: string,
  auth: BasicAuth | undefined,
  pages: CrawledPage[],
  errors: CrawlError[],
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, auth);
    if (!res.ok) {
      errors.push({ url, reason: `HTTP ${res.status}` });
      pages.push({ url, path: pathOf(url), title: null, description: null, statusCode: res.status });
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      pages.push({ url, path: pathOf(url), title: null, description: null, statusCode: res.status });
      return null;
    }
    const html = await res.text();
    pages.push({
      url,
      path: pathOf(url),
      title: extractTitle(html),
      description: extractMetaDescription(html),
      statusCode: res.status,
    });
    return html;
  } catch (err) {
    const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "fetch failed";
    errors.push({ url, reason });
    pages.push({ url, path: pathOf(url), title: null, description: null, statusCode: 0 });
    return null;
  }
}

export async function crawlSite(
  baseUrl: string,
  auth?: BasicAuth,
  options?: { pageLimit?: number; depthLimit?: number },
): Promise<{ pages: CrawledPage[]; errors: CrawlError[] }> {
  const pageLimit = options?.pageLimit ?? DEFAULT_PAGE_LIMIT;
  const depthLimit = options?.depthLimit ?? DEFAULT_DEPTH_LIMIT;

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const pages: CrawledPage[] = [];
  const errors: CrawlError[] = [];

  const sitemapUrls = await fetchSitemapUrls(`${normalizedBase}/sitemap.xml`, auth, new Set());
  const uniqueSitemapUrls = Array.from(new Set(sitemapUrls)).slice(0, pageLimit);

  if (uniqueSitemapUrls.length > 0) {
    await runWithConcurrency(uniqueSitemapUrls, CONCURRENCY, async (url) => {
      await fetchPageDetails(url, auth, pages, errors);
    });
    return { pages, errors };
  }

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: normalizedBase, depth: 0 }];
  visited.add(normalizedBase);

  while (queue.length > 0 && pages.length < pageLimit) {
    const batch = queue.splice(0, CONCURRENCY);

    await runWithConcurrency(batch, CONCURRENCY, async ({ url, depth }) => {
      if (pages.length >= pageLimit) return;
      const html = await fetchPageDetails(url, auth, pages, errors);
      if (!html || depth >= depthLimit) return;

      const links = extractInternalLinks(html, url);
      for (const link of links) {
        const normalizedLink = link.endsWith("/") && link !== `${normalizedBase}/` ? link.slice(0, -1) : link;
        const key = normalizedLink === `${normalizedBase}/` ? normalizedBase : normalizedLink;
        if (!visited.has(key) && visited.size < pageLimit * 4) {
          visited.add(key);
          queue.push({ url: key, depth: depth + 1 });
        }
      }
    });
  }

  const seenPaths = new Set<string>();
  const dedupedPages = pages.filter((page) => {
    if (seenPaths.has(page.path)) return false;
    seenPaths.add(page.path);
    return true;
  });

  return { pages: dedupedPages, errors };
}

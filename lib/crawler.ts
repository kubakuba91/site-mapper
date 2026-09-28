import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { createSafeFetcher, publicUrl, type FetchText } from "./safe-fetch";
import type { BasicAuth, CrawlError, CrawledPage } from "./types";

export function parseHtml(html: string, pageUrl: string) {
  const $ = load(html);
  const title = $("title").first().text().trim().replace(/\s+/g, " ") || null;
  const description =
    $("meta")
      .filter(
        (_, el) => ($(el).attr("name") ?? "").toLowerCase() === "description",
      )
      .first()
      .attr("content")
      ?.trim() ?? null;
  let documentBase = pageUrl;
  try {
    documentBase = new URL(
      $("base[href]").first().attr("href") ?? pageUrl,
      pageUrl,
    ).href;
  } catch {
    /* ignore invalid base */
  }
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    try {
      const target = new URL($(el).attr("href")!, documentBase);
      target.hash = "";
      if (
        ["http:", "https:"].includes(target.protocol) &&
        target.origin === new URL(pageUrl).origin
      )
        links.add(target.href);
    } catch {
      /* ignore malformed links */
    }
  });
  return { title, description, links: [...links] };
}
export async function crawlSite(
  baseUrl: string,
  auth?: BasicAuth,
  options?: {
    pageLimit?: number;
    depthLimit?: number;
    signal?: AbortSignal;
    fetcher?: FetchText;
    deadlineMs?: number;
  },
): Promise<{ pages: CrawledPage[]; errors: CrawlError[]; warnings: string[] }> {
  const base = publicUrl(baseUrl);
  const pageLimit = options?.pageLimit ?? 200;
  const depthLimit = options?.depthLimit ?? 4;
  const signal = AbortSignal.any([
    options?.signal ?? new AbortController().signal,
    AbortSignal.timeout(options?.deadlineMs ?? 240_000),
  ]);
  const fetcher = options?.fetcher ?? createSafeFetcher(base.origin, auth);
  const pages: CrawledPage[] = [];
  const errors: CrawlError[] = [];
  const warnings = new Set<string>();
  const sitemapSeen = new Set<string>();
  const sitemapPages = new Set<string>();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
    maxNestedTags: 50,
  });
  async function sitemap(url: string, depth: number): Promise<void> {
    if (sitemapSeen.has(url)) return;
    if (depth > 4 || sitemapSeen.size >= 20 || sitemapPages.size >= pageLimit) {
      warnings.add("Sitemap limits reached; the inventory may be incomplete.");
      return;
    }
    if (new URL(url).origin !== base.origin) {
      warnings.add("Cross-origin sitemap entries were skipped.");
      return;
    }
    sitemapSeen.add(url);
    try {
      signal.throwIfAborted();
      const response = await fetcher(url, signal);
      if (response.status >= 400) return;
      if (/<!DOCTYPE|<!ENTITY/i.test(response.text))
        throw new Error("Sitemap DTDs are not supported");
      const parsed = parser.parse(response.text);
      const entries = (value: unknown): { loc?: unknown }[] =>
        Array.isArray(value)
          ? value
          : value && typeof value === "object"
            ? [value]
            : [];
      for (const item of entries(parsed?.sitemapindex?.sitemap)) {
        if (typeof item.loc === "string")
          await sitemap(new URL(item.loc, response.url).href, depth + 1);
      }
      for (const item of entries(parsed?.urlset?.url)) {
        if (typeof item.loc !== "string") continue;
        const target = publicUrl(new URL(item.loc, response.url).href);
        if (target.origin !== base.origin) {
          warnings.add("Cross-origin sitemap entries were skipped.");
          continue;
        }
        if (sitemapPages.size >= pageLimit) {
          warnings.add(
            `Page limit (${pageLimit}) reached; the inventory may be incomplete.`,
          );
          break;
        }
        sitemapPages.add(target.href);
      }
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      warnings.add(
        `Sitemap skipped: ${err instanceof Error ? err.message : "request failed"}`,
      );
    }
  }
  await sitemap(new URL("/sitemap.xml", base).href, 0);
  const usingSitemap = sitemapPages.size > 0;
  const queue = (usingSitemap ? [...sitemapPages] : [base.href]).map((url) => ({
    url,
    depth: 0,
  }));
  const visited = new Set(queue.map((item) => item.url));
  let processed = 0;
  const pagePaths = new Set<string>();
  while (queue.length && processed < pageLimit) {
    signal.throwIfAborted();
    const batch = queue.splice(0, Math.min(8, pageLimit - processed));
    processed += batch.length;
    const results = await Promise.all(
      batch.map(async ({ url, depth }) => {
        const path = new URL(url).pathname + new URL(url).search;
        try {
          const response = await fetcher(url, signal);
          const details =
            response.contentType.toLowerCase().includes("text/html") &&
            response.status < 400
              ? parseHtml(response.text, response.url)
              : null;
          if (response.status >= 400)
            errors.push({ url, reason: `HTTP ${response.status}` });
          if (details && !usingSitemap) {
            if (
              depth >= depthLimit &&
              details.links.some((link) => !visited.has(link))
            )
              warnings.add(
                `Depth limit (${depthLimit}) reached; the inventory may be incomplete.`,
              );
            else if (depth < depthLimit)
              for (const link of details.links) {
                if (visited.has(link)) continue;
                if (visited.size >= pageLimit * 4) {
                  warnings.add(
                    "Discovery limit reached; the inventory may be incomplete.",
                  );
                  break;
                }
                visited.add(link);
                queue.push({ url: link, depth: depth + 1 });
              }
          }
          return {
            url,
            path,
            title: details?.title ?? null,
            description: details?.description ?? null,
            statusCode: response.status,
          };
        } catch (err) {
          if (signal.aborted) throw signal.reason;
          errors.push({
            url,
            reason: err instanceof Error ? err.message : "Request failed",
          });
          return { url, path, title: null, description: null, statusCode: 0 };
        }
      }),
    );
    for (const page of results) {
      if (!pagePaths.has(page.path)) {
        pagePaths.add(page.path);
        pages.push(page);
      }
    }
  }
  if (queue.length)
    warnings.add(
      `Page limit (${pageLimit}) reached; the inventory may be incomplete.`,
    );
  return { pages, errors, warnings: [...warnings] };
}

import test from "node:test";
import assert from "node:assert/strict";
import { crawlSite, parseHtml } from "../lib/crawler";
import { isPublicAddress, publicUrl } from "../lib/safe-fetch";
import { validateCrawlRequest, readSmallJson } from "../lib/crawl-request";
import { manualPage } from "../lib/page-url";
import { buildExportCsv } from "../lib/csv";
import { validateSnapshot } from "../lib/sessions";
import type { FetchText } from "../lib/safe-fetch";

const html = (url: string, text: string, status = 200) => ({
  url,
  text,
  status,
  contentType: "text/html",
});
test("SSRF: reject private, mapped, reserved and nonstandard URL destinations", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const url of [
    "http://localhost",
    "http://127.1",
    "http://2130706433",
    "http://[::ffff:127.0.0.1]",
    "http://user:pass@example.com",
    "file:///tmp/test",
    "https://example.com:444",
  ])
    assert.throws(() => publicUrl(url), url);
  assert.equal(isPublicAddress("1.1.1.1"), true);
});
test("request validation rejects null, numbers, invalid auth and oversized bodies", async () => {
  for (const input of [
    null,
    [],
    {},
    { baseUrl: 123 },
    { baseUrl: "https://example.com", auth: null },
    { baseUrl: "https://example.com", auth: { username: 1 } },
  ])
    assert.throws(() => validateCrawlRequest(input));
  assert.equal(
    validateCrawlRequest({ baseUrl: " https://example.com " }).baseUrl,
    "https://example.com/",
  );
  await assert.rejects(
    readSmallJson(
      new Request("http://app/", {
        method: "POST",
        body: '"' + "x".repeat(5000) + '"',
      }),
    ),
    /4 KB/,
  );
});
test("HTML parsing preserves apostrophes, decodes entities, and resolves directory links", () => {
  const page = parseHtml(
    `<title>Dogs &amp; Cats</title><meta content="It's a great &amp; useful page" name=description><a href=child>Child</a>`,
    "https://example.com/target/",
  );
  assert.equal(page.title, "Dogs & Cats");
  assert.equal(page.description, "It's a great & useful page");
  assert.deepEqual(page.links, ["https://example.com/target/child"]);
});
test("crawler resolves links against final redirect URL and does not strip slash", async () => {
  const requests: string[] = [];
  const fetcher: FetchText = async (url) => {
    requests.push(url);
    if (url.endsWith("sitemap.xml")) return html(url, "", 404);
    if (url.endsWith("/moved"))
      return html("https://example.com/target/", '<a href="child">Child</a>');
    return html(url, "<title>Child</title>");
  };
  const result = await crawlSite("https://example.com/moved", undefined, {
    fetcher,
  });
  assert.deepEqual(
    result.pages.map((p) => p.path),
    ["/moved", "/target/child"],
  );
  assert.ok(!requests.includes("https://example.com/child"));
});
test("sitemap cross-origin pages and nested sitemaps are never fetched", async () => {
  const requests: string[] = [];
  const fetcher: FetchText = async (url) => {
    requests.push(url);
    return url.endsWith("sitemap.xml")
      ? {
          ...html(
            url,
            "<sitemapindex><sitemap><loc>https://other.test/child.xml</loc></sitemap><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>",
          ),
          contentType: "application/xml",
        }
      : url.endsWith("pages.xml")
        ? {
            ...html(
              url,
              "<urlset><url><loc>https://other.test/collect</loc></url><url><loc>https://example.com/about</loc></url></urlset>",
            ),
            contentType: "application/xml",
          }
        : html(url, "ok");
  };
  const result = await crawlSite(
    "https://example.com",
    { username: "test", password: "dummy" },
    { fetcher },
  );
  assert.ok(
    requests.every((url) => new URL(url).origin === "https://example.com"),
  );
  assert.equal(result.pages[0].path, "/about");
  assert.ok(result.warnings.length > 0);
});
test("concurrent crawler respects exact page cap and reports truncation", async () => {
  const fetcher: FetchText = async (url) =>
    url.endsWith("sitemap.xml")
      ? html(url, "", 404)
      : html(
          url,
          url === "https://example.com/"
            ? Array.from(
                { length: 30 },
                (_, i) => `<a href="/p${i}">P</a>`,
              ).join("")
            : "ok",
        );
  const result = await crawlSite("https://example.com", undefined, {
    fetcher,
    pageLimit: 10,
  });
  assert.equal(result.pages.length, 10);
  assert.match(result.warnings.join(), /Page limit/);
});
test("DTD is rejected and recursive sitemap discovery is bounded", async () => {
  let count = 0;
  const fetcher: FetchText = async (url) => {
    count++;
    return {
      ...html(
        url,
        `<sitemapindex><sitemap><loc>https://example.com/${count}.xml</loc></sitemap></sitemapindex>`,
      ),
      contentType: "application/xml",
    };
  };
  const result = await crawlSite("https://example.com", undefined, { fetcher });
  assert.ok(count <= 6);
  assert.match(result.warnings.join(), /Sitemap limits/);
  const dtd = await crawlSite("https://example.com", undefined, {
    fetcher: async (url) =>
      html(url, url.endsWith("sitemap.xml") ? "<!DOCTYPE foo><urlset/>" : "ok"),
  });
  assert.match(dtd.warnings.join(), /DTDs/);
});
test("manual paths form correct URLs without double slashes", () => {
  for (const base of [
    "https://example.com",
    "https://example.com/",
    "https://example.com/sub/",
  ])
    assert.equal(manualPage("/about", base).url, "https://example.com/about");
  for (const path of ["//evil.test", "https://evil.test", "\\evil.test"])
    assert.throws(() => manualPage(path, "https://example.com"));
});
test("CSV review export neutralizes formulas; raw export preserves literal metadata", () => {
  const page = {
    ...manualPage("/", "https://example.com"),
    title: "=1+1",
    description: "line\rbreak",
  };
  assert.match(buildExportCsv([page], [], []), /,'=1\+1,/);
  assert.match(buildExportCsv([page], [], [], false), /,=1\+1,/);
  assert.match(buildExportCsv([page], [], []), /"line\rbreak"/);
});
test("shared snapshots reject executable URLs and missing mapping destinations", () => {
  const old = manualPage("/", "https://old.test"),
    next = manualPage("/", "https://new.test");
  const s = {
    oldBaseUrl: "https://old.test",
    newBaseUrl: "https://new.test",
    oldPages: [old],
    newPages: [next],
    mappings: [{ oldPath: "/", newPath: "/", status: "matched" }],
  };
  validateSnapshot(s);
  assert.throws(() => validateSnapshot({ ...s, newPages: [] }));
  assert.throws(() =>
    validateSnapshot({
      ...s,
      newPages: [{ ...next, url: "javascript:alert(1)" }],
    }),
  );
});

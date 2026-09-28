import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import dns from "node:dns/promises";
import { createSafeFetcher } from "../lib/safe-fetch";

test("transport pins DNS, scopes auth, revalidates redirects, and bounds slow/large bodies", async (t) => {
  const received: { path: string; auth: string | undefined }[] = [];
  const server = http.createServer((req, res) => {
    received.push({ path: req.url!, auth: req.headers.authorization });
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "http://other.test/final" });
      res.end();
      return;
    }
    if (req.url === "/private") {
      res.writeHead(302, { Location: "http://127.0.0.1/secret" });
      res.end();
      return;
    }
    if (req.url === "/slow") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("first chunk");
      return;
    }
    if (req.url === "/large") {
      res.end("x".repeat(2_000_001));
      return;
    }
    if (req.url === "/medium") {
      res.end("x".repeat(1_900_000));
      return;
    }
    res.end("done");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  const original = http.request;
  let pinned = 0;
  let resolutions = 0;
  t.mock.method(dns, "lookup", async () => {
    resolutions++;
    return [{ address: "93.184.216.34", family: 4 }];
  });
  // Exercise the real request/body reader against local fixtures; only the socket destination is substituted.
  t.mock.method(
    http,
    "request",
    (
      url: URL,
      options: http.RequestOptions,
      callback: (res: http.IncomingMessage) => void,
    ) => {
      assert.ok(options.lookup);
      options.lookup("ignored.test", {}, (err, ip) => {
        assert.equal(err, null);
        assert.equal(ip, "93.184.216.34");
        pinned++;
      });
      return original(
        new URL(`http://127.0.0.1:${port}${url.pathname}`),
        { ...options, lookup: undefined },
        callback,
      );
    },
  );
  try {
    const fetcher = createSafeFetcher("http://origin.test", {
      username: "qa",
      password: "dummy",
    });
    const result = await fetcher(
      "http://origin.test/redirect",
      new AbortController().signal,
    );
    assert.equal(result.url, "http://other.test/final");
    assert.ok(received.find((r) => r.path === "/redirect")?.auth);
    assert.equal(received.find((r) => r.path === "/final")?.auth, undefined);
    assert.equal(pinned, 2);
    assert.equal(resolutions, 2);
    await assert.rejects(
      fetcher("http://origin.test/private", new AbortController().signal),
      /Private network/,
    );
    assert.ok(!received.some((r) => r.path === "/secret"));
    await assert.rejects(
      fetcher("http://origin.test/slow", AbortSignal.timeout(100)),
      /abort/i,
    );
    await assert.rejects(
      fetcher("http://origin.test/large", new AbortController().signal),
      /2 MB/,
    );
    const budgeted = createSafeFetcher("http://origin.test");
    for (let index = 0; index < 10; index++) {
      await budgeted("http://origin.test/medium", new AbortController().signal);
    }
    await assert.rejects(
      budgeted("http://origin.test/medium", new AbortController().signal),
      /20 MB/,
    );
    const requestsBefore = received.length;
    await assert.rejects(
      budgeted("http://origin.test/after-limit", new AbortController().signal),
      /20 MB/,
    );
    assert.equal(received.length, requestsBefore);
    t.mock.method(dns, "lookup", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await assert.rejects(
      fetcher("http://origin.test/rebound", new AbortController().signal),
      /Private network/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

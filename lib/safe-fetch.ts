import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import type { BasicAuth } from "./types";

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function publicUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP(S) URL without embedded credentials");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Only standard HTTP(S) ports are supported");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (ipaddr.isValid(hostname) && !isPublicAddress(hostname))
  )
    throw new Error("Private network destinations are not allowed");
  url.hash = "";
  return url;
}
export type FetchedText = {
  url: string;
  status: number;
  contentType: string;
  text: string;
};
export type FetchText = (
  url: string,
  signal: AbortSignal,
) => Promise<FetchedText>;
// Pin each socket to a validated DNS result: no second lookup, including on redirects.
export async function resolvePublic(hostname: string) {
  const addresses = await lookup(hostname.replace(/^\[|\]$/g, ""), {
    all: true,
    verbatim: true,
  });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error("Private network destinations are not allowed");
  return addresses[0];
}
export function createSafeFetcher(
  authOrigin: string,
  auth?: BasicAuth,
): FetchText {
  let totalBytes = 0;
  return async (raw, parentSignal) => {
    if (totalBytes >= 20_000_000)
      throw new Error("Crawl exceeds the 20 MB download limit");
    const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(45_000)]);
    let url = publicUrl(raw);
    for (let redirects = 0; redirects <= 5; redirects++) {
      signal.throwIfAborted();
      const address = await new Promise<
        Awaited<ReturnType<typeof resolvePublic>>
      >((resolve, reject) => {
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        resolvePublic(url.hostname)
          .then(resolve, reject)
          .finally(() => signal.removeEventListener("abort", abort));
      });
      signal.throwIfAborted();
      const response = await new Promise<FetchedText & { location?: string }>(
        (resolve, reject) => {
          const headers: Record<string, string> = {
            "User-Agent": "Relay301/1.0",
            "Accept-Encoding": "identity",
          };
          if (
            url.origin === authOrigin &&
            auth &&
            (auth.username || auth.password)
          )
            headers.Authorization = `Basic ${Buffer.from(`${auth.username ?? ""}:${auth.password ?? ""}`).toString("base64")}`;
          const request = (url.protocol === "https:" ? https : http).request(
            url,
            {
              method: "GET",
              headers,
              signal,
              agent: false,
              family: address.family,
              lookup: (_hostname, _options, callback) =>
                callback(null, address.address, address.family),
            },
            (res) => {
              const status = res.statusCode ?? 0;
              if (
                [301, 302, 303, 307, 308].includes(status) &&
                res.headers.location
              ) {
                resolve({
                  url: url.href,
                  status,
                  contentType: "",
                  text: "",
                  location: res.headers.location,
                });
                res.destroy();
                return;
              }
              const chunks: Buffer[] = [];
              let bytes = 0;
              res.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                totalBytes += chunk.length;
                if (totalBytes > 20_000_000) {
                  const error = new Error(
                    "Crawl exceeds the 20 MB download limit",
                  );
                  reject(error);
                  request.destroy(error);
                  return;
                }
                if (bytes > 2_000_000) {
                  const error = new Error("Response exceeds the 2 MB limit");
                  reject(error);
                  request.destroy(error);
                } else chunks.push(chunk);
              });
              res.on("error", reject);
              res.on("end", () =>
                resolve({
                  url: url.href,
                  status,
                  contentType: res.headers["content-type"] ?? "",
                  text: Buffer.concat(chunks).toString("utf8"),
                }),
              );
            },
          );
          request.on("error", reject);
          request.end();
        },
      );
      if (!response.location) return response;
      const destination = publicUrl(new URL(response.location, url).href);
      if (url.protocol === "https:" && destination.protocol !== "https:")
        throw new Error("HTTPS downgrade redirect blocked");
      url = destination;
    }
    throw new Error("Too many redirects");
  };
}

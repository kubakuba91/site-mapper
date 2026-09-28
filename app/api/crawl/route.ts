import { NextResponse } from "next/server";
import { crawlSite } from "@/lib/crawler";
import { readSmallJson, validateCrawlRequest } from "@/lib/crawl-request";

export const runtime = "nodejs";
export const maxDuration = 300;
let active = 0;
let starts: number[] = [];

export async function POST(request: Request): Promise<NextResponse> {
  let body;
  try {
    body = validateCrawlRequest(await readSmallJson(request));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid JSON body" },
      { status: 400 },
    );
  }
  starts = starts.filter((time) => time > Date.now() - 60_000);
  if (active >= 4 || starts.length >= 20)
    return NextResponse.json(
      { error: "Crawler is busy. Please retry shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  active++;
  starts.push(Date.now());
  try {
    const result = await crawlSite(body.baseUrl, body.auth, {
      signal: request.signal,
    });
    return NextResponse.json({ baseUrl: body.baseUrl, ...result });
  } catch (err) {
    const timedOut =
      err instanceof Error && ["AbortError", "TimeoutError"].includes(err.name);
    return NextResponse.json(
      {
        error: timedOut
          ? "Crawl stopped or exceeded its time limit. Try a smaller site."
          : "Crawl failed. Please check the site URL.",
      },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    active--;
  }
}

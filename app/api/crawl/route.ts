import { NextResponse } from "next/server";
import { crawlSite } from "@/lib/crawler";
import type { CrawlRequestBody, CrawlResult } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  let body: CrawlRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const baseUrl = body.baseUrl?.trim();
  if (!baseUrl) {
    return NextResponse.json({ error: "baseUrl is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return NextResponse.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return NextResponse.json({ error: "baseUrl must use http or https" }, { status: 400 });
  }

  try {
    const { pages, errors } = await crawlSite(parsedUrl.toString(), body.auth);
    const result: CrawlResult = { baseUrl: parsedUrl.toString(), pages, errors };
    return NextResponse.json(result);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Crawl failed: ${reason}` }, { status: 500 });
  }
}

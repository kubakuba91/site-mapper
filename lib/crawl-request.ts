import { publicUrl } from "./safe-fetch";
import type { CrawlRequestBody } from "./types";

export function validateCrawlRequest(value: unknown): CrawlRequestBody {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a JSON object");
  const body = value as Record<string, unknown>;
  if (
    typeof body.baseUrl !== "string" ||
    !body.baseUrl.trim() ||
    body.baseUrl.length > 2048
  )
    throw new Error("baseUrl must be a URL string (maximum 2048 characters)");
  const baseUrl = publicUrl(body.baseUrl.trim()).href;
  if (body.auth !== undefined) {
    if (!body.auth || typeof body.auth !== "object" || Array.isArray(body.auth))
      throw new Error("auth must be an object");
    for (const [key, value] of Object.entries(body.auth)) {
      if (
        !["username", "password"].includes(key) ||
        typeof value !== "string" ||
        value.length > 512
      )
        throw new Error("Invalid basic-auth fields");
    }
  }
  return { baseUrl, auth: body.auth as CrawlRequestBody["auth"] };
}
export async function readSmallJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("JSON body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) throw new Error("Request body exceeds 4 KB");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel();
  }
}

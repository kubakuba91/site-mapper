import { getSupabase } from "./supabase";
import type { CrawledPage, Mapping } from "./types";
export type SessionSnapshot = {
  oldBaseUrl: string;
  newBaseUrl: string;
  oldPages: CrawledPage[];
  newPages: CrawledPage[];
  mappings: Mapping[];
};
export type SessionAccess = { id: string; token: string; revision: number };
export type LoadedSession = SessionAccess & { snapshot: SessionSnapshot };

export function validateSnapshot(
  value: unknown,
): asserts value is SessionSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("Invalid shared session");
  const s = value as SessionSnapshot;
  for (const raw of [s.oldBaseUrl, s.newBaseUrl]) {
    if (typeof raw !== "string") throw new Error("Invalid session URL");
    const url = new URL(raw);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid session URL");
  }
  for (const pages of [s.oldPages, s.newPages]) {
    if (!Array.isArray(pages) || pages.length > 2000)
      throw new Error("Invalid session pages");
    const paths = new Set<string>();
    for (const p of pages) {
      if (
        !p ||
        typeof p.url !== "string" ||
        !/^https?:\/\//i.test(p.url) ||
        typeof p.path !== "string" ||
        !p.path.startsWith("/") ||
        paths.has(p.path) ||
        !(p.title === null || typeof p.title === "string") ||
        !(p.description === null || typeof p.description === "string") ||
        typeof p.statusCode !== "number"
      )
        throw new Error("Invalid session page");
      paths.add(p.path);
    }
  }
  if (!Array.isArray(s.mappings) || s.mappings.length !== s.oldPages.length)
    throw new Error("Invalid session mappings");
  const oldPaths = new Set(s.oldPages.map((p) => p.path));
  const newPaths = new Set(s.newPages.map((p) => p.path));
  const mapped = new Set<string>();
  for (const m of s.mappings) {
    if (
      !m ||
      !oldPaths.has(m.oldPath) ||
      mapped.has(m.oldPath) ||
      !["matched", "unmatched", "dropped"].includes(m.status) ||
      (m.status === "matched"
        ? !m.newPath || !newPaths.has(m.newPath)
        : m.newPath !== null)
    )
      throw new Error("Invalid session mapping");
    for (const text of [m.metadataTitle, m.metadataDescription])
      if (text != null && typeof text !== "string")
        throw new Error("Invalid metadata");
    mapped.add(m.oldPath);
  }
}
export async function createSession(
  snapshot: SessionSnapshot,
): Promise<SessionAccess> {
  validateSnapshot(snapshot);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const { data, error } = await getSupabase().rpc("create_mapping_session", {
    p_token: token,
    p_snapshot: snapshot,
  });
  if (error || !data)
    throw new Error(error?.message ?? "Failed to create shared session");
  return { id: data.id, token, revision: data.revision };
}
export async function loadSession(
  id: string,
  token: string,
): Promise<LoadedSession> {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error(
      "This share link is missing its access token. Ask the owner for a new link.",
    );
  const { data, error } = await getSupabase().rpc("load_mapping_session", {
    p_id: id,
    p_token: token,
  });
  if (error || !data)
    throw new Error(error?.message ?? "Shared session not found");
  validateSnapshot(data.snapshot);
  return { id, token, revision: data.revision, snapshot: data.snapshot };
}
export async function saveSession(
  access: SessionAccess,
  snapshot: SessionSnapshot,
): Promise<number> {
  validateSnapshot(snapshot);
  const { data, error } = await getSupabase().rpc("save_mapping_session", {
    p_id: access.id,
    p_token: access.token,
    p_revision: access.revision,
    p_snapshot: snapshot,
  });
  if (error || !data)
    throw new Error(error?.message ?? "Failed to save session");
  return data.revision;
}

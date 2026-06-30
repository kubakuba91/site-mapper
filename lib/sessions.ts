import { getSupabase } from "./supabase";
import type { CrawledPage, Mapping } from "./types";

type MappingSessionRow = {
  id: string;
  old_base_url: string;
  new_base_url: string;
  old_pages: CrawledPage[];
  new_pages: CrawledPage[];
  mappings: Mapping[];
};

export type LoadedSession = {
  id: string;
  oldBaseUrl: string;
  newBaseUrl: string;
  oldPages: CrawledPage[];
  newPages: CrawledPage[];
  mappings: Mapping[];
};

export async function createSession(input: {
  oldBaseUrl: string;
  newBaseUrl: string;
  oldPages: CrawledPage[];
  newPages: CrawledPage[];
  mappings: Mapping[];
}): Promise<string> {
  const { data, error } = await getSupabase()
    .from("mapping_sessions")
    .insert({
      old_base_url: input.oldBaseUrl,
      new_base_url: input.newBaseUrl,
      old_pages: input.oldPages,
      new_pages: input.newPages,
      mappings: input.mappings,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create shared session");
  return data.id as string;
}

export async function loadSession(id: string): Promise<LoadedSession> {
  const { data, error } = await getSupabase().from("mapping_sessions").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Shared session not found");

  const row = data as MappingSessionRow;
  return {
    id: row.id,
    oldBaseUrl: row.old_base_url,
    newBaseUrl: row.new_base_url,
    oldPages: row.old_pages,
    newPages: row.new_pages,
    mappings: row.mappings,
  };
}

export async function saveMappings(id: string, mappings: Mapping[]): Promise<void> {
  const { error } = await getSupabase()
    .from("mapping_sessions")
    .update({ mappings, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

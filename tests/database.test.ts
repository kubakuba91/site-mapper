import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration revokes enumeration, requires token, saves complete snapshot, and rejects stale revisions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table public.mapping_sessions (id uuid primary key default gen_random_uuid(),old_base_url text not null,new_base_url text not null,old_pages jsonb not null default '[]',new_pages jsonb not null default '[]',mappings jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
      alter table public.mapping_sessions enable row level security;
      grant select,insert,update on public.mapping_sessions to anon;
      create policy "anon can read mapping sessions" on public.mapping_sessions for select to anon using(true);
      create policy "anon can insert mapping sessions" on public.mapping_sessions for insert to anon with check(true);
      create policy "anon can update mapping sessions" on public.mapping_sessions for update to anon using(true) with check(true);
      insert into public.mapping_sessions(id,old_base_url,new_base_url) values('22222222-2222-4222-8222-222222222222','https://old.test','https://new.test');`);
    const migration = await readFile(
      new URL("../supabase/schema.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    // Migrations must also be safe to rerun.
    await db.exec(migration);
    const page = {
      url: "https://example.com/about",
      path: "/about",
      title: "About",
      description: null,
      statusCode: 200,
    };
    const snapshot = {
      oldBaseUrl: "https://example.com",
      newBaseUrl: "https://new.test",
      oldPages: [page],
      newPages: [],
      mappings: [{ oldPath: "/about", newPath: null, status: "unmatched" }],
    };
    const token = "a".repeat(64);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.mapping_sessions"),
      /permission denied/,
    );
    const created = await db.query<{ s: { id: string; revision: number } }>(
      "select public.create_mapping_session($1,$2::jsonb) as s",
      [token, JSON.stringify(snapshot)],
    );
    const id = created.rows[0].s.id;
    await assert.rejects(
      db.query("select public.load_mapping_session($1,$2)", [
        "22222222-2222-4222-8222-222222222222",
        token,
      ]),
      /unavailable/,
    );
    await assert.rejects(
      db.query("select public.load_mapping_session($1,$2)", [
        id,
        "b".repeat(64),
      ]),
      /unavailable/,
    );
    await assert.rejects(
      db.query("select public.load_mapping_session($1,$2)", [id, null]),
      /unavailable/,
    );
    const updated = {
      ...snapshot,
      oldPages: [
        page,
        { ...page, path: "/manual", url: "https://example.com/manual" },
      ],
      mappings: [
        ...snapshot.mappings,
        { oldPath: "/manual", newPath: null, status: "unmatched" },
      ],
    };
    await db.query("select public.save_mapping_session($1,$2,1,$3::jsonb)", [
      id,
      token,
      JSON.stringify(updated),
    ]);
    const loaded = await db.query<{
      s: { revision: number; snapshot: unknown };
    }>("select public.load_mapping_session($1,$2) as s", [id, token]);
    assert.equal(loaded.rows[0].s.revision, 2);
    assert.deepEqual(loaded.rows[0].s.snapshot, updated);
    await assert.rejects(
      db.query("select public.save_mapping_session($1,$2,1,$3::jsonb)", [
        id,
        token,
        JSON.stringify(snapshot),
      ]),
      /changed elsewhere/,
    );
    await assert.rejects(
      db.query("update public.mapping_sessions set mappings='[]'"),
      /permission denied/,
    );
    await db.exec("reset role; set role authenticated");
    await assert.rejects(
      db.query("select * from public.mapping_sessions"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

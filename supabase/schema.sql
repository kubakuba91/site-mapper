-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Creates the table backing shareable mapping sessions, with RLS policies
-- that allow the anon (publishable-key) role to read/write any row by id.
-- There is no auth in this tool: the row id in the URL is the access control.

create extension if not exists pgcrypto;

create table if not exists public.mapping_sessions (
  id uuid primary key default gen_random_uuid(),
  old_base_url text not null,
  new_base_url text not null,
  old_pages jsonb not null default '[]'::jsonb,
  new_pages jsonb not null default '[]'::jsonb,
  mappings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mapping_sessions enable row level security;

create policy "anon can read mapping sessions"
  on public.mapping_sessions for select
  to anon
  using (true);

create policy "anon can insert mapping sessions"
  on public.mapping_sessions for insert
  to anon
  with check (true);

create policy "anon can update mapping sessions"
  on public.mapping_sessions for update
  to anon
  using (true)
  with check (true);

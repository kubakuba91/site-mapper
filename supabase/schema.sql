-- Run this entire file in Supabase SQL Editor. Also upgrades the original schema.
-- Legacy ID-only links are intentionally revoked. Re-share locally saved boards.
begin;
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
alter table public.mapping_sessions add column if not exists token_hash text;
alter table public.mapping_sessions add column if not exists revision integer not null default 1;
alter table public.mapping_sessions enable row level security;
drop policy if exists "anon can read mapping sessions" on public.mapping_sessions;
drop policy if exists "anon can insert mapping sessions" on public.mapping_sessions;
drop policy if exists "anon can update mapping sessions" on public.mapping_sessions;
revoke all on public.mapping_sessions from anon, authenticated;

create or replace function public.validate_mapping_snapshot(s jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if s is null or pg_catalog.jsonb_typeof(s) <> 'object' or pg_catalog.octet_length(s::text) > 2000000
    or pg_catalog.jsonb_typeof(s->'oldBaseUrl') is distinct from 'string'
    or pg_catalog.jsonb_typeof(s->'newBaseUrl') is distinct from 'string'
    or pg_catalog.jsonb_typeof(s->'oldPages') is distinct from 'array'
    or pg_catalog.jsonb_typeof(s->'newPages') is distinct from 'array'
    or pg_catalog.jsonb_typeof(s->'mappings') is distinct from 'array' then
    raise exception 'Invalid session snapshot';
  end if;
end $$;
revoke all on function public.validate_mapping_snapshot(jsonb) from public;

create or replace function public.create_mapping_session(p_token text, p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid share token'; end if;
  perform public.validate_mapping_snapshot(p_snapshot);
  insert into public.mapping_sessions(old_base_url,new_base_url,old_pages,new_pages,mappings,token_hash)
  values(p_snapshot->>'oldBaseUrl',p_snapshot->>'newBaseUrl',p_snapshot->'oldPages',p_snapshot->'newPages',p_snapshot->'mappings',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')) returning id into new_id;
  return pg_catalog.jsonb_build_object('id',new_id,'revision',1);
end $$;

create or replace function public.load_mapping_session(p_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.mapping_sessions;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Session unavailable or invalid link'; end if;
  select * into r from public.mapping_sessions where id=p_id and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception 'Session unavailable or invalid link'; end if;
  return pg_catalog.jsonb_build_object('id',r.id,'revision',r.revision,'snapshot',pg_catalog.jsonb_build_object(
    'oldBaseUrl',r.old_base_url,'newBaseUrl',r.new_base_url,'oldPages',r.old_pages,'newPages',r.new_pages,'mappings',r.mappings));
end $$;

create or replace function public.save_mapping_session(p_id uuid,p_token text,p_revision integer,p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Session unavailable or invalid link'; end if;
  perform public.validate_mapping_snapshot(p_snapshot);
  update public.mapping_sessions set old_base_url=p_snapshot->>'oldBaseUrl',new_base_url=p_snapshot->>'newBaseUrl',
    old_pages=p_snapshot->'oldPages',new_pages=p_snapshot->'newPages',mappings=p_snapshot->'mappings',
    revision=revision+1,updated_at=now()
  where id=p_id and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex') and revision=p_revision
  returning revision into next_revision;
  if not found then raise exception 'Session changed elsewhere or access expired. Reload before editing, or export your local work.'; end if;
  return pg_catalog.jsonb_build_object('revision',next_revision);
end $$;
revoke all on function public.create_mapping_session(text,jsonb) from public;
revoke all on function public.load_mapping_session(uuid,text) from public;
revoke all on function public.save_mapping_session(uuid,text,integer,jsonb) from public;
grant execute on function public.create_mapping_session(text,jsonb) to anon, authenticated;
grant execute on function public.load_mapping_session(uuid,text) to anon, authenticated;
grant execute on function public.save_mapping_session(uuid,text,integer,jsonb) to anon, authenticated;
commit;

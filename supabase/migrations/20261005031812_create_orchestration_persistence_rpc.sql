create extension if not exists pgcrypto;

create schema if not exists orchestration_private;
revoke all on schema orchestration_private from public;
revoke all on schema orchestration_private from anon;
revoke all on schema orchestration_private from authenticated;
grant usage on schema orchestration_private to service_role;

create table if not exists orchestration_private.run_entries (
  run_id text not null,
  version bigint not null check (version > 0),
  actor text not null,
  action text not null,
  state text not null,
  recorded_at_text text not null,
  recorded_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text,
  integrity_hash text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, version),
  unique (run_id, integrity_hash)
);

create table if not exists orchestration_private.run_leases (
  run_id text primary key,
  worker_id text not null,
  lease_token uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists orchestration_private.run_checkpoints (
  run_id text primary key,
  version bigint not null check (version >= 0),
  integrity_hash text,
  checkpoint jsonb not null,
  updated_at timestamptz not null default now()
);

alter table orchestration_private.run_entries enable row level security;
alter table orchestration_private.run_leases enable row level security;
alter table orchestration_private.run_checkpoints enable row level security;

revoke all on orchestration_private.run_entries from public, anon, authenticated;
revoke all on orchestration_private.run_leases from public, anon, authenticated;
revoke all on orchestration_private.run_checkpoints from public, anon, authenticated;

grant select, insert on orchestration_private.run_entries to service_role;
grant select, insert, update, delete on orchestration_private.run_leases to service_role;
grant select, insert, update on orchestration_private.run_checkpoints to service_role;

create or replace function orchestration_private.length_prefix(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select octet_length(coalesce(p_value, ''))::text || ':' || coalesce(p_value, '');
$$;

revoke execute on function orchestration_private.length_prefix(text) from public, anon, authenticated;
grant execute on function orchestration_private.length_prefix(text) to service_role;

create or replace function orchestration_private.entry_hash(
  p_previous_hash text,
  p_run_id text,
  p_actor text,
  p_action text,
  p_state text,
  p_recorded_at text,
  p_metadata_json text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        orchestration_private.length_prefix(coalesce(p_previous_hash, '')) || '|' ||
        orchestration_private.length_prefix(p_run_id) || '|' ||
        orchestration_private.length_prefix(p_actor) || '|' ||
        orchestration_private.length_prefix(p_action) || '|' ||
        orchestration_private.length_prefix(p_state) || '|' ||
        orchestration_private.length_prefix(p_recorded_at) || '|' ||
        orchestration_private.length_prefix(p_metadata_json),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke execute on function orchestration_private.entry_hash(text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function orchestration_private.entry_hash(text,text,text,text,text,text,text) to service_role;

create or replace function public.orchestration_load_entries(p_run_id text)
returns table (
  "runId" text,
  actor text,
  action text,
  state text,
  "recordedAt" text,
  metadata jsonb,
  "integrityHash" text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.run_id,
    e.actor,
    e.action,
    e.state,
    e.recorded_at_text,
    e.metadata,
    e.integrity_hash
  from orchestration_private.run_entries e
  where e.run_id = p_run_id
  order by e.version;
$$;

create or replace function public.orchestration_acquire_lease(
  p_run_id text,
  p_worker_id text,
  p_lease_ms integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid := gen_random_uuid();
  v_returned_token uuid;
begin
  if p_run_id is null or p_run_id = '' or p_worker_id is null or p_worker_id = '' then
    raise exception 'lease_input_invalid';
  end if;
  if p_lease_ms is null or p_lease_ms < 1000 or p_lease_ms > 300000 then
    raise exception 'lease_duration_invalid';
  end if;

  insert into orchestration_private.run_leases as l
    (run_id, worker_id, lease_token, expires_at, updated_at)
  values
    (
      p_run_id,
      p_worker_id,
      v_token,
      clock_timestamp() + (p_lease_ms::text || ' milliseconds')::interval,
      clock_timestamp()
    )
  on conflict (run_id) do update
  set
    worker_id = excluded.worker_id,
    lease_token = case
      when l.worker_id = excluded.worker_id and l.expires_at > clock_timestamp()
        then l.lease_token
      else excluded.lease_token
    end,
    expires_at = excluded.expires_at,
    updated_at = clock_timestamp()
  where l.expires_at <= clock_timestamp()
     or l.worker_id = excluded.worker_id
  returning lease_token into v_returned_token;

  if v_returned_token is null then
    raise exception 'lease_conflict';
  end if;

  return jsonb_build_object('lease_token', v_returned_token::text);
end;
$$;

create or replace function public.orchestration_release_lease(
  p_run_id text,
  p_worker_id text,
  p_lease_token text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from orchestration_private.run_leases
  where run_id = p_run_id
    and worker_id = p_worker_id
    and lease_token::text = p_lease_token;

  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'lease_not_owned';
  end if;

  return jsonb_build_object('released', true);
end;
$$;

create or replace function public.orchestration_append_entry(
  p_run_id text,
  p_actor text,
  p_action text,
  p_state text,
  p_recorded_at text,
  p_metadata_json text,
  p_worker_id text,
  p_lease_token text,
  p_expected_version bigint,
  p_previous_hash text,
  p_integrity_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lease orchestration_private.run_leases%rowtype;
  v_current_version bigint := 0;
  v_current_hash text := null;
  v_expected_hash text;
  v_metadata jsonb;
  v_next_version bigint;
begin
  select * into v_lease
  from orchestration_private.run_leases
  where run_id = p_run_id
  for update;

  if not found
     or v_lease.worker_id <> p_worker_id
     or v_lease.lease_token::text <> p_lease_token
     or v_lease.expires_at <= clock_timestamp() then
    raise exception 'lease_not_owned';
  end if;

  select e.version, e.integrity_hash
    into v_current_version, v_current_hash
  from orchestration_private.run_entries e
  where e.run_id = p_run_id
  order by e.version desc
  limit 1;

  if not found then
    v_current_version := 0;
    v_current_hash := null;
  end if;

  if p_expected_version is distinct from v_current_version then
    raise exception 'version_conflict';
  end if;

  if coalesce(p_previous_hash, '') <> coalesce(v_current_hash, '') then
    raise exception 'previous_hash_conflict';
  end if;

  begin
    v_metadata := coalesce(p_metadata_json, '{}')::jsonb;
  exception when others then
    raise exception 'metadata_json_invalid';
  end;

  v_expected_hash := orchestration_private.entry_hash(
    p_previous_hash,
    p_run_id,
    p_actor,
    p_action,
    p_state,
    p_recorded_at,
    coalesce(p_metadata_json, '{}')
  );

  if p_integrity_hash is distinct from v_expected_hash then
    raise exception 'integrity_hash_invalid';
  end if;

  v_next_version := v_current_version + 1;

  insert into orchestration_private.run_entries (
    run_id,
    version,
    actor,
    action,
    state,
    recorded_at_text,
    recorded_at,
    metadata,
    previous_hash,
    integrity_hash
  ) values (
    p_run_id,
    v_next_version,
    p_actor,
    p_action,
    p_state,
    p_recorded_at,
    p_recorded_at::timestamptz,
    v_metadata,
    p_previous_hash,
    p_integrity_hash
  );

  return jsonb_build_object(
    'runId', p_run_id,
    'actor', p_actor,
    'action', p_action,
    'state', p_state,
    'recordedAt', p_recorded_at,
    'metadata', v_metadata,
    'integrityHash', p_integrity_hash
  );
end;
$$;

create or replace function public.orchestration_read_checkpoint(p_run_id text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select c.checkpoint
  from orchestration_private.run_checkpoints c
  where c.run_id = p_run_id;
$$;

create or replace function public.orchestration_write_checkpoint(
  p_run_id text,
  p_checkpoint jsonb,
  p_worker_id text,
  p_lease_token text,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lease orchestration_private.run_leases%rowtype;
  v_current_version bigint := 0;
  v_current_hash text := null;
begin
  select * into v_lease
  from orchestration_private.run_leases
  where run_id = p_run_id
  for update;

  if not found
     or v_lease.worker_id <> p_worker_id
     or v_lease.lease_token::text <> p_lease_token
     or v_lease.expires_at <= clock_timestamp() then
    raise exception 'lease_not_owned';
  end if;

  select e.version, e.integrity_hash
    into v_current_version, v_current_hash
  from orchestration_private.run_entries e
  where e.run_id = p_run_id
  order by e.version desc
  limit 1;

  if not found then
    v_current_version := 0;
    v_current_hash := null;
  end if;

  if p_expected_version is distinct from v_current_version then
    raise exception 'checkpoint_version_conflict';
  end if;

  if coalesce((p_checkpoint->>'version')::bigint, -1) <> v_current_version then
    raise exception 'checkpoint_payload_version_conflict';
  end if;

  if coalesce(p_checkpoint->>'integrityHash', '') <> coalesce(v_current_hash, '') then
    raise exception 'checkpoint_integrity_conflict';
  end if;

  insert into orchestration_private.run_checkpoints
    (run_id, version, integrity_hash, checkpoint, updated_at)
  values
    (p_run_id, v_current_version, v_current_hash, p_checkpoint, clock_timestamp())
  on conflict (run_id) do update
  set
    version = excluded.version,
    integrity_hash = excluded.integrity_hash,
    checkpoint = excluded.checkpoint,
    updated_at = excluded.updated_at;

  return p_checkpoint;
end;
$$;

revoke execute on function public.orchestration_load_entries(text) from public, anon, authenticated;
revoke execute on function public.orchestration_acquire_lease(text,text,integer) from public, anon, authenticated;
revoke execute on function public.orchestration_release_lease(text,text,text) from public, anon, authenticated;
revoke execute on function public.orchestration_append_entry(text,text,text,text,text,text,text,text,bigint,text,text) from public, anon, authenticated;
revoke execute on function public.orchestration_read_checkpoint(text) from public, anon, authenticated;
revoke execute on function public.orchestration_write_checkpoint(text,jsonb,text,text,bigint) from public, anon, authenticated;

grant execute on function public.orchestration_load_entries(text) to service_role;
grant execute on function public.orchestration_acquire_lease(text,text,integer) to service_role;
grant execute on function public.orchestration_release_lease(text,text,text) to service_role;
grant execute on function public.orchestration_append_entry(text,text,text,text,text,text,text,text,bigint,text,text) to service_role;
grant execute on function public.orchestration_read_checkpoint(text) to service_role;
grant execute on function public.orchestration_write_checkpoint(text,jsonb,text,text,bigint) to service_role;

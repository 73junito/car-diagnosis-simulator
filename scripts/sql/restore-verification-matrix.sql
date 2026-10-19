-- Read-only restore verification matrix.
--
-- Emits ONE line of JSON describing a database so a restored copy can be compared
-- against a recorded baseline manifest. It emits facts only; the PASS/FAIL
-- decision is made by scripts/verify-restore-baseline.js.
--
-- Never writes. Safe against staging, a restored copy, or a rehearsal database:
--   psql -At -f scripts/sql/restore-verification-matrix.sql
--
-- Schema-fingerprint normalisation (documented so a staging baseline and a
-- restored copy are comparable):
--   * included: schemas, relations (kind + RLS flag), columns, constraints,
--     indexes, functions (signature + security + config), policies, triggers,
--     extensions.
--   * excluded: ownership and ACLs (pg_restore runs with --no-owner --no-acl),
--     OIDs, tablespaces, statistics, sequence last_value, comments.
with
rel as (
  select n.nspname as schema_name, c.relname, c.relkind::text as kind, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
cols as (
  select table_schema as schema_name, table_name, column_name, data_type, is_nullable, ordinal_position
  from information_schema.columns
  where table_schema not like 'pg\_%' and table_schema <> 'information_schema'
),
cons as (
  select n.nspname as schema_name, c.relname as table_name, con.conname,
         con.contype::text as contype, pg_get_constraintdef(con.oid) as def
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
idx as (
  select n.nspname as schema_name, c.relname as table_name, i.relname as index_name,
         pg_get_indexdef(x.indexrelid) as def
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class c on c.oid = x.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
fns as (
  select n.nspname as schema_name, p.proname,
         pg_get_function_identity_arguments(p.oid) as args,
         p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
pols as (
  select schemaname as schema_name, tablename, policyname, roles::text as roles,
         cmd, permissive, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
  from pg_policies
  where schemaname not like 'pg\_%' and schemaname <> 'information_schema'
),
trgs as (
  select n.nspname as schema_name, c.relname as table_name, t.tgname,
         pg_get_triggerdef(t.oid) as def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
exts as (
  select extname, extversion from pg_extension where extname <> 'plpgsql'
),
fingerprint_parts as (
  select 'schema|' || nspname as part from pg_namespace
   where nspname not like 'pg\_%' and nspname <> 'information_schema'
  union all select 'rel|' || schema_name || '|' || relname || '|' || kind || '|' || rls::text from rel
  union all select 'col|' || schema_name || '|' || table_name || '|' || column_name || '|' ||
                     data_type || '|' || is_nullable || '|' || ordinal_position::text from cols
  union all select 'con|' || schema_name || '|' || table_name || '|' || conname || '|' || contype || '|' || def from cons
  union all select 'idx|' || schema_name || '|' || table_name || '|' || index_name || '|' || def from idx
  union all select 'fn|' || schema_name || '|' || proname || '(' || args || ')|secdef=' || secdef::text ||
                     '|config=' || config from fns
  union all select 'pol|' || schema_name || '|' || tablename || '|' || policyname || '|' || roles || '|' ||
                     cmd || '|' || permissive || '|' || qual || '|' || with_check from pols
  union all select 'trg|' || schema_name || '|' || table_name || '|' || tgname || '|' || def from trgs
  union all select 'ext|' || extname || '|' || extversion from exts
),
fingerprint as (
  select encode(digest(string_agg(part, E'\n' order by part), 'sha256'), 'hex') as value
  from fingerprint_parts
),
baseline_tables as (
  select unnest(array[
    'approved_sources', 'source_chunks', 'question_provenance', 'question_citations',
    'citation_validations', 'scenario_catalog', 'scenario_questions',
    'scenario_question_readiness', 'attempts', 'attempt_answers', 'attempt_questions',
    'curriculum_courses', 'curriculum_lesson_plans', 'curriculum_lesson_steps',
    'curriculum_competencies', 'curriculum_reference_sources', 'institutions',
    'profiles', 'battery_temperature_telemetry', 'telemetry_events', 'ev_specifications'
  ]) as name
),
row_counts as (
  select coalesce(jsonb_object_agg(t.name, t.n order by t.name), '{}'::jsonb) as value
  from (
    select b.name,
           case when to_regclass('public.' || b.name) is null then null
                else (xpath('/row/c/text()',
                       query_to_xml(format('select count(*) as c from public.%I', b.name), false, true, '')))[1]::text::bigint
           end as n
    from baseline_tables b
  ) t
)
select (
  json_build_object(
    'schema_version', 1,
    'generated_at', now(),
    'database', current_database(),
    'server_version', current_setting('server_version'),
    'migration_history', (
      select json_build_object('count', count(*), 'max_version', coalesce(max(version), ''),
                               'versions', json_agg(version order by version))
      from supabase_migrations.schema_migrations
    ),
    'schemas', (select json_agg(nspname order by nspname) from pg_namespace
                 where nspname not like 'pg\_%' and nspname <> 'information_schema'),
    'object_counts', json_build_object(
      'tables',      (select count(*) from rel where kind in ('r', 'p')),
      'views',       (select count(*) from rel where kind = 'v'),
      'matviews',    (select count(*) from rel where kind = 'm'),
      'sequences',   (select count(*) from rel where kind = 'S'),
      'functions',   (select count(*) from fns),
      'triggers',    (select count(*) from trgs),
      'policies',    (select count(*) from pols),
      'indexes',     (select count(*) from idx),
      'constraints', (select count(*) from cons)
    ),
    'extensions', (select json_object_agg(extname, extversion order by extname) from exts),
    'roles', (select json_object_agg(r.rolname, true order by r.rolname) from pg_roles r
               where r.rolname in ('anon', 'authenticated', 'service_role', 'supabase_admin', 'postgres')),
    'rls', json_build_object(
      'tables_total',   (select count(*) from rel where kind in ('r', 'p')),
      'tables_enabled', (select count(*) from rel where kind in ('r', 'p') and rls),
      'tables_disabled',(select coalesce(json_agg(schema_name || '.' || relname order by relname), '[]'::json)
                          from rel where kind in ('r', 'p') and not rls),
      'policy_count',   (select count(*) from pols)
    ),
    'public_objects', json_build_object(
      'tables',       (select count(*) from rel where schema_name = 'public' and kind in ('r', 'p')),
      'views',        (select count(*) from rel where schema_name = 'public' and kind = 'v'),
      'rls_enabled',  (select count(*) from rel where schema_name = 'public' and kind in ('r', 'p') and rls),
      'rls_disabled', (select coalesce(jsonb_agg(relname order by relname), '[]'::jsonb)
                        from rel where schema_name = 'public' and kind in ('r', 'p') and not rls),
      'policies',     (select count(*) from pols where schema_name = 'public')
    ),
    'schema_fingerprint', (select value from fingerprint),
    'integrity', json_build_object(
      'primary_keys',       (select count(*) from cons where contype = 'p'),
      'foreign_keys',       (select count(*) from cons where contype = 'f'),
      'check_constraints',  (select count(*) from cons where contype = 'c'),
      'unique_constraints', (select count(*) from cons where contype = 'u')
    )
  )::jsonb
  || json_build_object(
    'row_counts', (select value from row_counts) || jsonb_build_object(
      'auth_users', case when to_regclass('auth.users') is null then null
                         else (xpath('/row/c/text()',
                                query_to_xml('select count(*) as c from auth.users', false, true, '')))[1]::text::bigint
                    end
    ),
    'required_tables', json_build_object(
      'expected', (select count(*) from baseline_tables b where to_regclass('public.' || b.name) is not null),
      'missing',  (select coalesce(jsonb_agg(b.name order by b.name), '[]'::jsonb)
                    from baseline_tables b where to_regclass('public.' || b.name) is null)
    ),
    'taxonomy', json_build_object(
      'ase_area_columns', (select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
                            from information_schema.columns
                            where table_schema = 'public' and column_name = 'ase_area'),
      'diagnostic_area_columns', (select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb)
                            from information_schema.columns
                            where table_schema = 'public' and column_name = 'diagnostic_area'),
      'legacy_relations_present', (select coalesce(jsonb_agg(r order by r), '[]'::jsonb)
                            from unnest(array['ase_domains', 'scenario_ase_map', 'ase_readiness_summary']) r
                            where to_regclass('public.' || r) is not null),
      'neutral_relations_present', (select coalesce(jsonb_agg(r order by r), '[]'::jsonb)
                            from unnest(array['diagnostic_domains', 'scenario_diagnostic_area_map',
                                              'diagnostic_readiness_summary']) r
                            where to_regclass('public.' || r) is not null)
    )
  )::jsonb
)::text;

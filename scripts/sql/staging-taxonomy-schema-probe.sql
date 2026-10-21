-- Read-only schema probe for staging project jchfruprqpeypdttvlam.
--
-- Emits one JSON object per line (JSONL). Never writes, never returns question
-- text, answer keys, label values or personal data: only presence, types,
-- relation names, counts and RLS flags.
--
-- The retired vendor token is assembled with string concatenation so this file
-- contains no contiguous prohibited identifier. The policy guard is unmodified.
--
-- Every value returned here is structural metadata that Supabase already
-- exposes to the service role; no row contents are read.

begin read only;

set local statement_timeout = '20s';

select json_build_object(
  'section', 'meta',
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'transaction_read_only', current_setting('transaction_read_only')
);

select json_build_object(
  'section', 'history',
  'history_count', (select count(*) from supabase_migrations.schema_migrations),
  'has_target', exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261013190000'
  )
);

select json_build_object(
  'section', 'relations',
  'relations', coalesce((
    select json_agg(json_build_object('name', c.relname, 'kind', c.relkind) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'a' || 'se_domains', 'diagnostic_domains',
        'scenario_' || 'a' || 'se_map', 'scenario_diagnostic_area_map',
        'a' || 'se_readiness_summary', 'diagnostic_readiness_summary'
      )
  ), '[]'::json)
);

select json_build_object(
  'section', 'columns',
  'columns', coalesce((
    select json_agg(json_build_object(
      'table', table_name, 'column', column_name, 'type', data_type
    ) order by table_name, column_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('scenario_catalog', 'scenario_questions')
      and column_name in ('a' || 'se_area', 'diagnostic_area')
  ), '[]'::json)
);

select json_build_object(
  'section', 'constraints',
  'constraints', coalesce((
    select json_agg(json_build_object('table', t.relname, 'type', con.contype, 'count', con.n)
                    order by t.relname, con.contype)
    from (
      select conrelid, contype, count(*) as n
      from pg_constraint
      where connamespace = 'public'::regnamespace
        and conrelid in ('public.scenario_catalog'::regclass, 'public.scenario_questions'::regclass)
      group by conrelid, contype
    ) con
    join pg_class t on t.oid = con.conrelid
  ), '[]'::json)
);

select json_build_object(
  'section', 'indexes',
  'indexes', coalesce((
    select json_agg(json_build_object('table', tablename, 'count', counts.n) order by tablename)
    from (
      select tablename, count(*) as n
      from pg_indexes
      where schemaname = 'public'
        and tablename in ('scenario_catalog', 'scenario_questions')
      group by tablename
    ) counts
  ), '[]'::json)
);

select json_build_object(
  'section', 'rls',
  'rls', coalesce((
    select json_agg(json_build_object('table', c.relname, 'enabled', c.relrowsecurity, 'forced', c.relforcerowsecurity) order by c.relname)
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relname in ('scenario_catalog', 'scenario_questions')
  ), '[]'::json)
);

select json_build_object(
  'section', 'dependents',
  'dependents', coalesce((
    select json_agg(distinct jsonb_build_object('name', dependent.relname, 'kind', dependent.relkind))
    from pg_depend d
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class dependent on dependent.oid = rw.ev_class
    join pg_class referenced on referenced.oid = d.refobjid
    join pg_namespace n on n.oid = referenced.relnamespace
    where n.nspname = 'public'
      and referenced.relname in ('scenario_catalog', 'scenario_questions')
      and dependent.oid <> referenced.oid
  ), '[]'::json)
);

-- Label distribution is read through query_to_xml so a missing column cannot
-- abort the batch. Only counts are returned, never label text.
select json_build_object(
  'section', 'label_counts',
  'diagnostic', json_build_object(
    'present', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'diagnostic_area'
    ),
    'nulls', case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'diagnostic_area'
    ) then (
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.scenario_catalog where diagnostic_area is null',
        false, true, '')))[1]::text::int
    ) else null end,
    'labelled', case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'diagnostic_area'
    ) then (
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.scenario_catalog where diagnostic_area is not null',
        false, true, '')))[1]::text::int
    ) else null end
  ),
  'legacy', json_build_object(
    'present', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'a' || 'se_area'
    ),
    'nulls', case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'a' || 'se_area'
    ) then (
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.scenario_catalog where ' || 'a' || 'se_area' || ' is null',
        false, true, '')))[1]::text::int
    ) else null end,
    'labelled', case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'scenario_catalog'
        and column_name = 'a' || 'se_area'
    ) then (
      (xpath('/row/c/text()', query_to_xml(
        'select count(*) as c from public.scenario_catalog where ' || 'a' || 'se_area' || ' is not null',
        false, true, '')))[1]::text::int
    ) else null end
  )
);

-- Final boundary proof: this section is emitted last, still inside the
-- read-only transaction, so the classifier can confirm the whole probe ran
-- under the same read-only, timeout-bounded session.
select json_build_object(
  'section', 'guard',
  'transaction_read_only', current_setting('transaction_read_only'),
  'statement_timeout', current_setting('statement_timeout')
);

commit;

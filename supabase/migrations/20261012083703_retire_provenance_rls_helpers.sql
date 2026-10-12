begin;

-- G20: retire the legacy direct-authenticated provenance RLS surface.
-- Production application access is Worker/service-role mediated. Staging already
-- uses this service-role-only model for the core provenance tables.

do $$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('approved_sources', 'approved_sources_select'),
      ('approved_sources', 'approved_sources_insert_reviewers'),
      ('approved_sources', 'approved_sources_update_reviewers'),
      ('approved_sources', 'approved_sources_delete_admin'),
      ('source_chunks', 'source_chunks_select'),
      ('source_chunks', 'source_chunks_insert_reviewers'),
      ('source_chunks', 'source_chunks_update_reviewers'),
      ('source_chunks', 'source_chunks_delete_admin'),
      ('question_provenance', 'question_provenance_select'),
      ('question_provenance', 'question_provenance_insert_reviewers'),
      ('question_provenance', 'question_provenance_update_reviewers'),
      ('question_provenance', 'question_provenance_delete_admin'),
      ('question_citations', 'question_citations_select'),
      ('question_citations', 'question_citations_insert_reviewers'),
      ('question_citations', 'question_citations_update_reviewers'),
      ('question_citations', 'question_citations_delete_admin'),
      ('provenance_audit', 'provenance_audit_insert_reviewers'),
      ('provenance_audit', 'provenance_audit_select_public'),
      ('provenance_audit', 'provenance_audit_select_service'),
      ('provenance_audit', 'provenance_audit_select_reviewers')
    ) as v(table_name, policy_name)
  loop
    if to_regclass(format('public.%I', item.table_name)) is not null then
      execute format(
        'drop policy if exists %I on public.%I',
        item.policy_name,
        item.table_name
      );
    end if;
  end loop;
end
$$;

-- The canonical Worker uses service-role access for this governed data.
-- Remove direct Data API table privileges from browser roles. Existing data
-- remains untouched.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'approved_sources',
    'source_chunks',
    'question_provenance',
    'question_citations',
    'provenance_audit'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'revoke all privileges on table public.%I from anon, authenticated',
        table_name
      );
    end if;
  end loop;
end
$$;

-- No active RLS policy depends on these helpers after the policy retirement.
-- Removing them eliminates exposed SECURITY DEFINER RPCs.
drop function if exists public.is_provenance_admin();
drop function if exists public.is_provenance_reviewer();

commit;

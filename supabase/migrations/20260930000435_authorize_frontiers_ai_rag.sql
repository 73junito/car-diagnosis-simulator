update public.approved_source_rights_scopes as rights
set
  ai_rag_ingestion_allowed = true,
  review_notes = concat_ws(
    E'\n',
    nullif(btrim(coalesce(rights.review_notes, '')), ''),
    'AI/RAG use authorized for this reviewed source based on its human-reviewed CC BY 4.0 license. Attribution remains required; this authorization does not grant automatic publication or scored-assessment eligibility.'
  ),
  updated_at = now()
from public.approved_sources as source
where rights.source_id = source.id
  and source.id = 'frontiers-automotive-alternator-2023'
  and source.status = 'approved'
  and source.license_reviewed_by is not null
  and source.license_reviewed_at is not null
  and source.license->>'classification' = 'CC_BY'
  and coalesce((source.license->>'reuse_permission_verified')::boolean, false) = true
  and rights.reviewed_by is not null
  and rights.reviewed_at is not null
  and rights.citation_link_allowed is true
  and rights.paraphrase_summary_allowed is true
  and rights.database_storage_allowed is true
  and (rights.effective_at is null or rights.effective_at <= current_date)
  and (rights.expires_at is null or rights.expires_at >= current_date);

do $$
begin
  if exists (
    select 1
    from public.approved_sources
    where id = 'frontiers-automotive-alternator-2023'
  ) and not exists (
    select 1
    from public.approved_source_rights_scopes
    where source_id = 'frontiers-automotive-alternator-2023'
      and ai_rag_ingestion_allowed is true
  ) then
    raise exception 'frontiers_ai_rag_authorization_failed';
  end if;
end;
$$;

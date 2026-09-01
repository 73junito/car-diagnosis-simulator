begin;

alter table public.citation_validations
    enable row level security;

revoke all on table public.citation_validations
    from public, anon, authenticated;

grant select, insert, update
    on table public.citation_validations
    to service_role;

comment on table public.citation_validations is
    'Deterministic citation-validation evidence. Direct access is restricted to the service role.';

commit;

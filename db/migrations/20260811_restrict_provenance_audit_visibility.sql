-- Migration: Restrict provenance audit visibility

drop policy if exists provenance_audit_select_public
on public.provenance_audit;

drop policy if exists provenance_audit_select_service
on public.provenance_audit;

drop policy if exists provenance_audit_select_reviewers
on public.provenance_audit;

create policy provenance_audit_select_reviewers
on public.provenance_audit
for select
to authenticated
using ((select public.is_provenance_reviewer()));

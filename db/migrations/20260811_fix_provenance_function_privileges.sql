-- Migration: Preserve required provenance helper privileges

revoke all on function public.is_provenance_admin() from public;
revoke all on function public.is_provenance_reviewer() from public;

revoke all on function public.is_provenance_admin() from anon;
revoke all on function public.is_provenance_reviewer() from anon;

grant execute on function public.is_provenance_admin()
to authenticated, service_role;

grant execute on function public.is_provenance_reviewer()
to authenticated, service_role;

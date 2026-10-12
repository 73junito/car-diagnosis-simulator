-- Harden trigger/helper functions against direct Data API invocation.
-- Trigger execution remains intact; no public client role requires direct RPC execution.

alter function public.handle_new_auth_user()
  set search_path = '';

alter function public.capture_student_institution_claim()
  set search_path = '';

alter function public.set_external_data_resource_updated_at()
  set search_path = '';

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.capture_student_institution_claim() from public, anon, authenticated;
revoke execute on function public.set_external_data_resource_updated_at() from public, anon, authenticated;

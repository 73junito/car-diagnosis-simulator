-- Privileged, explicit retention cleanup. Scheduling and retention policy approval remain separate.
create or replace function lmf_private.purge_expired_reference_sessions(p_limit integer default 100)
returns integer language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare n integer;
begin
 if p_limit < 1 or p_limit > 1000 then raise exception 'Invalid retention batch limit'; end if;
 with selected as (
   select id from public.lmf_reference_sessions
   where expires_at < now()
   order by expires_at, id
   for update skip locked limit p_limit
 ), removed as (
   delete from public.lmf_reference_sessions s using selected
   where s.id=selected.id returning s.id
 ) select count(*) into n from removed;
 return n;
end;
$$;
revoke all on function lmf_private.purge_expired_reference_sessions(integer) from public,anon,authenticated;
grant execute on function lmf_private.purge_expired_reference_sessions(integer) to service_role;

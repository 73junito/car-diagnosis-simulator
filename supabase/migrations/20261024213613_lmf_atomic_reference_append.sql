-- Service-only atomic compare-and-append. Apply after lmf_reference_evidence_access.
create schema if not exists lmf_private;
revoke all on schema lmf_private from public, anon, authenticated;
grant usage on schema lmf_private to service_role;

create or replace function lmf_private.append_reference_event(
 p_session_id uuid, p_owner_id uuid, p_expected_sequence bigint,
 p_expected_previous_hash text, p_payload jsonb,
 p_hash text, p_signature text
) returns uuid
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
 v_owner uuid;
 v_expiry timestamptz;
 v_previous_hash text;
 v_previous_sequence bigint;
 v_event_id uuid;
begin
 if p_expected_sequence < 1 or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_hash !~ '^[a-f0-9]{64}$' or p_signature !~ '^[a-f0-9]{64}$'
    or (p_expected_previous_hash is not null and p_expected_previous_hash !~ '^[a-f0-9]{64}$') then
   raise exception 'Invalid evidence append arguments';
 end if;
 select owner_id, expires_at into v_owner, v_expiry
 from public.lmf_reference_sessions where id=p_session_id for update;
 if not found or v_owner is distinct from p_owner_id or v_expiry <= now() then
   raise exception 'Session missing, expired, or owner mismatch';
 end if;
 select sequence_number,event_hash into v_previous_sequence,v_previous_hash
 from public.lmf_reference_events where session_id=p_session_id
 order by sequence_number desc limit 1;
 if p_expected_sequence <> coalesce(v_previous_sequence,0)+1
    or p_expected_previous_hash is distinct from v_previous_hash then
   raise exception 'Stale or broken reference evidence chain';
 end if;
 insert into public.lmf_reference_events
  (session_id,owner_id,sequence_number,payload,previous_hash,event_hash,event_signature)
 values (p_session_id,p_owner_id,p_expected_sequence,p_payload,
         p_expected_previous_hash,p_hash,p_signature)
 returning id into v_event_id;
 return v_event_id;
end;
$$;
revoke all on function lmf_private.append_reference_event(uuid,uuid,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function lmf_private.append_reference_event(uuid,uuid,bigint,text,jsonb,text,text) to service_role;

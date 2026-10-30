-- Fixtures required by tests/lmf-db-concurrency.cjs on a disposable database.
--
-- lmf_private.append_reference_event() takes the session row FOR UPDATE and raises
-- 'Session missing, expired, or owner mismatch' unless a live, owner-matched session exists.
-- The harness supplies those two UUIDs and never creates the session itself, so the row must
-- exist beforehand. The rotation harness inserts its own user and session and gets no fixture.
--
-- Identifiers below are the fixed test values from the harness, not real users or sessions.
-- Applied only to the throwaway lmf_concurrency_verify database, never to Supabase.

insert into auth.users (id) values ('123e4567-e89b-42d3-a456-426614174001');

insert into public.lmf_reference_sessions (id, owner_id, model_ref, model_sha256, expires_at)
values (
  '123e4567-e89b-42d3-a456-426614174003',
  '123e4567-e89b-42d3-a456-426614174001',
  '/data/circuit-templates/12v-starting-system-v2.json',
  repeat('a', 64),
  now() + interval '1 hour'
);

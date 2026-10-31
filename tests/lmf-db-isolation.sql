\set ON_ERROR_STOP on
BEGIN;
\ir ../supabase/migrations/20261024212822_lmf_reference_evidence_access.sql
\ir ../supabase/migrations/20261024213613_lmf_atomic_reference_append.sql
INSERT INTO auth.users (id,instance_id,aud,role,email,created_at,updated_at)
VALUES ('123e4567-e89b-42d3-a456-426614174001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lmf-local-a@example.invalid',now(),now()),
       ('123e4567-e89b-42d3-a456-426614174002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lmf-local-b@example.invalid',now(),now());
INSERT INTO public.lmf_reference_sessions (id,owner_id,model_ref,model_sha256,created_at,expires_at)
VALUES ('123e4567-e89b-42d3-a456-426614174003','123e4567-e89b-42d3-a456-426614174001','/data/circuit-templates/12v-starting-system-v2.json',repeat('a',64),now(),now()+interval '1 hour'),
       ('123e4567-e89b-42d3-a456-426614174004','123e4567-e89b-42d3-a456-426614174002','/data/circuit-templates/12v-starting-system-v2.json',repeat('a',64),now(),now()+interval '1 hour'),
       ('123e4567-e89b-42d3-a456-426614174005','123e4567-e89b-42d3-a456-426614174001','/data/circuit-templates/12v-starting-system-v2.json',repeat('a',64),now()-interval '2 hours',now()-interval '1 hour');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174001',true);
DO $$ BEGIN
 IF (select count(*) from public.lmf_reference_sessions) <> 1 THEN RAISE EXCEPTION 'Owner A sessions RLS failed'; END IF;
 IF has_table_privilege('authenticated','public.lmf_reference_events','INSERT') THEN RAISE EXCEPTION 'Client insert privilege found'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','123e4567-e89b-42d3-a456-426614174002',true);
DO $$ BEGIN
 IF (select count(*) from public.lmf_reference_sessions) <> 1 THEN RAISE EXCEPTION 'Owner B sessions RLS failed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT lmf_private.append_reference_event('123e4567-e89b-42d3-a456-426614174003','123e4567-e89b-42d3-a456-426614174001',1,null,'{"evidenceRole":"training-reference-only"}',repeat('b',64),repeat('c',64));
RESET ROLE;
DO $$ BEGIN
 IF (select count(*) from public.lmf_reference_events) <> 1 THEN RAISE EXCEPTION 'Atomic append failed'; END IF;
END $$;
DO $$ BEGIN
 BEGIN
  PERFORM lmf_private.append_reference_event('123e4567-e89b-42d3-a456-426614174003','123e4567-e89b-42d3-a456-426614174001',1,null,'{}',repeat('d',64),repeat('e',64));
  RAISE EXCEPTION 'Unexpected duplicate append success';
 EXCEPTION WHEN others THEN
  IF SQLERRM = 'Unexpected duplicate append success' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM lmf_private.append_reference_event('123e4567-e89b-42d3-a456-426614174003','123e4567-e89b-42d3-a456-426614174002',2,repeat('b',64),'{}',repeat('d',64),repeat('e',64));
  RAISE EXCEPTION 'Unexpected cross-owner append success';
 EXCEPTION WHEN others THEN
  IF SQLERRM = 'Unexpected cross-owner append success' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM lmf_private.append_reference_event('123e4567-e89b-42d3-a456-426614174005','123e4567-e89b-42d3-a456-426614174001',1,null,'{}',repeat('d',64),repeat('e',64));
  RAISE EXCEPTION 'Unexpected expired append success';
 EXCEPTION WHEN others THEN
  IF SQLERRM = 'Unexpected expired append success' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;

\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE src uuid;
BEGIN
 IF (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('obd_reference_sources','obd_reference_codes') AND rowsecurity)<>2 THEN RAISE EXCEPTION 'RLS missing'; END IF;
 IF has_table_privilege('anon','public.obd_reference_codes','SELECT') OR has_table_privilege('authenticated','public.obd_reference_codes','INSERT') THEN RAISE EXCEPTION 'unsafe privileges'; END IF;
 INSERT INTO public.obd_reference_codes(protocol_generation,code,description) VALUES('OBD_II','P0302','generic');
 BEGIN
  INSERT INTO public.obd_reference_codes(protocol_generation,code,description) VALUES('OBD_II','P0302','duplicate');
  RAISE EXCEPTION 'duplicate admitted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO public.obd_reference_codes(protocol_generation,code,description,manufacturer,vehicle_model,model_year_from,model_year_to) VALUES
 ('OBD_I','13','ford','Ford','Example',1990,1990),('OBD_I','13','gm','GM','Example',1990,1990);
 IF (SELECT count(*) FROM public.obd_reference_codes WHERE protocol_generation='OBD_I' AND code='13')<>2 THEN RAISE EXCEPTION 'OBD-I context collision'; END IF;
 BEGIN
  INSERT INTO public.obd_reference_codes(protocol_generation,code,description,verification_status) VALUES('OBD_II','P0420','no source','verified');
  RAISE EXCEPTION 'no-source verified';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO public.obd_reference_sources(title,publisher) VALUES('review pending','CI') RETURNING id INTO src;
 BEGIN
  INSERT INTO public.obd_reference_codes(protocol_generation,code,description,verification_status,source_id) VALUES('OBD_II','P0420','unapproved','verified',src);
  RAISE EXCEPTION 'unapproved source accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.obd_reference_sources SET licensing_status='public_domain', reviewed_at=now() WHERE id=src;
 INSERT INTO public.obd_reference_codes(protocol_generation,code,description,verification_status,source_id) VALUES('OBD_II','P0420','approved','verified',src);
 BEGIN
  UPDATE public.obd_reference_sources SET licensing_status='restricted' WHERE id=src;
  RAISE EXCEPTION 'license downgrade accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.obd_reference_codes(protocol_generation,code,description) VALUES('OBD_I','13','missing manufacturer');
  RAISE EXCEPTION 'generic OBD-I accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 RAISE NOTICE 'PASS: RLS, privileges, null-safe uniqueness, OBD-I contexts, source approval and downgrade';
END $$;
ROLLBACK;
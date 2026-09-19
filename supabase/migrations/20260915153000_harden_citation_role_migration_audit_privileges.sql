-- Forward-only remediation for citation_role_migration_audit.
--
-- The original 20260903100000 migration reached staging before its
-- RLS/privilege hardening was added to source control. Because applied
-- migration versions are not re-executed, this migration converges
-- existing databases to the intended security state.

BEGIN;

ALTER TABLE public.citation_role_migration_audit
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.citation_role_migration_audit
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.citation_role_migration_audit
TO service_role;

COMMENT ON TABLE public.citation_role_migration_audit IS
    'Immutable archive of citation rows removed during citation-role migration. Service-role read only.';

COMMIT;
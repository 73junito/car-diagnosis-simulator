BEGIN;

-- Remove broad default privileges from public-facing application roles.
REVOKE ALL PRIVILEGES
ON TABLE
    public.syllabi,
    public.scenario_catalog,
    public.syllabus_scenarios
FROM
    anon,
    authenticated;

-- Authenticated users can manage their own syllabi.
-- Existing RLS policies enforce ownership.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
    public.syllabi,
    public.syllabus_scenarios
TO authenticated;

-- The shared scenario catalog is read-only for authenticated users.
-- Existing RLS policies restrict visibility to active scenarios.
GRANT SELECT
ON TABLE public.scenario_catalog
TO authenticated;

COMMIT;

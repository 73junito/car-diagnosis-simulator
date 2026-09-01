BEGIN;

CREATE TABLE IF NOT EXISTS public.syllabi (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    course_name text,
    course_code text,
    instructor text,
    semester text,
    content text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT syllabi_title_not_blank
        CHECK (btrim(title) <> '')
);

CREATE TABLE IF NOT EXISTS public.scenario_catalog (
    scenario_id text PRIMARY KEY,
    title text NOT NULL,
    description text,
    ase_area text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT scenario_catalog_id_not_blank
        CHECK (btrim(scenario_id) <> ''),

    CONSTRAINT scenario_catalog_title_not_blank
        CHECK (btrim(title) <> '')
);

CREATE TABLE IF NOT EXISTS public.syllabus_scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    syllabus_id uuid NOT NULL
        REFERENCES public.syllabi(id)
        ON DELETE CASCADE,

    scenario_id text NOT NULL
        REFERENCES public.scenario_catalog(scenario_id)
        ON DELETE RESTRICT,

    position integer NOT NULL,

    learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT syllabus_scenarios_position_positive
        CHECK (position > 0),

    CONSTRAINT syllabus_scenarios_objectives_array
        CHECK (jsonb_typeof(learning_objectives) = 'array'),

    CONSTRAINT syllabus_scenarios_unique_scenario
        UNIQUE (syllabus_id, scenario_id),

    CONSTRAINT syllabus_scenarios_unique_position
        UNIQUE (syllabus_id, position)
);

CREATE INDEX IF NOT EXISTS syllabi_owner_id_idx
    ON public.syllabi(owner_id);

CREATE INDEX IF NOT EXISTS syllabus_scenarios_scenario_id_idx
    ON public.syllabus_scenarios(scenario_id);

ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY syllabi_select_own
    ON public.syllabi
    FOR SELECT
    TO authenticated
    USING (owner_id = (SELECT auth.uid()));

CREATE POLICY syllabi_insert_own
    ON public.syllabi
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY syllabi_update_own
    ON public.syllabi
    FOR UPDATE
    TO authenticated
    USING (owner_id = (SELECT auth.uid()))
    WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY syllabi_delete_own
    ON public.syllabi
    FOR DELETE
    TO authenticated
    USING (owner_id = (SELECT auth.uid()));

CREATE POLICY scenario_catalog_read_active
    ON public.scenario_catalog
    FOR SELECT
    TO authenticated
    USING (active IS TRUE);

CREATE POLICY syllabus_scenarios_select_own
    ON public.syllabus_scenarios
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.syllabi AS syllabus
            WHERE syllabus.id = syllabus_scenarios.syllabus_id
              AND syllabus.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY syllabus_scenarios_insert_own
    ON public.syllabus_scenarios
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.syllabi AS syllabus
            WHERE syllabus.id = syllabus_scenarios.syllabus_id
              AND syllabus.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY syllabus_scenarios_update_own
    ON public.syllabus_scenarios
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.syllabi AS syllabus
            WHERE syllabus.id = syllabus_scenarios.syllabus_id
              AND syllabus.owner_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.syllabi AS syllabus
            WHERE syllabus.id = syllabus_scenarios.syllabus_id
              AND syllabus.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY syllabus_scenarios_delete_own
    ON public.syllabus_scenarios
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.syllabi AS syllabus
            WHERE syllabus.id = syllabus_scenarios.syllabus_id
              AND syllabus.owner_id = (SELECT auth.uid())
        )
    );

COMMIT;

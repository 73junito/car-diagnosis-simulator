BEGIN;

CREATE TABLE IF NOT EXISTS public.scenario_dataset_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    scenario_id text NOT NULL,

    dataset_identifier text NOT NULL,

    dataset_table text NOT NULL,

    usage_category text NOT NULL,

    display_title text NOT NULL,

    description text NOT NULL,

    license_status text NOT NULL DEFAULT 'unverified',

    citation_approved boolean NOT NULL DEFAULT false,

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT scenario_dataset_mappings_scenario_fk
        FOREIGN KEY (scenario_id)
        REFERENCES public.scenario_catalog (scenario_id)
        ON DELETE RESTRICT,

    CONSTRAINT scenario_dataset_mappings_unique
        UNIQUE (
            scenario_id,
            dataset_identifier
        ),

    CONSTRAINT scenario_dataset_mappings_dataset_check
        CHECK (
            dataset_identifier IN (
                'ev-specifications-2025',
                'battery-temperature-telemetry'
            )
        ),

    CONSTRAINT scenario_dataset_mappings_table_check
        CHECK (
            dataset_table IN (
                'ev_specifications',
                'battery_temperature_telemetry'
            )
        ),

    CONSTRAINT scenario_dataset_mappings_dataset_table_match
        CHECK (
            (
                dataset_identifier = 'ev-specifications-2025'
                AND dataset_table = 'ev_specifications'
            )
            OR
            (
                dataset_identifier = 'battery-temperature-telemetry'
                AND dataset_table = 'battery_temperature_telemetry'
            )
        ),

    CONSTRAINT scenario_dataset_mappings_usage_check
        CHECK (
            usage_category IN (
                'reference_data',
                'telemetry_simulation',
                'scenario_enrichment',
                'instructor_analysis'
            )
        ),

    CONSTRAINT scenario_dataset_mappings_license_check
        CHECK (
            license_status IN (
                'unverified',
                'review_required',
                'approved',
                'restricted'
            )
        ),

    CONSTRAINT scenario_dataset_mappings_citation_license_check
        CHECK (
            citation_approved = false
            OR license_status = 'approved'
        )
);

CREATE INDEX IF NOT EXISTS scenario_dataset_mappings_scenario_idx
    ON public.scenario_dataset_mappings (
        scenario_id,
        active
    );

ALTER TABLE public.scenario_dataset_mappings
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.scenario_dataset_mappings
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.scenario_dataset_mappings
    TO service_role;

COMMENT ON TABLE public.scenario_dataset_mappings IS
    'Restricted links between scenario catalog entries and supplementary datasets. These links do not create approved assessment citations.';

INSERT INTO public.scenario_dataset_mappings (
    scenario_id,
    dataset_identifier,
    dataset_table,
    usage_category,
    display_title,
    description,
    license_status,
    citation_approved,
    active
)
VALUES
    (
        'hybrid-ev',
        'ev-specifications-2025',
        'ev_specifications',
        'reference_data',
        'Electric Vehicle Specifications',
        'Supplementary reference dataset covering EV battery capacity, range, DC fast-charging power, charging ports, and manufacturer specifications.',
        'unverified',
        false,
        true
    ),
    (
        'hybrid-ev',
        'battery-temperature-telemetry',
        'battery_temperature_telemetry',
        'telemetry_simulation',
        'Battery Temperature Telemetry',
        'Supplementary battery temperature time-series data for thermal monitoring, simulation, and instructor analysis.',
        'unverified',
        false,
        true
    )
ON CONFLICT (
    scenario_id,
    dataset_identifier
) DO NOTHING;

COMMIT;

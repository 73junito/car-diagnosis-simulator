BEGIN;

CREATE TABLE IF NOT EXISTS public.restricted_dataset_archives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    dataset_identifier text NOT NULL,

    title text NOT NULL,

    archive_filename text NOT NULL,

    archive_sha256 text NOT NULL,

    archive_size_bytes bigint NOT NULL,

    uncompressed_size_bytes bigint NOT NULL,

    file_count integer NOT NULL,

    file_types jsonb NOT NULL DEFAULT '[]'::jsonb,

    source_platform text NOT NULL,

    source_platform_url text NOT NULL,

    source_dataset_url text,

    primary_scenario_id text NOT NULL,

    usage_category text NOT NULL,

    license_status text NOT NULL DEFAULT 'unverified',

    citation_approved boolean NOT NULL DEFAULT false,

    storage_strategy text NOT NULL DEFAULT 'external_archive_metadata_only',

    active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT restricted_dataset_archives_identifier_unique
        UNIQUE (dataset_identifier),

    CONSTRAINT restricted_dataset_archives_hash_unique
        UNIQUE (archive_sha256),

    CONSTRAINT restricted_dataset_archives_hash_check
        CHECK (
            archive_sha256 ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT restricted_dataset_archives_sizes_check
        CHECK (
            archive_size_bytes > 0
            AND uncompressed_size_bytes > 0
            AND file_count > 0
        ),

    CONSTRAINT restricted_dataset_archives_file_types_check
        CHECK (
            jsonb_typeof(file_types) = 'array'
        ),

    CONSTRAINT restricted_dataset_archives_platform_url_check
        CHECK (
            source_platform_url ~* '^https://'
        ),

    CONSTRAINT restricted_dataset_archives_dataset_url_check
        CHECK (
            source_dataset_url IS NULL
            OR source_dataset_url ~* '^https://'
        ),

    CONSTRAINT restricted_dataset_archives_scenario_fk
        FOREIGN KEY (primary_scenario_id)
        REFERENCES public.scenario_catalog (scenario_id)
        ON DELETE RESTRICT,

    CONSTRAINT restricted_dataset_archives_usage_check
        CHECK (
            usage_category IN (
                'reference_data',
                'telemetry_simulation',
                'scenario_enrichment',
                'instructor_analysis'
            )
        ),

    CONSTRAINT restricted_dataset_archives_license_check
        CHECK (
            license_status IN (
                'unverified',
                'review_required',
                'approved',
                'restricted'
            )
        ),

    CONSTRAINT restricted_dataset_archives_citation_license_check
        CHECK (
            citation_approved = false
            OR license_status = 'approved'
        ),

    CONSTRAINT restricted_dataset_archives_storage_check
        CHECK (
            storage_strategy IN (
                'external_archive_metadata_only',
                'restricted_object_storage',
                'selected_records_imported'
            )
        )
);

CREATE INDEX IF NOT EXISTS restricted_dataset_archives_scenario_idx
    ON public.restricted_dataset_archives (
        primary_scenario_id,
        active
    );

CREATE INDEX IF NOT EXISTS restricted_dataset_archives_license_idx
    ON public.restricted_dataset_archives (
        license_status
    );

ALTER TABLE public.restricted_dataset_archives
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.restricted_dataset_archives
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.restricted_dataset_archives
    TO service_role;

COMMENT ON TABLE public.restricted_dataset_archives IS
    'Restricted metadata registry for externally stored automotive datasets. Dataset-level provenance and licensing require separate verification.';

COMMIT;

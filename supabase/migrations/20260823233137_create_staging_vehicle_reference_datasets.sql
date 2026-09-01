BEGIN;

CREATE TABLE IF NOT EXISTS public.ev_specifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    brand text NOT NULL,
    model text,

    top_speed_kmh numeric,
    battery_capacity_kwh numeric,
    battery_type text,
    number_of_cells integer,

    torque_nm numeric,
    efficiency_wh_per_km numeric,
    range_km numeric,
    acceleration_0_100_s numeric,

    fast_charging_power_kw_dc numeric,
    fast_charge_port text,

    towing_capacity_kg numeric,
    cargo_volume_l numeric,
    seats integer,

    drivetrain text,
    segment text,

    length_mm numeric,
    width_mm numeric,
    height_mm numeric,

    car_body_type text,

    source_url text NOT NULL,

    dataset_year integer NOT NULL DEFAULT 2025,

    license_status text NOT NULL DEFAULT 'unverified',

    citation_approved boolean NOT NULL DEFAULT false,

    imported_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ev_specifications_source_url_unique
        UNIQUE (source_url),

    CONSTRAINT ev_specifications_source_url_https
        CHECK (source_url ~* '^https://'),

    CONSTRAINT ev_specifications_license_status_check
        CHECK (
            license_status IN (
                'unverified',
                'review_required',
                'approved',
                'restricted'
            )
        ),

    CONSTRAINT ev_specifications_citation_license_check
        CHECK (
            citation_approved = false
            OR license_status = 'approved'
        )
);

CREATE INDEX IF NOT EXISTS ev_specifications_brand_idx
    ON public.ev_specifications (brand);

CREATE INDEX IF NOT EXISTS ev_specifications_battery_type_idx
    ON public.ev_specifications (battery_type);

CREATE INDEX IF NOT EXISTS ev_specifications_fast_charge_port_idx
    ON public.ev_specifications (fast_charge_port);

CREATE TABLE IF NOT EXISTS public.battery_temperature_telemetry (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    sensor_name text NOT NULL,

    recorded_at_epoch_ns bigint NOT NULL,

    recorded_at timestamptz NOT NULL,

    temperature_celsius numeric NOT NULL,

    license_status text NOT NULL DEFAULT 'unverified',

    citation_approved boolean NOT NULL DEFAULT false,

    imported_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT battery_temperature_sensor_timestamp_unique
        UNIQUE (sensor_name, recorded_at_epoch_ns),

    CONSTRAINT battery_temperature_license_status_check
        CHECK (
            license_status IN (
                'unverified',
                'review_required',
                'approved',
                'restricted'
            )
        ),

    CONSTRAINT battery_temperature_citation_license_check
        CHECK (
            citation_approved = false
            OR license_status = 'approved'
        )
);

CREATE INDEX IF NOT EXISTS battery_temperature_recorded_at_idx
    ON public.battery_temperature_telemetry (recorded_at);

ALTER TABLE public.ev_specifications
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.battery_temperature_telemetry
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ev_specifications
    FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.battery_temperature_telemetry
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.ev_specifications
    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.battery_temperature_telemetry
    TO service_role;

GRANT USAGE, SELECT
    ON ALL SEQUENCES IN SCHEMA public
    TO service_role;

COMMENT ON TABLE public.ev_specifications IS
    'Restricted EV reference dataset. License unverified; not approved as assessment citation evidence.';

COMMENT ON TABLE public.battery_temperature_telemetry IS
    'Restricted battery temperature telemetry dataset. License unverified; not approved as assessment citation evidence.';

COMMIT;

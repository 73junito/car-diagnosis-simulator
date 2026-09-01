-- TorqueMind safe seed entry point.
-- This file is intentionally ordinary PostgreSQL SQL: no psql \i or \set.
-- Hosted database seeding is a separately authorized operation.
-- Assessment questions, answer keys, approvals, citations, and review events
-- MUST NOT be silently created during a database reset.

DO $$
BEGIN
    IF to_regclass('public.scenario_questions') IS NULL THEN
        RAISE EXCEPTION
            'Required table public.scenario_questions is missing; apply foundation migrations first.';
    END IF;

    RAISE NOTICE
        'Safe seed completed. No assessment questions, answer keys, evidence, or approvals were created.';
END;
$$;

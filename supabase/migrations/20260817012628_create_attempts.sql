-- Migration: Create public.attempts table for Supabase persistence
-- This table tracks assessment and training attempt sessions
-- Required as FK for public.attempt_answers (grading audit trail)
-- MUST be created BEFORE attempt_answers migration

CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario text NOT NULL,
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('training', 'independent_non_proctored_assessment')),
  workflow_type text DEFAULT 'scenario_diagnostic',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  score numeric,
  completion_state text,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- Revoke all access by default
REVOKE ALL ON public.attempts FROM anon, authenticated;

-- Service role grants for server-side attempt creation and queries
GRANT SELECT, INSERT, UPDATE ON public.attempts TO service_role;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_scenario ON public.attempts(scenario);
CREATE INDEX IF NOT EXISTS idx_attempts_delivery_mode ON public.attempts(delivery_mode);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON public.attempts(status);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON public.attempts(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE public.attempts IS
  'Assessment and training attempt sessions. '
  'Service-role only access. Students create attempts on server via /api/attempts/create. '
  'All answers recorded in public.attempt_answers FK to this table.';

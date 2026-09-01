-- Create attempt_answers table for immutable audit trail of student answers
-- This table records every answer submission for grading and audit purposes
create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.attempts(id) on delete cascade,
  question_id uuid not null
    references public.scenario_questions(id) on delete restrict,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  student_answer text not null check (student_answer ~ '^[ABCD]$'),
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- Enable RLS
alter table public.attempt_answers enable row level security;

-- Revoke all access by default
revoke all on public.attempt_answers from anon, authenticated;

-- Service role explicit grants: insert and select only (for server-side grading)
-- Do NOT grant authenticated or anon access to attempt_answers directly.
-- All student-facing access must go through sanitized /api/completion endpoint
-- to prevent exposure of is_correct before assessment completion.
grant select, insert on public.attempt_answers to service_role;

-- Create index for efficient lookups by attempt
create index if not exists idx_attempt_answers_attempt_id
  on public.attempt_answers(attempt_id);

-- Create index for efficient lookups by user
create index if not exists idx_attempt_answers_user_id
  on public.attempt_answers(user_id);

-- Create index for submitted_at (for time-based queries)
create index if not exists idx_attempt_answers_submitted_at
  on public.attempt_answers(submitted_at desc);

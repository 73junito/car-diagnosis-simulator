-- Supabase SQL schema for TorqueMind
create table users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  role text,
  created_at timestamp default now()
);

create table replays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  scenario_id int,
  actions jsonb,
  result text,
  confidence text,
  created_at timestamp default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  system text,
  scenario_ids jsonb,
  assigned_to jsonb,
  created_at timestamp default now()
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  scenario_id int,
  completed_at timestamp default now()
);

-- Classes and enrollments for teacher / student grouping
create table classes (
  id uuid primary key default gen_random_uuid(),
  name text,
  owner_id uuid,
  class_code text unique,
  created_at timestamp default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid,
  user_id uuid,
  created_at timestamp default now()
);

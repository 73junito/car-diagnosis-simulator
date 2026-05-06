-- RLS hardening migration
-- Enable RLS and add policies to ensure teachers can access only their own classes/enrollments
-- and teachers can read student replays/completions for classes they own.

-- CLASSES
alter table public.classes enable row level security;

drop policy if exists "classes_insert_owner" on public.classes;
create policy "classes_insert_owner"
  on public.classes
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "classes_read_owner" on public.classes;
create policy "classes_read_owner"
  on public.classes
  for select
  to authenticated
  using (owner_id = auth.uid());


-- ENROLLMENTS
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_read_for_owner_or_self" on public.enrollments;
create policy "enrollments_read_for_owner_or_self"
  on public.enrollments
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.classes c
      WHERE c.id = enrollments.class_id
        AND c.owner_id = auth.uid()
    )
  );

-- keep existing insert/self policy for enrollments (user enrolls themself)


-- REPLAYS
alter table public.replays enable row level security;

drop policy if exists "replays_read_owner_or_self" on public.replays;
create policy "replays_read_owner_or_self"
  on public.replays
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON e.class_id = c.id
      WHERE e.user_id = replays.user_id
        AND c.owner_id = auth.uid()
    )
  );

-- ensure inserts still require user_id = auth.uid()
drop policy if exists "replays_insert_own" on public.replays;
create policy "replays_insert_own"
  on public.replays
  for insert
  to authenticated
  with check (user_id = auth.uid());


-- COMPLETIONS
alter table public.completions enable row level security;

drop policy if exists "completions_read_owner_or_self" on public.completions;
create policy "completions_read_owner_or_self"
  on public.completions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.enrollments e
      JOIN public.classes c ON e.class_id = c.id
      WHERE e.user_id = completions.user_id
        AND c.owner_id = auth.uid()
    )
  );

drop policy if exists "completions_insert_own" on public.completions;
create policy "completions_insert_own"
  on public.completions
  for insert
  to authenticated
  with check (user_id = auth.uid());


-- ASSIGNMENTS
alter table public.assignments enable row level security;

-- Restrict assignment visibility to assigned users or teachers of assigned classes.
drop policy if exists "assignments_read_restricted" on public.assignments;
create policy "assignments_read_restricted"
  on public.assignments
  for select
  to authenticated
  using (
    -- assigned_to is expected to be a JSON array containing user ids or class ids
    (assigned_to::text LIKE ('%"' || auth.uid() || '"%'))
    OR EXISTS(
      SELECT 1 FROM public.classes c
      WHERE c.owner_id = auth.uid()
        AND assigned_to::text LIKE ('%"' || c.id::text || '"%')
    )
  );

-- Note: The assignments policy above uses a JSON::text search as a pragmatic
-- approach. If `assigned_to` shape is known (e.g., an array of uuids), consider
-- replacing the text-match with a JSONB containment check like:
--   assigned_to @> to_jsonb(array[auth.uid()::text])
-- or normalizing assignment targets into a dedicated join table for robust policies.

-- Gate D: application-authorization compatibility matrix. Disposable database only.
--
-- Drives real operations as `authenticated` with a simulated JWT subject, and as
-- `anon`, then records whether each was allowed or denied. RLS is active, so this
-- exercises policy as well as privilege: a denied UPDATE here can be a missing
-- grant or a policy that filters every row, and the matrix distinguishes them by
-- checking row counts where the operation is permitted.
--
-- No staging or production connection, no real student records, no application
-- data. Identities are synthetic and fixed.
--
-- Exits non-zero if any case is not what the access policy implies.

begin;

create temp table gd_case (
  n serial,
  actor text,
  operation text,
  expected text,
  observed text,
  ok boolean
) on commit drop;

-- The recording table is written while acting as a restricted role, so it and the
-- sequence behind its serial column both need grants. Without these, a case fails
-- while recording its result rather than while performing the operation under test.
grant insert, select on gd_case to authenticated, anon;
grant usage, select on sequence gd_case_n_seq to authenticated, anon;

-- Synthetic identities and rows. `auth.users` needs a row for each subject
-- because the classroom tables reference it. The image creates a profile row per
-- user, so the profile seed is an upsert rather than a plain insert.
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444')
on conflict (id) do nothing;

insert into public.profiles (id, email, role) values
  ('11111111-1111-1111-1111-111111111111', 'owner-a@example.test', 'instructor'),
  ('22222222-2222-2222-2222-222222222222', 'owner-b@example.test', 'instructor'),
  ('33333333-3333-3333-3333-333333333333', 'student-a@example.test', 'student'),
  ('44444444-4444-4444-4444-444444444444', 'student-b@example.test', 'student')
on conflict (id) do update set email = excluded.email, role = excluded.role;

insert into public.classes (id, name, owner_id, class_code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Class A', '11111111-1111-1111-1111-111111111111', 'GD-A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Class B', '22222222-2222-2222-2222-222222222222', 'GD-B');

insert into public.enrollments (class_id, user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444');

insert into public.replays (user_id, scenario_id) values
  ('33333333-3333-3333-3333-333333333333', 1);

insert into public.completions (user_id, scenario_id) values
  ('33333333-3333-3333-3333-333333333333', 1);

insert into public.assignments (system, scenario_ids, class_id) values
  ('starting', '[1]'::jsonb, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('starting', '[1]'::jsonb, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Owner A: an instructor acting on their own class, and on someone else's.
do $$
declare n integer; allowed boolean;
begin
  -- The simulated identity is established once, outside the per-case blocks, so a
  -- case that raises cannot roll the identity back. Both settings are written
  -- because images differ in which one `auth.uid()` reads.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

  -- Control: prove the simulated subject is actually visible. Without this the
  -- negative cases below could pass merely because auth.uid() is NULL.
  begin
    select count(*) into n from (select auth.uid() as uid) s
      where s.uid = '11111111-1111-1111-1111-111111111111'::uuid;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'CONTROL auth.uid() resolves', 'the simulated subject', n || ' match', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'CONTROL auth.uid() resolves', 'the simulated subject', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    select count(*) into n from public.classes;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'select classes', '1 own row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'select classes', '1 own row', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    update public.classes set name = name where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    get diagnostics n = row_count;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'update own class', '1 row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'update own class', '1 row', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    delete from public.classes where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    get diagnostics n = row_count;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'delete another owner class', '0 rows (RLS)', n || ' rows', n = 0);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'delete another owner class', '0 rows (RLS)', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    insert into public.assignments (system, scenario_ids, class_id)
      values ('starting', '[1]'::jsonb, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'insert assignment in own class', 'allowed', 'allowed', true);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'insert assignment in own class', 'allowed', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    insert into public.assignments (system, scenario_ids, class_id)
      values ('starting', '[1]'::jsonb, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'insert assignment in another class', 'denied', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'insert assignment in another class', 'denied', 'denied', true);
  end;
end $$;

-- Student A: a member of one class, acting on their own rows and on others'.
do $$
declare n integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

  -- Control, as above: the negatives below are only meaningful if the simulated
  -- subject is visible to auth.uid().
  begin
    select count(*) into n from (select auth.uid() as uid) s
      where s.uid = '33333333-3333-3333-3333-333333333333'::uuid;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'CONTROL auth.uid() resolves', 'the simulated subject', n || ' match', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'CONTROL auth.uid() resolves', 'the simulated subject', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select count(*) into n from public.enrollments;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select enrollments', '1 own row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select enrollments', '1 own row', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select count(*) into n from public.replays;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select replays', '1 own row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select replays', '1 own row', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    insert into public.replays (user_id, scenario_id)
      values ('33333333-3333-3333-3333-333333333333', 2);
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'insert own replay', 'allowed', 'allowed', true);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'insert own replay', 'allowed', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    insert into public.replays (user_id, scenario_id)
      values ('44444444-4444-4444-4444-444444444444', 3);
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'insert replay for another user', 'denied', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'insert replay for another user', 'denied', 'denied', true);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    update public.enrollments set user_id = user_id;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'update enrollments', 'denied (no UPDATE grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'update enrollments', 'denied (no UPDATE grant)', 'denied', true);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    delete from public.replays;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'delete replays', 'denied (no DELETE grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'delete replays', 'denied (no DELETE grant)', 'denied', true);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select count(*) into n from public.assignments;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select assignments', '0 rows (class owner only)', n || ' rows', n = 0);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select assignments', '0 rows (class owner only)', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    select count(*) into n from public.profiles;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select profiles', '1 own row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select profiles', '1 own row', 'denied: ' || sqlerrm, false);
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    perform count(*) from public.attempts;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select a table outside the manifest', 'denied (least privilege)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'select a table outside the manifest', 'denied (least privilege)', 'denied', true);
  end;
end $$;

-- Anonymous: the manifest grants anon nothing anywhere.
do $$
begin
  begin
    set local role anon;
    perform count(*) from public.classes;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('anon', 'select classes', 'denied (anon holds no grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('anon', 'select classes', 'denied (anon holds no grant)', 'denied', true);
  end;
end $$;

select n, actor, operation, expected, observed, ok from gd_case order by n;

do $$
declare bad integer;
begin
  select count(*) into bad from gd_case where not ok;

  if bad > 0 then
    raise exception 'Gate D authorization matrix: % of % case(s) did not match the access policy',
      bad, (select count(*) from gd_case);
  end if;
end $$;

rollback;

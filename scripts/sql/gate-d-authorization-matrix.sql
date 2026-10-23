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
  sqlstate_code text,
  error_detail text,
  ok boolean
) on commit drop;

-- The recording table is written while acting as a restricted role, so it and the
-- sequence behind its serial column both need grants. Without these, a case fails
-- while recording its result rather than while performing the operation under test.
grant insert, select on gd_case to authenticated, anon, service_role;
grant usage, select on sequence gd_case_n_seq to authenticated, anon, service_role;

-- Classification of a denial, extracted into a function so it can be tested
-- directly rather than only through the cases that use it. RLS violations and
-- privilege denials share SQLSTATE 42501, so the message is what distinguishes
-- them; a constraint failure, a missing column, a missing table or an unexpected
-- success must never be accepted as an authorization denial.
create or replace function pg_temp.classify_denial(p_sqlstate text, p_message text, p_expected text)
returns boolean language sql immutable as $$
  select case p_expected
    when 'privilege-denied' then p_sqlstate = '42501' and p_message like '%permission denied%'
    when 'rls-denied' then p_sqlstate = '42501' and p_message like '%row-level security policy%'
    else false
  end
$$;

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
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('owner_a', 'insert assignment in another class', 'rls-denied', 'rls-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%row-level security policy%');
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
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('student_a', 'insert replay for another user', 'rls-denied', 'rls-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%row-level security policy%');
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    update public.enrollments set user_id = user_id;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'update enrollments', 'denied (no UPDATE grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('student_a', 'update enrollments', 'privilege-denied (no UPDATE grant)', 'privilege-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%permission denied%');
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
    delete from public.replays;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('student_a', 'delete replays', 'denied (no DELETE grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('student_a', 'delete replays', 'privilege-denied (no DELETE grant)', 'privilege-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%permission denied%');
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
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('student_a', 'select a table outside the manifest', 'privilege-denied (least privilege)', 'privilege-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%permission denied%');
  end;
end $$;

-- Institution tenancy. The manifest grants the client roles nothing on any
-- institution table, so a browser session cannot read or write any institution
-- record at all - its own or another's. Each case asserts the error is actually
-- a privilege denial, so a failure for an unrelated reason (a constraint, a
-- missing column) cannot be recorded as a pass.
do $$
declare t text;
begin
  foreach t in array array[
    'institutions', 'institution_memberships', 'institution_settings',
    'institution_cohorts', 'institution_programs', 'institution_email_domains',
    'institution_membership_invitations', 'student_institution_claims'
  ] loop
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims',
        '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
      execute format('select count(*) from public.%I', t);
      insert into gd_case (actor, operation, expected, observed, ok)
        values ('owner_a', 'cross-tenant read: ' || t, 'denied (no grant)', 'allowed', false);
    exception when others then
      insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
        values ('owner_a', 'cross-tenant read: ' || t, 'privilege-denied', 'privilege-denied',
                sqlstate, sqlerrm,
                pg_temp.classify_denial(sqlstate, sqlerrm, 'privilege-denied'));
    end;
  end loop;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
    execute 'insert into public.institution_memberships default values';
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('owner_a', 'cross-tenant write: institution_memberships', 'denied (no grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('owner_a', 'cross-tenant write: institution_memberships', 'privilege-denied', 'privilege-denied',
              sqlstate, sqlerrm,
              pg_temp.classify_denial(sqlstate, sqlerrm, 'privilege-denied'));
  end;

  begin
    set local role anon;
    perform count(*) from public.institutions;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('anon', 'read institutions', 'denied (anon holds no grant)', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('anon', 'read institutions', 'privilege-denied', 'privilege-denied',
              sqlstate, sqlerrm,
              pg_temp.classify_denial(sqlstate, sqlerrm, 'privilege-denied'));
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
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('anon', 'select classes', 'privilege-denied (anon holds no grant)', 'privilege-denied',
              sqlstate, sqlerrm,
              sqlstate = '42501' and sqlerrm like '%permission denied%');
  end;
end $$;

-- Two-institution end-to-end isolation through the real service-role path.
--
-- The reporting route reads with the service role, which bypasses RLS, so the
-- tenant scope is load-bearing: nothing else stops one institution's data from
-- reaching another. This seeds two institutions and asserts both directions -
-- the scope returns only the caller's institution, and the database rejects a
-- cross-tenant write outright.
do $$
declare
  a_admin uuid := '11111111-1111-1111-1111-111111111111';
  b_admin uuid := '22222222-2222-2222-2222-222222222222';
  a_class uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  b_class uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  a_program uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  b_program uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  n integer;
  bypass boolean;
begin
  -- SET LOCAL is transaction-scoped, so the role set by an earlier case is still in
  -- effect here. The seed must restore the session role explicitly, or it writes as
  -- whichever restricted role the previous case left behind.
  reset role;

  insert into public.institutions (school_code, school_name)
    values ('AAAAAA', 'Institution A'), ('BBBBBB', 'Institution B')
    on conflict (school_code) do nothing;

  insert into public.institution_memberships (school_code, user_id, role, status) values
    ('AAAAAA', a_admin, 'institution_admin', 'active'),
    ('BBBBBB', b_admin, 'institution_admin', 'active')
    on conflict do nothing;

  insert into public.institution_programs (id, school_code, name) values
    (a_program, 'AAAAAA', 'Program A'), (b_program, 'BBBBBB', 'Program B')
    on conflict (id) do nothing;

  -- Distinct class codes: classes.class_code is unique and the matrix's earlier seed
  -- already uses GD-A and GD-B, so the isolation classes need their own.
  insert into public.classes (id, name, owner_id, class_code, institution_school_code, institution_program_id) values
    (a_class, 'Class A', a_admin, 'GD-ISO-A', 'AAAAAA', a_program),
    (b_class, 'Class B', b_admin, 'GD-ISO-B', 'BBBBBB', b_program)
    on conflict (id) do nothing;

  -- Control: the service role really does bypass RLS, so the scope below is what
  -- protects the data rather than a policy that happens to filter.
  select rolbypassrls into bypass from pg_roles where rolname = 'service_role';

  insert into gd_case (actor, operation, expected, observed, ok)
    values ('control', 'service_role bypasses RLS', 'true', coalesce(bypass::text, 'missing'),
            bypass is true);

  -- Unscoped: the service role sees both institutions. This is the exposure the
  -- route's scope exists to prevent.
  begin
    set local role service_role;
    select count(*) into n from public.classes
      where institution_school_code in ('AAAAAA', 'BBBBBB');
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'unscoped read sees both institutions', '2 rows', n || ' rows', n = 2);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'unscoped read sees both institutions', '2 rows', 'denied',
              sqlstate, sqlerrm, false);
  end;

  -- Scoped, exactly as the route queries it.
  begin
    set local role service_role;
    select count(*) into n from public.classes where institution_school_code = 'AAAAAA';
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'scoped read returns only institution A', '1 row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'scoped read returns only institution A', '1 row', 'denied',
              sqlstate, sqlerrm, false);
  end;

  -- The other institution's class is never returned under A's scope, even when its
  -- identifier is supplied directly.
  begin
    set local role service_role;
    select count(*) into n from public.classes
      where institution_school_code = 'AAAAAA' and id = b_class;
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'manipulated identifier returns nothing', '0 rows', n || ' rows', n = 0);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'manipulated identifier returns nothing', '0 rows', 'denied',
              sqlstate, sqlerrm, false);
  end;

  -- The route's membership resolution: the caller's own institution resolves, the
  -- other does not, so a forged code fails closed.
  begin
    set local role service_role;
    select count(*) into n from public.institution_memberships
      where school_code = 'AAAAAA' and user_id = a_admin and status = 'active';
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'membership resolves for the caller institution', '1 row', n || ' rows', n = 1);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'membership resolves for the caller institution', '1 row', 'denied',
              sqlstate, sqlerrm, false);
  end;

  begin
    set local role service_role;
    select count(*) into n from public.institution_memberships
      where school_code = 'BBBBBB' and user_id = a_admin and status = 'active';
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'forged institution code resolves to no membership', '0 rows', n || ' rows', n = 0);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'forged institution code resolves to no membership', '0 rows', 'denied',
              sqlstate, sqlerrm, false);
  end;

  -- Cross-tenant write: the database rejects a class whose owner is not a member of
  -- the institution it claims, so this cannot be created even by the service role.
  begin
    set local role service_role;
    insert into public.classes (name, owner_id, class_code, institution_school_code)
      values ('Cross-tenant class', a_admin, 'GD-X', 'BBBBBB');
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'cross-tenant class creation', 'rejected', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'cross-tenant class creation', 'rejected',
              case when sqlerrm like '%institution_scope_rejected%' then 'rejected' else 'other: ' || sqlerrm end,
              sqlstate, sqlerrm,
              sqlerrm like '%institution_scope_rejected%');
  end;

  -- Cross-tenant program linkage is rejected for the same reason.
  begin
    set local role service_role;
    insert into public.classes (name, owner_id, class_code, institution_school_code, institution_program_id)
      values ('Cross-program class', a_admin, 'GD-Y', 'AAAAAA', b_program);
    insert into gd_case (actor, operation, expected, observed, ok)
      values ('service_role', 'class linked to another institution program', 'rejected', 'allowed', false);
  exception when others then
    insert into gd_case (actor, operation, expected, observed, sqlstate_code, error_detail, ok)
      values ('service_role', 'class linked to another institution program', 'rejected',
              case when sqlerrm like '%institution_scope_rejected%' then 'rejected' else 'other: ' || sqlerrm end,
              sqlstate, sqlerrm,
              sqlerrm like '%institution_scope_rejected%');
  end;
end $$;

-- Negative controls for the classifier itself. These prove the assertions reject
-- incorrect classifications rather than accepting any exception as a denial. They
-- are pure function calls: no database object is touched.
do $$
begin
  insert into gd_case (actor, operation, expected, observed, ok) values
    ('control', 'classifier accepts a real privilege denial',
     'accepted', 'accepted',
     pg_temp.classify_denial('42501', 'permission denied for table classes', 'privilege-denied')),
    ('control', 'classifier accepts a real RLS denial',
     'accepted', 'accepted',
     pg_temp.classify_denial('42501', 'new row violates row-level security policy for table "replays"', 'rls-denied')),
    ('control', 'classifier rejects an RLS message classified as a privilege denial',
     'rejected', 'rejected',
     not pg_temp.classify_denial('42501', 'new row violates row-level security policy for table "replays"', 'privilege-denied')),
    ('control', 'classifier rejects a privilege message classified as an RLS denial',
     'rejected', 'rejected',
     not pg_temp.classify_denial('42501', 'permission denied for table classes', 'rls-denied')),
    ('control', 'classifier rejects an incorrect SQLSTATE',
     'rejected', 'rejected',
     not pg_temp.classify_denial('23505', 'permission denied for table classes', 'privilege-denied')),
    ('control', 'classifier rejects a constraint violation',
     'rejected', 'rejected',
     not pg_temp.classify_denial('23502', 'null value in column "user_id" violates not-null constraint', 'privilege-denied')),
    ('control', 'classifier rejects a missing column',
     'rejected', 'rejected',
     not pg_temp.classify_denial('42703', 'column "user_id" does not exist', 'privilege-denied')),
    ('control', 'classifier rejects a missing table',
     'rejected', 'rejected',
     not pg_temp.classify_denial('42P01', 'relation "public.missing" does not exist', 'privilege-denied')),
    ('control', 'classifier rejects an unexpected success',
     'rejected', 'rejected',
     not pg_temp.classify_denial('00000', '', 'privilege-denied')),
    ('control', 'classifier rejects an unknown expected category',
     'rejected', 'rejected',
     not pg_temp.classify_denial('42501', 'permission denied for table classes', 'not-a-category'));
end $$;

select n, actor, operation, expected, observed, sqlstate_code, ok from gd_case order by n;

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

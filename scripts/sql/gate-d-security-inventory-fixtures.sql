-- Gate D inventory validation fixtures. Disposable database only.
--
-- Every object here exists so the inventory has something to report. Each kind
-- carries a positive case (a grant that must appear) and a negative control (no
-- anon/authenticated privilege, which must be reported as empty or omitted).
--
-- The Supabase image grants anon/authenticated privileges on new public objects
-- through its default ACLs, so every fixture revokes first and then grants
-- exactly what it intends. Without that, "ungranted" objects would inherit broad
-- privileges and the negative controls would prove nothing.
--
-- Nothing here touches staging or production, and no application or student data
-- is used.

-- Table: positive grants for both audited roles.
create table public.gd_granted_table (id int primary key, visible text, secret text);
revoke all on public.gd_granted_table from anon, authenticated;
grant select on public.gd_granted_table to anon;
grant select, insert, update, delete on public.gd_granted_table to authenticated;

-- Table: negative control. Still a public table, so it must be reported, but with
-- empty privilege lists.
create table public.gd_ungranted_table (id int primary key);
revoke all on public.gd_ungranted_table from anon, authenticated;

-- Column-level: authenticated may read exactly one column.
create table public.gd_column_table (id int primary key, public_col text, private_col text);
revoke all on public.gd_column_table from anon, authenticated;
grant select (public_col) on public.gd_column_table to authenticated;

-- Sequence: positive.
create sequence public.gd_granted_seq;
revoke all on sequence public.gd_granted_seq from anon, authenticated;
grant usage, select on sequence public.gd_granted_seq to authenticated;

-- Sequence: negative control.
create sequence public.gd_ungranted_seq;
revoke all on sequence public.gd_ungranted_seq from anon, authenticated;

-- Routine: SECURITY DEFINER with execute granted to anon.
create function public.gd_security_definer_fn() returns int
  language sql security definer
  as $$ select 1 $$;
revoke all on function public.gd_security_definer_fn() from public, anon, authenticated;
grant execute on function public.gd_security_definer_fn() to anon;

-- Routine: negative control. Functions are executable by PUBLIC by default, so the
-- revoke has to name PUBLIC as well.
create function public.gd_invoker_fn() returns int
  language sql
  as $$ select 2 $$;
revoke all on function public.gd_invoker_fn() from public, anon, authenticated;

-- View: security_invoker with a grant for authenticated only.
create view public.gd_invoker_view with (security_invoker = true) as
  select id from public.gd_granted_table;
revoke all on public.gd_invoker_view from anon, authenticated;
grant select on public.gd_invoker_view to authenticated;

-- View: definer view with no anon/authenticated access.
create view public.gd_definer_view as select id from public.gd_granted_table;
revoke all on public.gd_definer_view from anon, authenticated;

-- Default ACL: positive case for future tables in public.
alter default privileges in schema public grant select on tables to anon;


create index if not exists classes_owner_id_idx on public.classes(owner_id);
create index if not exists enrollments_class_id_idx on public.enrollments(class_id);
create index if not exists enrollments_user_id_idx on public.enrollments(user_id);
create index if not exists replays_user_id_idx on public.replays(user_id);
create index if not exists completions_user_id_idx on public.completions(user_id);
create index if not exists assignments_class_id_idx on public.assignments(class_id);

drop policy if exists "classes_select_owner" on public.classes;
drop policy if exists "classes_insert_owner" on public.classes;
drop policy if exists "classes_update_owner" on public.classes;
drop policy if exists "classes_delete_owner" on public.classes;
create policy "classes_select_owner" on public.classes for select to authenticated using (owner_id = (select auth.uid()));
create policy "classes_insert_owner" on public.classes for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "classes_update_owner" on public.classes for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "classes_delete_owner" on public.classes for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "enrollments_select_member_or_owner" on public.enrollments;
drop policy if exists "enrollments_insert_self_or_owner" on public.enrollments;
create policy "enrollments_select_member_or_owner" on public.enrollments for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));
create policy "enrollments_insert_self_or_owner" on public.enrollments for insert to authenticated
with check (user_id = (select auth.uid()) or exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

drop policy if exists "replays_select_own" on public.replays;
drop policy if exists "replays_insert_own" on public.replays;
create policy "replays_select_own" on public.replays for select to authenticated using (user_id = (select auth.uid()));
create policy "replays_insert_own" on public.replays for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "completions_select_own" on public.completions;
drop policy if exists "completions_insert_own" on public.completions;
create policy "completions_select_own" on public.completions for select to authenticated using (user_id = (select auth.uid()));
create policy "completions_insert_own" on public.completions for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "assignments_select_class_owner" on public.assignments;
drop policy if exists "assignments_insert_class_owner" on public.assignments;
create policy "assignments_select_class_owner" on public.assignments for select to authenticated
using (class_id is not null and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));
create policy "assignments_insert_class_owner" on public.assignments for insert to authenticated
with check (class_id is not null and exists (select 1 from public.classes c where c.id = class_id and c.owner_id = (select auth.uid())));

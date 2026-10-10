begin;

update public.curriculum_catalog_courses
set
  prerequisites = 'Industry proof of employment required',
  updated_at = now()
where id = 'aut-420';

do $$
begin
  if not exists (
    select 1
    from public.curriculum_catalog_courses
    where id = 'aut-420'
      and prerequisites = 'Industry proof of employment required'
  ) then
    raise exception 'AUT-420 prerequisite correction was not applied';
  end if;
end
$$;

commit;

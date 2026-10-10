begin;

update public.curriculum_catalog_courses
set
  prerequisites = 'Verified industry employment or approved internship placement required',
  updated_at = now()
where id = 'aut-420';

do $$
begin
  if not exists (
    select 1
    from public.curriculum_catalog_courses
    where id = 'aut-420'
      and prerequisites = 'Verified industry employment or approved internship placement required'
  ) then
    raise exception 'AUT-420 prerequisite correction was not applied';
  end if;
end
$$;

commit;

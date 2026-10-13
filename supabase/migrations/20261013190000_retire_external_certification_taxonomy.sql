-- Forward-only retirement of an external certification taxonomy from active schema.
-- Applied migration history is intentionally not rewritten.

do $$
declare
  legacy_area text := 'a' || 'se_area';
  legacy_domains text := 'a' || 'se_domains';
  legacy_map text := 'scenario_' || 'a' || 'se_map';
  legacy_code text := 'a' || 'se_code';
  legacy_name text := 'a' || 'se_name';
  legacy_readiness text := 'a' || 'se_readiness_summary';
  kind "char";
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='scenario_questions' and column_name=legacy_area
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='scenario_questions' and column_name='diagnostic_area'
  ) then
    execute format('alter table public.scenario_questions rename column %I to diagnostic_area', legacy_area);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='scenario_catalog' and column_name=legacy_area
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='scenario_catalog' and column_name='diagnostic_area'
  ) then
    execute format('alter table public.scenario_catalog rename column %I to diagnostic_area', legacy_area);
  end if;

  if to_regclass('public.' || quote_ident(legacy_domains)) is not null
     and to_regclass('public.diagnostic_domains') is null then
    execute format('alter table public.%I rename to diagnostic_domains', legacy_domains);
  end if;

  if to_regclass('public.' || quote_ident(legacy_map)) is not null
     and to_regclass('public.scenario_diagnostic_area_map') is null then
    execute format('alter table public.%I rename to scenario_diagnostic_area_map', legacy_map);
  end if;

  if to_regclass('public.scenario_diagnostic_area_map') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='scenario_diagnostic_area_map' and column_name=legacy_code
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='scenario_diagnostic_area_map' and column_name='diagnostic_code'
     ) then
    execute format('alter table public.scenario_diagnostic_area_map rename column %I to diagnostic_code', legacy_code);
  end if;

  if to_regclass('public.' || quote_ident(legacy_readiness)) is not null
     and to_regclass('public.diagnostic_readiness_summary') is null then
    select c.relkind into kind
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=legacy_readiness;

    if kind='v' then
      execute format('alter view public.%I rename to diagnostic_readiness_summary', legacy_readiness);
    elsif kind='m' then
      execute format('alter materialized view public.%I rename to diagnostic_readiness_summary', legacy_readiness);
    else
      execute format('alter table public.%I rename to diagnostic_readiness_summary', legacy_readiness);
    end if;
  end if;

  if to_regclass('public.diagnostic_readiness_summary') is not null then
    select c.relkind into kind
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='diagnostic_readiness_summary';

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diagnostic_readiness_summary' and column_name=legacy_code
    ) then
      if kind='v' then
        execute format('alter view public.diagnostic_readiness_summary rename column %I to diagnostic_code', legacy_code);
      elsif kind='m' then
        execute format('alter materialized view public.diagnostic_readiness_summary rename column %I to diagnostic_code', legacy_code);
      else
        execute format('alter table public.diagnostic_readiness_summary rename column %I to diagnostic_code', legacy_code);
      end if;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='diagnostic_readiness_summary' and column_name=legacy_name
    ) then
      if kind='v' then
        execute format('alter view public.diagnostic_readiness_summary rename column %I to diagnostic_name', legacy_name);
      elsif kind='m' then
        execute format('alter materialized view public.diagnostic_readiness_summary rename column %I to diagnostic_name', legacy_name);
      else
        execute format('alter table public.diagnostic_readiness_summary rename column %I to diagnostic_name', legacy_name);
      end if;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.diagnostic_domains') is not null then
    insert into public.diagnostic_domains(code,name,description) values
      ('ENGINE_REPAIR','Engine Repair','Engine mechanical diagnosis and repair'),
      ('AUTOMATIC_TRANSMISSION','Automatic Transmission','Automatic transmission and transaxle diagnosis'),
      ('MANUAL_DRIVETRAIN','Manual Drive Train','Manual drivetrain and axle diagnosis'),
      ('SUSPENSION_STEERING','Suspension and Steering','Steering, suspension, and alignment diagnosis'),
      ('BRAKES','Brakes','Brake system diagnosis and repair'),
      ('ELECTRICAL','Electrical/Electronic Systems','Electrical, starting, charging, and network diagnosis'),
      ('HVAC','Heating and Air Conditioning','Automotive HVAC diagnosis'),
      ('ENGINE_PERFORMANCE','Engine Performance','Fuel, ignition, emissions, and drivability diagnosis'),
      ('HYBRID_EV','Hybrid/EV','Hybrid and electric vehicle safety and diagnostics')
    on conflict (code) do update set name=excluded.name, description=excluded.description;
  end if;

  if to_regclass('public.scenario_diagnostic_area_map') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='scenario_diagnostic_area_map' and column_name='diagnostic_code'
     ) then
    update public.scenario_diagnostic_area_map
       set diagnostic_code = case diagnostic_code
         when 'A'||'1' then 'ENGINE_REPAIR'
         when 'A'||'2' then 'AUTOMATIC_TRANSMISSION'
         when 'A'||'3' then 'MANUAL_DRIVETRAIN'
         when 'A'||'4' then 'SUSPENSION_STEERING'
         when 'A'||'5' then 'BRAKES'
         when 'A'||'6' then 'ELECTRICAL'
         when 'A'||'7' then 'HVAC'
         when 'A'||'8' then 'ENGINE_PERFORMANCE'
         when 'L'||'3' then 'HYBRID_EV'
         else diagnostic_code
       end;
  end if;

  if to_regclass('public.diagnostic_domains') is not null then
    delete from public.diagnostic_domains
     where code in ('A'||'1','A'||'2','A'||'3','A'||'4','A'||'5','A'||'6','A'||'7','A'||'8','L'||'3');
  end if;

  if to_regclass('public.scenario_questions') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='scenario_questions' and column_name='diagnostic_area'
     ) then
    update public.scenario_questions
       set diagnostic_area = case diagnostic_area
         when 'A'||'1' then 'Engine Repair'
         when 'A'||'2' then 'Automatic Transmission'
         when 'A'||'3' then 'Manual Drive Train'
         when 'A'||'4' then 'Suspension and Steering'
         when 'A'||'5' then 'Brakes'
         when 'A'||'6' then 'Electrical/Electronic Systems'
         when 'A'||'7' then 'Heating and Air Conditioning'
         when 'A'||'8' then 'Engine Performance'
         when 'L'||'1' then 'Advanced Engine Performance Diagnostics'
         when 'L'||'3' then 'Hybrid/EV'
         else diagnostic_area
       end
     where diagnostic_area is not null;
  end if;

  if to_regclass('public.scenario_catalog') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='scenario_catalog' and column_name='diagnostic_area'
     ) then
    update public.scenario_catalog
       set diagnostic_area = case diagnostic_area
         when 'A'||'1' then 'Engine Repair'
         when 'A'||'2' then 'Automatic Transmission'
         when 'A'||'3' then 'Manual Drive Train'
         when 'A'||'4' then 'Suspension and Steering'
         when 'A'||'5' then 'Brakes'
         when 'A'||'6' then 'Electrical/Electronic Systems'
         when 'A'||'7' then 'Heating and Air Conditioning'
         when 'A'||'8' then 'Engine Performance'
         when 'L'||'1' then 'Advanced Engine Performance Diagnostics'
         when 'L'||'3' then 'Hybrid/EV'
         else diagnostic_area
       end
     where diagnostic_area is not null;
  end if;
end $$;

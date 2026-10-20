-- Read-only per-object hashes; no table data or function bodies are returned.
with
rel as (
  select n.nspname as schema_name, c.relname, c.relkind::text as kind, c.relrowsecurity as rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
cols as (
  select table_schema as schema_name, table_name, column_name, data_type, is_nullable, ordinal_position
  from information_schema.columns
  where table_schema not like 'pg\_%' and table_schema <> 'information_schema'
),
cons as (
  select n.nspname as schema_name, c.relname as table_name, con.conname,
         con.contype::text as contype, pg_get_constraintdef(con.oid) as def
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
idx as (
  select n.nspname as schema_name, c.relname as table_name, i.relname as index_name,
         pg_get_indexdef(x.indexrelid) as def
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class c on c.oid = x.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
fns as (
  select n.nspname as schema_name, p.proname,
         pg_get_function_identity_arguments(p.oid) as args,
         p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ','), '') as config
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
pols as (
  select schemaname as schema_name, tablename, policyname, roles::text as roles,
         cmd, permissive, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
  from pg_policies
  where schemaname not like 'pg\_%' and schemaname <> 'information_schema'
),
trgs as (
  select n.nspname as schema_name, c.relname as table_name, t.tgname,
         pg_get_triggerdef(t.oid) as def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname not like 'pg\_%' and n.nspname <> 'information_schema'
),
exts as (
  select extname, extversion from pg_extension where extname <> 'plpgsql'
),
fingerprint_parts as (
  select 'schema|' || nspname as part from pg_namespace
   where nspname not like 'pg\_%' and nspname <> 'information_schema'
  union all select 'rel|' || schema_name || '|' || relname || '|' || kind || '|' || rls::text from rel
  union all select 'col|' || schema_name || '|' || table_name || '|' || column_name || '|' ||
                     data_type || '|' || is_nullable || '|' || ordinal_position::text from cols
  union all select 'con|' || schema_name || '|' || table_name || '|' || conname || '|' || contype || '|' || def from cons
  union all select 'idx|' || schema_name || '|' || table_name || '|' || index_name || '|' || def from idx
  union all select 'fn|' || schema_name || '|' || proname || '(' || args || ')|secdef=' || secdef::text ||
                     '|config=' || config from fns
  union all select 'pol|' || schema_name || '|' || tablename || '|' || policyname || '|' || roles || '|' ||
                     cmd || '|' || permissive || '|' || qual || '|' || with_check from pols
  union all select 'trg|' || schema_name || '|' || table_name || '|' || tgname || '|' || def from trgs
  union all select 'ext|' || extname || '|' || extversion from exts
),
object_hashes as (
 select split_part(part, '|', 1) category,
        case when split_part(part, '|', 1) in ('schema','ext') then split_part(part, '|', 2) else split_part(part, '|', 2) || '.' || split_part(part, '|', 3) end as object_name,
        encode(digest(part, 'sha256'), 'hex') object_sha256,
        part
 from fingerprint_parts
)
select category, object_name, object_sha256
from object_hashes
order by category, object_name, object_sha256;

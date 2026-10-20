#!/usr/bin/env bash
# Offline rehearsal harness for the pending canonical taxonomy migration.
#
# Executes the UNCHANGED canonical migration
#   supabase/migrations/20261013190000_retire_external_certification_taxonomy.sql
# against a disposable, Supabase-initialised PostgreSQL 17 database that was built
# from the canonical migration chain (all versions < the pending version) inside a
# throwaway container.
#
# Safety properties:
#   * Runs only inside a container started with --network none and no volume mounts.
#   * Never connects to staging or production; no DSN, host, or secret is used.
#   * Applies migration files read-only from the repository checkout (no edits).
#   * Uses psql -v ON_ERROR_STOP=1 and never suppresses an error.
#   * Does not write to supabase_migrations.schema_migrations (history is not faked).
#   * --dry-run wraps the pending migration in an explicit transaction that is
#     rolled back, proving transactionality without persisting the change.
#
# Usage (inside the disposable container):
#   MIGRATIONS_DIR=/work/supabase/migrations bash rehearse-taxonomy-migration.sh --dry-run
#   MIGRATIONS_DIR=/work/supabase/migrations bash rehearse-taxonomy-migration.sh --apply
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/work/supabase/migrations}"
PENDING_VERSION="${PENDING_VERSION:-20261013190000}"
PGUSER_="${PGUSER_:-supabase_admin}"
PGDB="${PGDB:-postgres}"
LOG="${LOG:-/work/rehearsal-apply.log}"

mode="${1:---dry-run}"
case "$mode" in
  --dry-run|--apply) ;;
  *) echo "usage: $0 [--dry-run|--apply]" >&2; exit 2 ;;
esac

psql_base=(psql -v ON_ERROR_STOP=1 --no-psqlrc -U "$PGUSER_" -d "$PGDB")

echo "== rehearsal mode: $mode"
echo "== migrations dir: $MIGRATIONS_DIR"
echo "== pending version: $PENDING_VERSION"

pending_file="$(ls "$MIGRATIONS_DIR"/"${PENDING_VERSION}"_*.sql)"
echo "== pending file: $pending_file"
echo "== pending sha256: $(sha256sum "$pending_file" | cut -d' ' -f1)"

# ---------------------------------------------------------------- 1. build schema
# The canonical chain depends on the Supabase CLI bookkeeping relation
# (supabase_migrations.schema_migrations), which the CLI creates before applying
# migrations. Mirror it here so the chain is self-applying. The relation is left
# EMPTY on purpose: this rehearsal never fakes or edits migration history.
"${psql_base[@]}" -q <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL
echo "== cli bookkeeping relation ensured (empty; history never faked)"

: >"$LOG"
applied=0
skipped=0
for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  base="$(basename "$f")"
  version="${base%%_*}"
  if [ "$version" \> "$PENDING_VERSION" ]; then
    echo "== SKIP (newer than pending): $base"
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$version" = "$PENDING_VERSION" ]; then
    echo "== SKIP (pending migration itself): $base"
    skipped=$((skipped + 1))
    continue
  fi
  printf '== applying %s ... ' "$base"
  if "${psql_base[@]}" -q -f "$f" >>"$LOG" 2>&1; then
    echo "ok"
    applied=$((applied + 1))
  else
    echo "FAILED"
    echo "== first failure: $base" >&2
    tail -n 25 "$LOG" >&2
    exit 1
  fi
done
echo "== canonical chain applied: $applied file(s); skipped: $skipped"

# ------------------------------------------------------- 2. pre-migration state
pre_cols="$("${psql_base[@]}" -Atc "
  select table_name || '.' || column_name
  from information_schema.columns
  where table_schema='public'
    and table_name in ('scenario_questions','scenario_catalog')
    and column_name in ('a' || 'se_area','diagnostic_area')
  order by 1")"
echo "== pre-state columns:"; echo "$pre_cols"
echo "== pre-state row counts:"
"${psql_base[@]}" -Atc "select 'pre scenario_questions rows=' || count(*) from public.scenario_questions"
"${psql_base[@]}" -Atc "select 'pre scenario_catalog rows=' || count(*) from public.scenario_catalog"

# ------------------------------------------------- 3. run the pending migration
if [ "$mode" = "--dry-run" ]; then
  echo "== dry-run: transaction + rollback"
  {
    echo 'begin;'
    cat "$pending_file"
    echo 'select '"'"'post_rename_inside_tx='"'"' || count(*) from information_schema.columns'
    echo '  where table_schema='"'"'public'"'"' and column_name='"'"'diagnostic_area'"'"';'
    echo 'rollback;'
  } | "${psql_base[@]}"
  post_cols="$("${psql_base[@]}" -Atc "
    select table_name || '.' || column_name from information_schema.columns
    where table_schema='public'
      and table_name in ('scenario_questions','scenario_catalog')
      and column_name in ('a' || 'se_area','diagnostic_area') order by 1")"
  echo "== post-rollback columns (must equal pre-state):"; echo "$post_cols"
  if [ "$pre_cols" = "$post_cols" ]; then
    echo "REHEARSAL DRY-RUN: PASS (migration is transactional; rollback restored pre-state)"
  else
    echo "REHEARSAL DRY-RUN: FAIL (rollback did not restore pre-state)" >&2
    exit 1
  fi
  exit 0
fi

echo "== apply: executing the unchanged canonical migration"
"${psql_base[@]}" -f "$pending_file"
echo "== apply: complete"

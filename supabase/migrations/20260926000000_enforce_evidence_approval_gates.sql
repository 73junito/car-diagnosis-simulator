begin;

-- Database-level evidence approval gate enforcement.
--
-- Complements the repository validator (scripts/verify-evidence-approval-contract.js).
-- The validator detects invalid state in the repository/CI path; this migration
-- makes PostgreSQL itself reject an illegal approval write, so a direct or
-- scripted UPDATE cannot bypass the contract.
--
-- Design rules:
--   * This trigger NEVER infers, populates, or repairs review state. It only
--     accepts or rejects the human-supplied state.
--   * A chunk may become approved only when its exact source has cleared every
--     upstream gate with a recorded human reviewer identity and timestamp.
--   * Cross-source approval and decision/boolean disagreement are rejected.
--
-- Rollback:
--   drop trigger if exists trg_source_chunks_evidence_gate on public.source_chunks;
--   drop function if exists public.enforce_source_chunk_evidence_gate();
--   drop table if exists public.evidence_source_gates;

-- Per-source evidence lifecycle gate state, mirroring the JSON registry's five
-- independent gates. Human review writes here; the trigger only reads.
create table if not exists public.evidence_source_gates (
  source_id text primary key references public.approved_sources(id) on delete cascade,

  -- The five independent gates. Never inferred from one another.
  ingested boolean not null default true,
  rights_cleared boolean not null default false,
  technically_reviewed boolean not null default false,
  chunk_approved boolean not null default false,
  lesson_mapped boolean not null default false,

  -- Human reviewer attribution. Required before the corresponding gate is true.
  rights_verified_by uuid,
  rights_verified_at timestamptz,
  technically_reviewed_by uuid,
  technically_reviewed_at timestamptz,

  notes text,

  constraint evidence_source_gates_rights_reviewer_required
    check (rights_cleared = false or (rights_verified_by is not null and rights_verified_at is not null)),
  constraint evidence_source_gates_technical_reviewer_required
    check (technically_reviewed = false or (technically_reviewed_by is not null and technically_reviewed_at is not null)),
  constraint evidence_source_gates_review_time_required
    check (rights_verified_at is null or rights_verified_at <= now() + interval '1 day')
);

comment on table public.evidence_source_gates is
  'Independent evidence lifecycle gates per source. Human review writes this state; '
  'triggers only validate it and never populate it.';

alter table public.evidence_source_gates enable row level security;
revoke all on table public.evidence_source_gates from anon, authenticated;
grant select, insert, update on table public.evidence_source_gates to service_role;

-- Per-chunk three-state review decision: pending | approved | denied.
-- `approved` is the machine-friendly boolean validated against `decision`.
create table if not exists public.evidence_chunk_decisions (
  chunk_id text primary key references public.source_chunks(chunk_id) on delete cascade,
  source_id text not null references public.approved_sources(id) on delete restrict,
  decision text not null check (decision in ('pending', 'approved', 'denied')),
  approved boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,

  -- decision and approved must always agree; a denied chunk stays representable.
  constraint evidence_chunk_decisions_decision_approved_agree
    check ((decision = 'approved' and approved = true)
        or (decision in ('pending', 'denied') and approved = false)),
  -- An approved chunk decision must carry its own human reviewer.
  constraint evidence_chunk_decisions_reviewer_required
    check (approved = false or (reviewed_by is not null and reviewed_at is not null))
);

comment on table public.evidence_chunk_decisions is
  'Per-chunk human review decision (pending/approved/denied). A denied chunk is '
  'distinguishable from one not yet reviewed.';

alter table public.evidence_chunk_decisions enable row level security;
revoke all on table public.evidence_chunk_decisions from anon, authenticated;
grant select, insert, update on table public.evidence_chunk_decisions to service_role;

create index if not exists idx_evidence_chunk_decisions_source_id
  on public.evidence_chunk_decisions(source_id);


-- ---------------------------------------------------------------------------
-- Gate enforcement
-- ---------------------------------------------------------------------------
-- Validates an approval write against human-supplied state ONLY.
-- It never infers, populates, defaults, or repairs any field.
create or replace function public.enforce_source_chunk_evidence_gate()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_source_id text;
  v_decision record;
  v_gates record;
begin
  -- Only gate the transition into an approved state; other writes pass through.
  if not (new.approved = true and (tg_op = 'INSERT' or old.approved is distinct from true)) then
    return new;
  end if;

  v_source_id := new.source_id;

  -- 1. Ownership must match: a chunk decision belongs to this exact source.
  if exists (
    select 1
    from public.evidence_chunk_decisions d
    where d.chunk_id = new.chunk_id
      and d.source_id is distinct from v_source_id
  ) then
    raise exception 'evidence_gate_rejected: chunk % has a decision recorded against a different source', new.chunk_id
      using errcode = 'check_violation';
  end if;

  -- 2. A matching approved decision must exist for this chunk.
  select d.decision, d.source_id
    into v_decision
    from public.evidence_chunk_decisions d
   where d.chunk_id = new.chunk_id;

  if not found then
    raise exception 'evidence_gate_rejected: chunk % has no recorded review decision; approving requires a human decision of ''approved''', new.chunk_id
      using errcode = 'check_violation';
  end if;

  if v_decision.decision <> 'approved' then
    raise exception 'evidence_gate_rejected: chunk % decision is ''%''; only an ''approved'' decision may approve a chunk', new.chunk_id, v_decision.decision
      using errcode = 'check_violation';
  end if;

  if v_decision.source_id <> v_source_id then
    raise exception 'evidence_gate_rejected: chunk % decision source % does not match chunk source %', new.chunk_id, v_decision.source_id, v_source_id
      using errcode = 'check_violation';
  end if;

  -- 3. The exact source must have cleared every upstream gate, with a
  --    recorded human reviewer identity and timestamp at source level.
  select g.rights_cleared,
         g.technically_reviewed,
         g.rights_verified_by,
         g.rights_verified_at,
         g.technically_reviewed_by,
         g.technically_reviewed_at
    into v_gates
    from public.evidence_source_gates g
   where g.source_id = v_source_id;

  if not found then
    raise exception 'evidence_gate_rejected: source % has no recorded evidence gate state; approving a chunk requires cleared rights and technical gates', v_source_id
      using errcode = 'check_violation';
  end if;

  if v_gates.rights_cleared is not true then
    raise exception 'evidence_gate_rejected: source % has rights_cleared=false; a chunk cannot be approved before human rights clearance', v_source_id
      using errcode = 'check_violation';
  end if;

  if v_gates.technically_reviewed is not true then
    raise exception 'evidence_gate_rejected: source % has technically_reviewed=false; a chunk cannot be approved before technical review', v_source_id
      using errcode = 'check_violation';
  end if;

  if v_gates.rights_verified_by is null or v_gates.rights_verified_at is null then
    raise exception 'evidence_gate_rejected: source % is missing a recorded human rights reviewer identity and timestamp', v_source_id
      using errcode = 'check_violation';
  end if;

  if v_gates.technically_reviewed_by is null or v_gates.technically_reviewed_at is null then
    raise exception 'evidence_gate_rejected: source % is missing a recorded technical reviewer identity and timestamp', v_source_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_source_chunk_evidence_gate() is
  'Rejects approving a source_chunks row unless the exact source has human-cleared '
  'rights and technical gates with recorded reviewer identity and timestamp, and a '
  'matching approved per-chunk decision exists. Never infers or populates state.';

drop trigger if exists trg_source_chunks_evidence_gate on public.source_chunks;
create trigger trg_source_chunks_evidence_gate
  before insert or update of approved, status, source_id
    on public.source_chunks
  for each row
  execute function public.enforce_source_chunk_evidence_gate();

-- Keep the source-level chunk_approved gate consistent with the decisions that
-- actually exist, again without inferring or repairing anything.
create or replace function public.enforce_evidence_source_gate_consistency()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.chunk_approved = true and not exists (
    select 1 from public.evidence_chunk_decisions d
     where d.source_id = new.source_id and d.approved = true
  ) then
    raise exception 'evidence_gate_rejected: source % chunk_approved=true requires at least one approved chunk decision', new.source_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_evidence_source_gates_consistency on public.evidence_source_gates;
create trigger trg_evidence_source_gates_consistency
  before insert or update of chunk_approved
    on public.evidence_source_gates
  for each row
  execute function public.enforce_evidence_source_gate_consistency();

commit;

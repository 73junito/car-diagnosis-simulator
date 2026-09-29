begin;

alter table public.curriculum_evidence_records
  drop constraint if exists curriculum_evidence_records_approval_gate;

alter table public.curriculum_evidence_records
  add constraint curriculum_evidence_records_approval_gate
  check (
    review_status <> 'approved'
    or (
      reviewed_by is not null
      and reviewed_at is not null
      and license_status = 'verified-for-use'
      and license_reviewed_by is not null
      and license_reviewed_at is not null
      and approved_source_id is not null
    )
  );

comment on constraint curriculum_evidence_records_approval_gate
  on public.curriculum_evidence_records is
  'Approved curriculum evidence requires recorded human review, verified reuse rights, and linkage to an approved provenance source.';

create index if not exists idx_curriculum_evidence_records_approved_source
  on public.curriculum_evidence_records(approved_source_id)
  where approved_source_id is not null;

create index if not exists idx_curriculum_module_gaps_lesson_mapping
  on public.curriculum_module_gaps(lesson_plan_id, course_id, competency_id, academic_level);

commit;

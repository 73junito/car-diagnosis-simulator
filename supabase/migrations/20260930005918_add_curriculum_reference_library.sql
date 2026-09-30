create table if not exists public.curriculum_reference_sources (
  id text primary key,
  title text not null,
  publisher text,
  publication_year integer,
  subject_area text not null,
  source_kind text not null check (source_kind in ('oer-textbook','technical-reference','publisher-guidance')),
  canonical_url text,
  local_filename text,
  license_classification text not null,
  citation_link_allowed boolean not null default false,
  paraphrase_summary_allowed boolean not null default false,
  direct_reproduction_allowed boolean not null default false,
  database_storage_allowed boolean not null default false,
  ai_rag_ingestion_allowed boolean not null default false,
  commercial_use_allowed boolean not null default false,
  attribution_required boolean not null default true,
  share_alike_required boolean not null default false,
  audience text not null default 'student' check (audience in ('student','instructor','internal')),
  status text not null default 'active' check (status in ('active','restricted','retired')),
  rights_basis text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_reference_mappings (
  reference_id text not null references public.curriculum_reference_sources(id) on delete cascade,
  lesson_plan_id text not null references public.curriculum_lesson_plans(id) on delete cascade,
  role text not null,
  notes text,
  created_at timestamptz not null default now(),
  primary key (reference_id, lesson_plan_id, role)
);

alter table public.curriculum_reference_sources enable row level security;
alter table public.curriculum_reference_mappings enable row level security;
revoke all on public.curriculum_reference_sources from public, anon, authenticated;
revoke all on public.curriculum_reference_mappings from public, anon, authenticated;
grant select, insert, update, delete on public.curriculum_reference_sources to service_role;
grant select, insert, update, delete on public.curriculum_reference_mappings to service_role;

create index if not exists idx_curriculum_reference_mappings_lesson
  on public.curriculum_reference_mappings(lesson_plan_id);
create index if not exists idx_curriculum_reference_sources_subject
  on public.curriculum_reference_sources(subject_area);

comment on table public.curriculum_reference_sources is
  'Governed supplemental curriculum references. Bibliographic/reference use is separated from approved evidence ingestion.';
comment on table public.curriculum_reference_mappings is
  'Maps supplemental references to curriculum lesson plans without granting evidence or assessment eligibility.';


insert into public.curriculum_reference_sources (
  id, title, publisher, publication_year, subject_area, source_kind,
  canonical_url, local_filename, license_classification,
  citation_link_allowed, paraphrase_summary_allowed, direct_reproduction_allowed,
  database_storage_allowed, ai_rag_ingestion_allowed, commercial_use_allowed,
  attribution_required, share_alike_required, audience, status, rights_basis
) values
(
  'technical-writing-for-technicians-2019',
  'Technical Writing for Technicians',
  'Linn-Benton Community College / Open Oregon Educational Resources',
  2019,
  'technical communication',
  'oer-textbook',
  'https://openoregon.pressbooks.pub/ctetechwriting/',
  'Technical-Writing-for-Technicians-1660595203.pdf',
  'CC_BY_4_0',
  true, true, true, true, true, true,
  true, false, 'student', 'active',
  'Local reviewed copy states CC BY 4.0 except where otherwise noted; canonical publisher page confirms CC BY 4.0.'
),
(
  'openstax-university-physics-v1-2026',
  'University Physics, Volume 1',
  'OpenStax / Rice University',
  2026,
  'physics',
  'oer-textbook',
  'https://openstax.org/details/books/university-physics-volume-1',
  'university-physics-volume-1_-_WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2026 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'openstax-chemistry-2e-2026',
  'Chemistry 2e',
  'OpenStax / Rice University',
  2026,
  'chemistry',
  'oer-textbook',
  'https://openstax.org/details/books/chemistry-2e',
  'chemistry-2e_-_WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2026 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'openstax-algebra-trigonometry-2e-2026',
  'Algebra and Trigonometry 2e',
  'OpenStax / Rice University',
  2026,
  'mathematics',
  'oer-textbook',
  'https://openstax.org/details/books/algebra-and-trigonometry-2e',
  'algebra-and-trigonometry-2e_-_WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2026 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'openstax-principles-data-science-2025',
  'Principles of Data Science',
  'OpenStax / Rice University',
  2025,
  'data science',
  'oer-textbook',
  'https://openstax.org/details/books/principles-data-science',
  'Principles-of-Data-Science-WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2025 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'openstax-introduction-computer-science-2026',
  'Introduction to Computer Science',
  'OpenStax / Rice University',
  2026,
  'computer science',
  'oer-textbook',
  'https://openstax.org/details/books/introduction-computer-science',
  'Introduction_To_Computer_Science_-_WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2026 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'openstax-additive-manufacturing-essentials-2025',
  'Additive Manufacturing Essentials',
  'OpenStax / Rice University',
  2025,
  'advanced manufacturing',
  'oer-textbook',
  'https://openstax.org/details/books/additive-manufacturing-essentials',
  'Additive_Manufacturing_Essentials_-_WEB.pdf',
  'CC_BY_NC_SA_4_0',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed 2025 OpenStax copy states CC BY-NC-SA 4.0; production use is limited to bibliographic citation/linking unless additional commercial permission is obtained.'
),
(
  'fiore-ac-electrical-circuit-analysis-2021',
  'AC Electrical Circuit Analysis: A Practical Approach',
  'James M. Fiore',
  2021,
  'electrical engineering technology',
  'technical-reference',
  'https://www.jimfiore.org/Books.html',
  'ACElectricalCircuitAnalysis.pdf',
  'CC_NONCOMMERCIAL_SHAREALIKE_ATTRIBUTION',
  true, false, false, false, false, false,
  true, true, 'student', 'active',
  'Local reviewed copy states redistribution is non-commercial, share-alike, with attribution; production use is limited to bibliographic citation/linking.'
),
(
  'sae-reuse-guidance-2026',
  'SAE Published Content Reuse and Licensing Guidance',
  'SAE International copyright team',
  2026,
  'source rights and technical publishing',
  'publisher-guidance',
  'https://www.sae.org/',
  null,
  'PUBLISHER_PERMISSION_REQUIRED',
  true, true, false, false, false, false,
  true, false, 'internal', 'active',
  'SAE copyright-team guidance permits citation/linking and paraphrase/summary without a separate agreement, while direct reuse requires licensing and AI/database storage requests require separate copyright-team evaluation.'
)
on conflict (id) do update set
  title = excluded.title,
  publisher = excluded.publisher,
  publication_year = excluded.publication_year,
  subject_area = excluded.subject_area,
  source_kind = excluded.source_kind,
  canonical_url = excluded.canonical_url,
  local_filename = excluded.local_filename,
  license_classification = excluded.license_classification,
  citation_link_allowed = excluded.citation_link_allowed,
  paraphrase_summary_allowed = excluded.paraphrase_summary_allowed,
  direct_reproduction_allowed = excluded.direct_reproduction_allowed,
  database_storage_allowed = excluded.database_storage_allowed,
  ai_rag_ingestion_allowed = excluded.ai_rag_ingestion_allowed,
  commercial_use_allowed = excluded.commercial_use_allowed,
  attribution_required = excluded.attribution_required,
  share_alike_required = excluded.share_alike_required,
  audience = excluded.audience,
  status = excluded.status,
  rights_basis = excluded.rights_basis,
  updated_at = now();


insert into public.curriculum_reference_mappings (
  reference_id, lesson_plan_id, role, notes
) values
('technical-writing-for-technicians-2019', 'ug-aut180-service-information', 'technical-communication',
 'Supports technician-facing documentation, audience awareness, work-completion notes, instructions, and source-aware technical communication.'),
('openstax-algebra-trigonometry-2e-2026', 'ug-aut110-automotive-math', 'stem-foundation',
 'Reference-only mathematics foundation for algebraic manipulation, functions, ratios, and trigonometric reasoning.'),
('openstax-university-physics-v1-2026', 'ug-aut121-electrical-lab', 'stem-foundation',
 'Reference-only physics foundation for measurement, units, energy, and quantitative reasoning.'),
('openstax-university-physics-v1-2026', 'ug-electrical-charging-system', 'stem-foundation',
 'Reference-only physical-science background for energy, power, and quantitative system reasoning.'),
('openstax-principles-data-science-2025', 'ug-aut360-data-analysis', 'data-literacy',
 'Reference-only data-science foundation for visualization, interpretation, uncertainty, and evidence-based reasoning.'),
('openstax-principles-data-science-2025', 'grad-aut520-data-analytics', 'data-literacy',
 'Reference-only advanced data-science context for analysis and interpretation workflows.'),
('openstax-introduction-computer-science-2026', 'ug-aut360-data-analysis', 'computational-foundation',
 'Reference-only computational thinking background for data processing and algorithmic reasoning.'),
('fiore-ac-electrical-circuit-analysis-2021', 'ug-aut121-electrical-lab', 'electrical-theory-reference',
 'Reference-only AC circuit theory and measurement background; noncommercial license prevents production content reuse.'),
('fiore-ac-electrical-circuit-analysis-2021', 'ug-aut240-electrical-systems-ii', 'electrical-theory-reference',
 'Reference-only advanced circuit-analysis background; noncommercial license prevents production content reuse.'),
('sae-reuse-guidance-2026', 'ug-aut180-service-information', 'publisher-rights-guidance',
 'Internal instructor/source-governance reference for citation, paraphrase, licensing, and AI/database-storage restrictions.')
on conflict (reference_id, lesson_plan_id, role) do update set
  notes = excluded.notes;

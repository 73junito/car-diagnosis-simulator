-- Resolve the SAE technical-paper source-rights posture using direct guidance
-- from SAE International's copyright team (Bernadette Harris-Terrill, IP Specialist,
-- response dated 2026-09-29 to the project owner).
--
-- SAE confirmed:
-- - citation/title/DOI/link use does not require a license if no SAE content is pulled directly;
-- - paraphrasing/summarizing does not require an agreement;
-- - direct reprints/quotes/excerpts/figures/tables/diagrams may require licensing;
-- - database storage and AI-assisted use require case-by-case review by SAE;
-- - educational/nonprofit status does not remove permission requirements for copyrighted reuse.

update public.curriculum_reference_sources
set
  license_classification = 'SAE_CITATION_PARAPHRASE_ALLOWED_REPRO_STORAGE_AI_PERMISSION_REQUIRED',
  citation_link_allowed = true,
  paraphrase_summary_allowed = true,
  direct_reproduction_allowed = false,
  database_storage_allowed = false,
  ai_rag_ingestion_allowed = false,
  commercial_use_allowed = false,
  attribution_required = true,
  share_alike_required = false,
  rights_basis = 'Direct guidance from SAE International copyright (Bernadette Harris-Terrill, IP Specialist, 2026-09-29) confirms that citation, titles, DOI links, and links to SAE publications do not require a license when no SAE content is copied directly, and that paraphrasing or summarizing SAE material does not require an agreement. Direct reprints, quotations, excerpts, figures, tables, diagrams, and other copyrighted content may require licensing. Database storage and AI-assisted uses are subject to specific restrictions and must be submitted to SAE copyright for case-by-case evaluation. Commercial reuse remains disabled absent separate permission.',
  updated_at = now()
where id = 'sae-nissan-can-diagnostic-flow-2014';

update public.curriculum_reference_mappings
set notes = 'OEM-authored SAE paper supplements general computer-science concepts with vehicle-level CAN troubleshooting across modules and buses. Citation/linking and project-authored paraphrase/summary are permitted under direct SAE copyright guidance. Direct reproduction, database storage, AI/RAG ingestion, and commercial reuse remain disabled pending separate SAE permission.'
where reference_id = 'sae-nissan-can-diagnostic-flow-2014'
  and lesson_plan_id = 'ug-aut310-network-communications'
  and role = 'vehicle-can-diagnostic-reference';

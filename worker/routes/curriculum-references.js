import { createClient } from '@supabase/supabase-js'

const SOURCE_FIELDS = [
  'id',
  'title',
  'publisher',
  'publication_year',
  'subject_area',
  'source_kind',
  'canonical_url',
  'license_classification',
  'citation_link_allowed',
  'paraphrase_summary_allowed',
  'direct_reproduction_allowed',
  'database_storage_allowed',
  'ai_rag_ingestion_allowed',
  'commercial_use_allowed',
  'attribution_required',
  'share_alike_required'
].join(', ')

function createServiceClient(c) {
  const url = c.env.SUPABASE_URL
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

export async function handleCurriculumReferences(c) {
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const supabase = createServiceClient(c)
  if (!supabase) {
    console.error('Curriculum references missing Supabase configuration')
    return c.json({ error: 'Server configuration incomplete' }, 500)
  }

  const lessonPlanId = String(c.req.query('lessonPlanId') || '').trim()

  let mappingQuery = supabase
    .from('curriculum_reference_mappings')
    .select('reference_id, lesson_plan_id, role, notes')
    .order('lesson_plan_id', { ascending: true })
    .order('reference_id', { ascending: true })

  if (lessonPlanId) {
    mappingQuery = mappingQuery.eq('lesson_plan_id', lessonPlanId)
  }

  const { data: mappings, error: mappingError } = await mappingQuery
  if (mappingError) {
    console.error('Curriculum reference mapping read failed:', mappingError.message || mappingError)
    return c.json({ error: 'Curriculum reference library unavailable' }, 500)
  }

  const referenceIds = [...new Set((mappings || []).map((mapping) => mapping.reference_id))]
  if (!referenceIds.length) {
    return c.json({ data: [], mappings: [] }, 200)
  }

  const { data: sources, error: sourceError } = await supabase
    .from('curriculum_reference_sources')
    .select(SOURCE_FIELDS)
    .in('id', referenceIds)
    .eq('status', 'active')
    .eq('audience', 'student')
    .order('title', { ascending: true })

  if (sourceError) {
    console.error('Curriculum reference source read failed:', sourceError.message || sourceError)
    return c.json({ error: 'Curriculum reference library unavailable' }, 500)
  }

  const visibleIds = new Set((sources || []).map((source) => source.id))
  const visibleMappings = (mappings || []).filter((mapping) => visibleIds.has(mapping.reference_id))

  const data = (sources || []).map((source) => ({
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    publicationYear: source.publication_year,
    subjectArea: source.subject_area,
    sourceKind: source.source_kind,
    canonicalUrl: source.canonical_url,
    licenseClassification: source.license_classification,
    rights: {
      citationLinkAllowed: source.citation_link_allowed,
      paraphraseSummaryAllowed: source.paraphrase_summary_allowed,
      directReproductionAllowed: source.direct_reproduction_allowed,
      databaseStorageAllowed: source.database_storage_allowed,
      aiRagIngestionAllowed: source.ai_rag_ingestion_allowed,
      commercialUseAllowed: source.commercial_use_allowed,
      attributionRequired: source.attribution_required,
      shareAlikeRequired: source.share_alike_required
    }
  }))

  return c.json({ data, mappings: visibleMappings }, 200)
}

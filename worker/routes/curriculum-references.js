import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import { isInstructorOrAdminRole, resolveTrustedRole } from '../auth/role-policy.js'

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
  'share_alike_required',
  'audience'
].join(', ')

function createServiceClient(c) {
  const url = c.env.SUPABASE_URL
  const key = c.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

function cleanQuery(value, max = 120) {
  return String(value || '').trim().slice(0, max)
}

function cleanSearchTerm(value) {
  return cleanQuery(value).replace(/[^A-Za-z0-9\s\-.:/]/g, '').trim()
}

function publicSource(source) {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    publicationYear: source.publication_year,
    subjectArea: source.subject_area,
    sourceKind: source.source_kind,
    canonicalUrl: source.canonical_url,
    licenseClassification: source.license_classification,
    audience: source.audience,
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
  }
}

async function authorizeInstructorAudience(c, supabase) {
  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Instructor access required' }, 401) }

  const { user, error } = await verifySupabaseToken(
    token,
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_ROLE_KEY
  )
  if (error || !user?.id) {
    return { response: c.json({ error: 'Instructor access required' }, 401) }
  }

  const role = await resolveTrustedRole(user, supabase)
  if (!isInstructorOrAdminRole(role)) {
    return { response: c.json({ error: 'Instructor access required' }, 403) }
  }

  return { user, role }
}

function applyLibraryFilters(query, c) {
  const q = cleanSearchTerm(c.req.query('q'))
  const subjectArea = cleanQuery(c.req.query('subjectArea'), 80)
  const sourceKind = cleanQuery(c.req.query('sourceKind'), 80)
  const rights = cleanQuery(c.req.query('rights'), 40)

  let request = query
  if (q) {
    request = request.or(
      'title.ilike.%' + q + '%,publisher.ilike.%' + q +
      '%,subject_area.ilike.%' + q + '%,source_kind.ilike.%' + q + '%'
    )
  }
  if (subjectArea) request = request.eq('subject_area', subjectArea)
  if (sourceKind) request = request.eq('source_kind', sourceKind)

  if (rights === 'link-only') {
    request = request
      .eq('citation_link_allowed', true)
      .eq('database_storage_allowed', false)
      .eq('ai_rag_ingestion_allowed', false)
  } else if (rights === 'rag-allowed') {
    request = request.eq('ai_rag_ingestion_allowed', true)
  } else if (rights === 'storage-allowed') {
    request = request.eq('database_storage_allowed', true)
  } else if (rights === 'reproduction-allowed') {
    request = request.eq('direct_reproduction_allowed', true)
  }

  return request
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

  const lessonPlanId = cleanQuery(c.req.query('lessonPlanId'), 160)
  const view = cleanQuery(c.req.query('view'), 20) || 'mapped'
  const audience = cleanQuery(c.req.query('audience'), 20) || 'student'
  const libraryMode = view === 'library'

  if (!['mapped', 'library'].includes(view)) {
    return c.json({ error: 'view must be mapped or library' }, 400)
  }
  if (!['student', 'instructor'].includes(audience)) {
    return c.json({ error: 'audience must be student or instructor' }, 400)
  }

  if (audience === 'instructor') {
    const auth = await authorizeInstructorAudience(c, supabase)
    if (auth.response) return auth.response
  }

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

  const mappedReferenceIds = [...new Set((mappings || []).map((mapping) => mapping.reference_id))]

  if (!libraryMode && !mappedReferenceIds.length) {
    return c.json({ data: [], mappings: [] }, 200)
  }

  let sourceQuery = supabase
    .from('curriculum_reference_sources')
    .select(SOURCE_FIELDS)
    .eq('status', 'active')
    .order('title', { ascending: true })

  if (!libraryMode) {
    sourceQuery = sourceQuery.in('id', mappedReferenceIds)
  }

  sourceQuery = audience === 'instructor'
    ? sourceQuery.in('audience', ['student', 'internal'])
    : sourceQuery.eq('audience', 'student')

  if (libraryMode) {
    sourceQuery = applyLibraryFilters(sourceQuery, c)
  }

  const { data: sources, error: sourceError } = await sourceQuery
  if (sourceError) {
    console.error('Curriculum reference source read failed:', sourceError.message || sourceError)
    return c.json({ error: 'Curriculum reference library unavailable' }, 500)
  }

  const visibleIds = new Set((sources || []).map((source) => source.id))
  const visibleMappings = (mappings || []).filter((mapping) => visibleIds.has(mapping.reference_id))
  const data = (sources || []).map(publicSource)

  if (!libraryMode) {
    return c.json({ data, mappings: visibleMappings }, 200)
  }

  const filterOptions = {
    subjectAreas: [...new Set(data.map((source) => source.subjectArea).filter(Boolean))].sort(),
    sourceKinds: [...new Set(data.map((source) => source.sourceKind).filter(Boolean))].sort(),
    rights: ['link-only', 'rag-allowed', 'storage-allowed', 'reproduction-allowed']
  }

  return c.json({
    data,
    mappings: visibleMappings,
    audience,
    filterOptions,
    governance: {
      linkOnlySourcesRemainLinkOnly: true,
      databaseStorageRequiresExplicitRight: true,
      aiRagIngestionRequiresExplicitRight: true
    }
  }, 200)
}

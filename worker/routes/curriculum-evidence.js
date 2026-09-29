import { createClient } from '@supabase/supabase-js'
import { authorizeResearch } from './semantic-scholar-research.js'

const GAP_TYPES = new Set(['coverage', 'currency', 'evidence', 'practice', 'visual', 'other'])
const PRIORITIES = new Set(['low', 'medium', 'high'])
const EVIDENCE_REVIEW_ROLES = new Set(['instructor', 'professor', 'admin'])
const LICENSE_STATUSES = new Set(['verified-for-use', 'restricted', 'unknown'])
const GAP_FIELDS = [
  'id', 'lesson_plan_id', 'course_id', 'competency_id', 'academic_level',
  'gap_type', 'gap_summary', 'priority', 'status', 'created_by',
  'closed_by', 'closed_at', 'scored_assessment_eligible', 'created_at', 'updated_at'
].join(', ')
const EVIDENCE_FIELDS = [
  'id', 'gap_id', 'discovery_provider', 'provider_record_id', 'title',
  'authors', 'publication_year', 'venue', 'doi', 'source_url', 'abstract',
  'citation_count', 'open_access_pdf_url', 'open_access_license',
  'provider_metadata', 'review_status', 'license_status',
  'approved_source_id', 'saved_by', 'reviewed_by', 'reviewed_at',
  'license_reviewed_by', 'license_reviewed_at', 'scored_assessment_eligible',
  'created_at', 'updated_at'
].join(', ')

function serviceClient(c) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

function governance() {
  return {
    curriculumApproval: 'not-granted',
    scoredAssessmentEligibility: 'not-granted',
    humanReviewRequired: true,
    licenseReviewRequired: true
  }
}

async function bodyJson(c) {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value) {
  const normalized = textValue(value)
  return normalized || null
}

function databaseError(c, label, error) {
  console.error(label, error?.message || error)
  return c.json({ error: 'Curriculum evidence persistence unavailable' }, 500)
}

export async function handleCurriculumEvidenceGaps(c) {
  if (!['GET', 'POST'].includes(c.req.method)) {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizeResearch(c, { requireSemanticScholarEnabled: false })
  if (auth.response) return auth.response
  const supabase = serviceClient(c)

  if (c.req.method === 'GET') {
    let query = supabase
      .from('curriculum_module_gaps')
      .select(GAP_FIELDS)
      .order('created_at', { ascending: false })

    const lessonPlanId = textValue(c.req.query('lessonPlanId'))
    if (lessonPlanId) query = query.eq('lesson_plan_id', lessonPlanId)

    const { data, error } = await query
    if (error) return databaseError(c, 'Curriculum gap read failed:', error)
    return c.json({ data: data || [], governance: governance() }, 200)
  }

  const body = await bodyJson(c)
  if (!body) return c.json({ error: 'Valid JSON body required' }, 400)

  const lessonPlanId = textValue(body.lessonPlanId)
  const gapSummary = textValue(body.gapSummary)
  const gapType = textValue(body.gapType)
  const priority = textValue(body.priority) || 'medium'

  if (!lessonPlanId || !gapSummary || !GAP_TYPES.has(gapType) || !PRIORITIES.has(priority)) {
    return c.json({ error: 'lessonPlanId, gapSummary, valid gapType, and valid priority are required' }, 400)
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('curriculum_lesson_plans')
    .select('id, course_id, competency_id, academic_level')
    .eq('id', lessonPlanId)
    .maybeSingle()

  if (lessonError) return databaseError(c, 'Curriculum lesson lookup failed:', lessonError)
  if (!lesson) return c.json({ error: 'Lesson plan not found' }, 404)

  const { data, error } = await supabase
    .from('curriculum_module_gaps')
    .insert({
      lesson_plan_id: lesson.id,
      course_id: lesson.course_id,
      competency_id: lesson.competency_id,
      academic_level: lesson.academic_level,
      gap_type: gapType,
      gap_summary: gapSummary,
      priority,
      created_by: auth.user.id
    })
    .select(GAP_FIELDS)
    .single()

  if (error) return databaseError(c, 'Curriculum gap create failed:', error)
  return c.json({ data, governance: governance() }, 201)
}

export async function handleCurriculumEvidenceRecords(c) {
  if (!['GET', 'POST'].includes(c.req.method)) {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizeResearch(c, { requireSemanticScholarEnabled: false })
  if (auth.response) return auth.response
  const supabase = serviceClient(c)

  if (c.req.method === 'GET') {
    const gapId = textValue(c.req.query('gapId'))
    if (!gapId) return c.json({ error: 'gapId is required' }, 400)

    const { data, error } = await supabase
      .from('curriculum_evidence_records')
      .select(EVIDENCE_FIELDS)
      .eq('gap_id', gapId)
      .order('created_at', { ascending: false })

    if (error) return databaseError(c, 'Curriculum evidence read failed:', error)
    return c.json({ data: data || [], governance: governance() }, 200)
  }

  const body = await bodyJson(c)
  if (!body) return c.json({ error: 'Valid JSON body required' }, 400)

  const gapId = textValue(body.gapId)
  const providerRecordId = textValue(body.providerRecordId)
  const title = textValue(body.title)
  if (!gapId || !providerRecordId || !title) {
    return c.json({ error: 'gapId, providerRecordId, and title are required' }, 400)
  }

  const { data: gap, error: gapError } = await supabase
    .from('curriculum_module_gaps')
    .select('id')
    .eq('id', gapId)
    .maybeSingle()

  if (gapError) return databaseError(c, 'Curriculum gap lookup failed:', gapError)
  if (!gap) return c.json({ error: 'Curriculum gap not found' }, 404)

  const publicationYear = Number.isInteger(body.publicationYear) ? body.publicationYear : null
  const citationCount = Number.isInteger(body.citationCount) ? body.citationCount : null
  const providerMetadata =
    body.providerMetadata && typeof body.providerMetadata === 'object' && !Array.isArray(body.providerMetadata)
      ? body.providerMetadata
      : {}

  const { data, error } = await supabase
    .from('curriculum_evidence_records')
    .insert({
      gap_id: gapId,
      discovery_provider: 'semantic-scholar',
      provider_record_id: providerRecordId,
      title,
      authors: Array.isArray(body.authors) ? body.authors : [],
      publication_year: publicationYear,
      venue: optionalText(body.venue),
      doi: optionalText(body.doi),
      source_url: optionalText(body.sourceUrl),
      abstract: optionalText(body.abstract),
      citation_count: citationCount,
      open_access_pdf_url: optionalText(body.openAccessPdfUrl),
      open_access_license: optionalText(body.openAccessLicense),
      provider_metadata: providerMetadata,
      saved_by: auth.user.id
    })
    .select(EVIDENCE_FIELDS)
    .single()

  if (error?.code === '23505') {
    return c.json({ error: 'This evidence record is already saved for the gap' }, 409)
  }
  if (error) return databaseError(c, 'Curriculum evidence create failed:', error)

  return c.json({ data, governance: governance() }, 201)
}

export async function handleCurriculumApprovedSources(c) {
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizeResearch(c, { requireSemanticScholarEnabled: false })
  if (auth.response) return auth.response
  if (!EVIDENCE_REVIEW_ROLES.has(String(auth.role || '').trim().toLowerCase())) {
    return c.json({ error: 'Instructor, professor, or admin access required' }, 403)
  }

  const supabase = serviceClient(c)
  const { data, error } = await supabase
    .from('approved_sources')
    .select('id, title, publisher, publication_year, license, status')
    .eq('status', 'approved')
    .order('title', { ascending: true })

  if (error) return databaseError(c, 'Approved source read failed:', error)
  return c.json({ data: data || [], governance: governance() }, 200)
}

export async function handleCurriculumEvidenceRecordReview(c) {
  if (c.req.method !== 'PATCH') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizeResearch(c, { requireSemanticScholarEnabled: false })
  if (auth.response) return auth.response
  if (!EVIDENCE_REVIEW_ROLES.has(String(auth.role || '').trim().toLowerCase())) {
    return c.json({ error: 'Instructor, professor, or admin access required' }, 403)
  }

  const evidenceId = textValue(c.req.param('evidenceId'))
  const body = await bodyJson(c)
  if (!evidenceId || !body) {
    return c.json({ error: 'Evidence id and valid JSON body are required' }, 400)
  }

  const action = textValue(body.action)
  const supabase = serviceClient(c)
  const { data: current, error: currentError } = await supabase
    .from('curriculum_evidence_records')
    .select(EVIDENCE_FIELDS)
    .eq('id', evidenceId)
    .maybeSingle()

  if (currentError) return databaseError(c, 'Curriculum evidence lookup failed:', currentError)
  if (!current) return c.json({ error: 'Curriculum evidence record not found' }, 404)
  if (current.review_status === 'approved' || current.review_status === 'rejected') {
    return c.json({ error: 'Finalized evidence cannot be modified' }, 409)
  }

  const now = new Date().toISOString()
  const changes = { updated_at: now }

  if (action === 'review') {
    if (!['discovered', 'reviewed'].includes(current.review_status)) {
      return c.json({ error: 'Evidence must be discovered or reviewed for human review' }, 409)
    }
    changes.review_status = 'reviewed'
    changes.reviewed_by = auth.user.id
    changes.reviewed_at = now
  } else if (action === 'license') {
    const licenseStatus = textValue(body.licenseStatus)
    if (!LICENSE_STATUSES.has(licenseStatus)) {
      return c.json({ error: 'licenseStatus must be verified-for-use, restricted, or unknown' }, 400)
    }
    if (!current.reviewed_by || !current.reviewed_at) {
      return c.json({ error: 'Human review is required before license review' }, 409)
    }
    changes.license_status = licenseStatus
    changes.license_reviewed_by = auth.user.id
    changes.license_reviewed_at = now
    changes.review_status = licenseStatus === 'verified-for-use'
      ? 'license-verified'
      : 'reviewed'
  } else if (action === 'link-source') {
    const approvedSourceId = textValue(body.approvedSourceId)
    if (!approvedSourceId) {
      return c.json({ error: 'approvedSourceId is required' }, 400)
    }
    const { data: source, error: sourceError } = await supabase
      .from('approved_sources')
      .select('id, status')
      .eq('id', approvedSourceId)
      .maybeSingle()
    if (sourceError) return databaseError(c, 'Approved source lookup failed:', sourceError)
    if (!source) return c.json({ error: 'Approved source not found' }, 404)
    if (source.status !== 'approved') {
      return c.json({ error: 'Provenance source must have approved status' }, 409)
    }
    changes.approved_source_id = source.id
  } else if (action === 'approve') {
    if (current.review_status !== 'license-verified') {
      return c.json({ error: 'Evidence must be license-verified before approval' }, 409)
    }
    if (!current.reviewed_by || !current.reviewed_at) {
      return c.json({ error: 'Human review is required before approval' }, 409)
    }
    if (
      current.license_status !== 'verified-for-use' ||
      !current.license_reviewed_by ||
      !current.license_reviewed_at
    ) {
      return c.json({ error: 'Verified reuse rights are required before approval' }, 409)
    }
    if (!current.approved_source_id) {
      return c.json({ error: 'Approved provenance source linkage is required before approval' }, 409)
    }
    changes.review_status = 'approved'
  } else if (action === 'reject') {
    changes.review_status = 'rejected'
    changes.reviewed_by = auth.user.id
    changes.reviewed_at = now
  } else {
    return c.json({ error: 'action must be review, license, link-source, approve, or reject' }, 400)
  }

  const { data, error } = await supabase
    .from('curriculum_evidence_records')
    .update(changes)
    .eq('id', evidenceId)
    .select(EVIDENCE_FIELDS)
    .single()

  if (error) return databaseError(c, 'Curriculum evidence review update failed:', error)
  return c.json({ data, governance: governance() }, 200)
}

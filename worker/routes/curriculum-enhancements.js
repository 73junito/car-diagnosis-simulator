import { createClient } from '@supabase/supabase-js'
import { authorizeResearch } from './semantic-scholar-research.js'
import { requestOllama } from '../services/ollama.js'
import { requestOpenAI } from '../services/openai-compatible.js'
import { validateProviderConfig, DEFAULTS } from '../config/ai-config.js'

const DRAFT_ROLES = new Set(['teacher', 'instructor', 'professor', 'admin'])
const MAX_EVIDENCE = 6
const PROMPT_VERSION = 'curriculum-enhancement-v1'
const DRAFT_FIELDS = [
  'id', 'lesson_plan_id', 'goal', 'status', 'draft_payload',
  'ai_provider', 'ai_model', 'prompt_version', 'requested_by',
  'reviewed_by', 'reviewed_at', 'scored_assessment_eligible',
  'assessment_generation_allowed', 'publication_status',
  'created_at', 'updated_at'
].join(', ')

function serviceClient(c) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

function textValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function currentRights(scope) {
  if (!scope) return false
  const today = new Date().toISOString().slice(0, 10)
  return scope.ai_rag_ingestion_allowed === true &&
    scope.citation_link_allowed === true &&
    scope.paraphrase_summary_allowed === true &&
    scope.database_storage_allowed === true &&
    Boolean(scope.reviewed_by && scope.reviewed_at && textValue(scope.license_evidence_reference)) &&
    (!scope.effective_at || scope.effective_at <= today) &&
    (!scope.expires_at || scope.expires_at >= today)
}

function parseDraftJson(raw) {
  const text = String(raw || '').trim()
    .replace(/^\`\`\`(?:json)?\s*/i, '')
    .replace(/\s*\`\`\`$/, '')
  const parsed = JSON.parse(text)
  const strings = (value, max = 8) =>
    Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, max).map((item) => item.trim())
      : []

  const payload = {
    summary: textValue(parsed.summary),
    rationale: textValue(parsed.rationale),
    proposed_objectives: strings(parsed.proposed_objectives, 8),
    proposed_steps: strings(parsed.proposed_steps, 12),
    source_notes: Array.isArray(parsed.source_notes)
      ? parsed.source_notes.slice(0, 8).map((item) => ({
          evidenceId: textValue(item?.evidenceId),
          use: textValue(item?.use)
        })).filter((item) => item.evidenceId && item.use)
      : [],
    safety_notes: strings(parsed.safety_notes, 8)
  }

  if (!payload.summary || !payload.rationale || !payload.proposed_steps.length) {
    throw new Error('AI draft response did not satisfy the curriculum draft contract')
  }
  return payload
}

function buildPrompt({ lesson, steps, goal, evidence }) {
  const evidenceBlock = evidence.map((item, index) => JSON.stringify({
    index: index + 1,
    evidenceId: item.id,
    title: item.title,
    publicationYear: item.publication_year,
    doi: item.doi,
    abstract: item.abstract
  })).join('\n')

  return [
    'Create a draft curriculum enhancement proposal from only the supplied evidence.',
    'Do not create quiz questions, test items, answer keys, grading criteria, scores, or assessment content.',
    'Do not publish or claim approval. Everything remains an instructor-review draft.',
    'Paraphrase source content; do not reproduce long passages.',
    'Return only valid JSON with keys: summary, rationale, proposed_objectives, proposed_steps, source_notes, safety_notes.',
    'source_notes must contain evidenceId and a brief description of how that evidence informed the draft.',
    '',
    `Lesson: ${lesson.title} (${lesson.id})`,
    `Current status: ${lesson.status}`,
    `Current sequence: ${steps.map((step) => step.step_text).join(' | ')}`,
    `Instructor goal: ${goal}`,
    '',
    'Approved evidence:',
    evidenceBlock
  ].join('\n')
}

function databaseError(c, label, error) {
  console.error(label, error?.message || error)
  return c.json({ error: 'Curriculum enhancement persistence unavailable' }, 500)
}

async function authorizeDrafts(c) {
  const auth = await authorizeResearch(c, { requireSemanticScholarEnabled: false })
  if (auth.response) return auth
  if (!DRAFT_ROLES.has(String(auth.role || '').trim().toLowerCase())) {
    return { response: c.json({ error: 'Teacher, instructor, professor, or admin access required' }, 403) }
  }
  return auth
}

export async function handleCurriculumEnhancementDrafts(c) {
  if (!['GET', 'POST'].includes(c.req.method)) {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authorizeDrafts(c)
  if (auth.response) return auth.response
  const supabase = serviceClient(c)

  if (c.req.method === 'GET') {
    const lessonPlanId = textValue(c.req.query('lessonPlanId'))
    if (!lessonPlanId) return c.json({ error: 'lessonPlanId is required' }, 400)

    const { data, error } = await supabase
      .from('curriculum_enhancement_drafts')
      .select(DRAFT_FIELDS)
      .eq('lesson_plan_id', lessonPlanId)
      .order('created_at', { ascending: false })

    if (error) return databaseError(c, 'Curriculum enhancement draft read failed:', error)
    return c.json({
      data: data || [],
      governance: {
        publication: 'not-granted',
        scoredAssessmentEligibility: 'not-granted',
        assessmentGeneration: 'not-granted',
        humanReviewRequired: true
      }
    }, 200)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Valid JSON body required' }, 400)
  }

  const lessonPlanId = textValue(body.lessonPlanId)
  const goal = textValue(body.goal)
  const evidenceIds = Array.isArray(body.evidenceIds)
    ? [...new Set(body.evidenceIds.map(textValue).filter(Boolean))]
    : []

  if (!lessonPlanId || goal.length < 10 || goal.length > 1000) {
    return c.json({ error: 'lessonPlanId and a 10-1000 character goal are required' }, 400)
  }
  if (!evidenceIds.length || evidenceIds.length > MAX_EVIDENCE) {
    return c.json({ error: `Select between 1 and ${MAX_EVIDENCE} approved evidence records` }, 400)
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('curriculum_lesson_plans')
    .select('id, title, status')
    .eq('id', lessonPlanId)
    .maybeSingle()
  if (lessonError) return databaseError(c, 'Curriculum lesson lookup failed:', lessonError)
  if (!lesson) return c.json({ error: 'Lesson plan not found' }, 404)

  const { data: steps, error: stepsError } = await supabase
    .from('curriculum_lesson_steps')
    .select('position, step_text')
    .eq('lesson_plan_id', lessonPlanId)
    .order('position', { ascending: true })
  if (stepsError) return databaseError(c, 'Curriculum lesson step lookup failed:', stepsError)

  const { data: evidence, error: evidenceError } = await supabase
    .from('curriculum_evidence_records')
    .select('id, gap_id, title, publication_year, doi, abstract, review_status, license_status, approved_source_id, scored_assessment_eligible')
    .in('id', evidenceIds)
  if (evidenceError) return databaseError(c, 'Curriculum evidence lookup failed:', evidenceError)
  if ((evidence || []).length !== evidenceIds.length) {
    return c.json({ error: 'One or more evidence records were not found' }, 404)
  }

  const gapIds = [...new Set(evidence.map((item) => item.gap_id))]
  const { data: gaps, error: gapError } = await supabase
    .from('curriculum_module_gaps')
    .select('id, lesson_plan_id')
    .in('id', gapIds)
  if (gapError) return databaseError(c, 'Curriculum gap lookup failed:', gapError)
  const gapLessonById = new Map((gaps || []).map((gap) => [gap.id, gap.lesson_plan_id]))

  for (const item of evidence) {
    if (
      gapLessonById.get(item.gap_id) !== lessonPlanId ||
      item.review_status !== 'approved' ||
      item.license_status !== 'verified-for-use' ||
      item.scored_assessment_eligible !== false ||
      !item.approved_source_id
    ) {
      return c.json({ error: 'Every selected evidence record must be approved for this lesson and remain non-assessment evidence' }, 409)
    }
  }

  const sourceIds = [...new Set(evidence.map((item) => item.approved_source_id))]
  const { data: sources, error: sourceError } = await supabase
    .from('approved_sources')
    .select('id, status')
    .in('id', sourceIds)
  if (sourceError) return databaseError(c, 'Approved source status lookup failed:', sourceError)
  const sourceStatusById = new Map((sources || []).map((source) => [source.id, source.status]))
  const unavailableSource = sourceIds.find((sourceId) => sourceStatusById.get(sourceId) !== 'approved')
  if (unavailableSource) {
    return c.json({ error: 'Every selected provenance source must still have approved status' }, 409)
  }

  const { data: scopes, error: scopeError } = await supabase
    .from('approved_source_rights_scopes')
    .select('source_id, ai_rag_ingestion_allowed, citation_link_allowed, paraphrase_summary_allowed, database_storage_allowed, effective_at, expires_at, license_evidence_reference, reviewed_by, reviewed_at')
    .in('source_id', sourceIds)
  if (scopeError) return databaseError(c, 'Approved source rights lookup failed:', scopeError)

  const scopeBySource = new Map((scopes || []).map((scope) => [scope.source_id, scope]))
  const blockedSource = sourceIds.find((sourceId) => !currentRights(scopeBySource.get(sourceId)))
  if (blockedSource) {
    return c.json({
      error: 'AI-assisted drafting is blocked until every selected source has current human-reviewed AI/RAG, paraphrase/summary, and database-storage permission',
      blockedSourceId: blockedSource
    }, 409)
  }

  const provider = c.env.TORQUEMIND_AI_PROVIDER || 'ollama'
  const model = c.env.TORQUEMIND_AI_MODEL || 'gpt-oss:20b-cloud'
  const url = c.env.TORQUEMIND_AI_URL || 'http://127.0.0.1:11434/api/chat'
  const apiKey = c.env.TORQUEMIND_AI_API_KEY || ''
  let config
  try {
    config = validateProviderConfig({ provider, url, apiKey, env: c.env })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }

  const prompt = buildPrompt({ lesson, steps: steps || [], goal, evidence })
  const configuredTimeout = Number.parseInt(c.env.TORQUEMIND_AI_TIMEOUT_MS || '', 10)
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, DEFAULTS.MIN_TIMEOUT_MS), DEFAULTS.MAX_TIMEOUT_MS)
    : DEFAULTS.DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let raw
  try {
    if (provider === 'ollama') {
      raw = await requestOllama({
        url,
        model,
        prompt,
        apiKey,
        accessClientId: c.env.OLLAMA_ACCESS_CLIENT_ID || '',
        accessClientSecret: c.env.OLLAMA_ACCESS_CLIENT_SECRET || '',
        signal: controller.signal,
        numPredict: 1200,
        systemPrompt: 'You are an instructor-facing curriculum drafting assistant. Use only the supplied approved evidence. Return valid JSON only. Never generate assessment items or publish content.'
      })
    } else if (provider === 'openai-compatible') {
      raw = await requestOpenAI({ url, model, prompt, apiKey, signal: controller.signal })
    } else {
      return c.json({ error: `Unsupported AI provider: ${provider}` }, 503)
    }
  } catch (error) {
    if (error?.name === 'AbortError') return c.json({ error: 'Curriculum drafting request timed out' }, 504)
    console.error('Curriculum enhancement provider failed:', error?.message || error)
    return c.json({ error: 'Curriculum drafting provider unavailable' }, 503)
  } finally {
    clearTimeout(timeout)
  }

  let draftPayload
  try {
    draftPayload = parseDraftJson(raw)
  } catch (error) {
    console.error('Curriculum enhancement response rejected:', error?.message || error)
    return c.json({ error: 'Curriculum drafting provider returned an invalid draft contract' }, 502)
  }

  const now = new Date().toISOString()
  const { data: draft, error: insertError } = await supabase
    .from('curriculum_enhancement_drafts')
    .insert({
      lesson_plan_id: lessonPlanId,
      goal,
      status: 'draft',
      draft_payload: draftPayload,
      ai_provider: config.provider,
      ai_model: model,
      prompt_version: PROMPT_VERSION,
      requested_by: auth.user.id,
      scored_assessment_eligible: false,
      assessment_generation_allowed: false,
      publication_status: 'draft-only',
      updated_at: now
    })
    .select(DRAFT_FIELDS)
    .single()
  if (insertError) return databaseError(c, 'Curriculum enhancement draft create failed:', insertError)

  const evidenceLinks = evidence.map((item) => ({
    draft_id: draft.id,
    evidence_id: item.id,
    source_id: item.approved_source_id,
    rights_reviewed_at_snapshot: scopeBySource.get(item.approved_source_id).reviewed_at
  }))
  const { error: linkError } = await supabase
    .from('curriculum_enhancement_draft_evidence')
    .insert(evidenceLinks)

  if (linkError) {
    await supabase.from('curriculum_enhancement_drafts').delete().eq('id', draft.id)
    return databaseError(c, 'Curriculum enhancement evidence binding failed:', linkError)
  }

  return c.json({
    data: draft,
    governance: {
      publication: 'not-granted',
      scoredAssessmentEligibility: 'not-granted',
      assessmentGeneration: 'not-granted',
      humanReviewRequired: true
    }
  }, 201)
}

export async function handleCurriculumEnhancementDraftReview(c) {
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeDrafts(c)
  if (auth.response) return auth.response

  const draftId = textValue(c.req.param('draftId'))
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Valid JSON body required' }, 400)
  }

  const action = textValue(body.action)
  if (!['review', 'reject'].includes(action)) {
    return c.json({ error: 'action must be review or reject' }, 400)
  }

  const supabase = serviceClient(c)
  const { data: current, error: currentError } = await supabase
    .from('curriculum_enhancement_drafts')
    .select(DRAFT_FIELDS)
    .eq('id', draftId)
    .maybeSingle()
  if (currentError) return databaseError(c, 'Curriculum enhancement draft lookup failed:', currentError)
  if (!current) return c.json({ error: 'Curriculum enhancement draft not found' }, 404)
  if (current.status !== 'draft') {
    return c.json({ error: 'Only draft enhancements can be reviewed or rejected' }, 409)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('curriculum_enhancement_drafts')
    .update({
      status: action === 'review' ? 'reviewed' : 'rejected',
      reviewed_by: auth.user.id,
      reviewed_at: now,
      updated_at: now
    })
    .eq('id', draftId)
    .select(DRAFT_FIELDS)
    .single()
  if (error) return databaseError(c, 'Curriculum enhancement draft review failed:', error)

  return c.json({
    data,
    governance: {
      publication: 'not-granted',
      scoredAssessmentEligibility: 'not-granted',
      assessmentGeneration: 'not-granted',
      humanReviewRequired: true
    }
  }, 200)
}

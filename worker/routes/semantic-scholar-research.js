import { createClient } from '@supabase/supabase-js'
import {
  extractBearerToken,
  verifySupabaseToken
} from '../../api/_utils/auth-utils.js'
import {
  searchSemanticScholar,
  getSemanticScholarPaper
} from '../services/semantic-scholar.js'

const RESEARCH_ROLES = new Set(['teacher', 'instructor', 'professor', 'admin'])

function isResearchRole(role) {
  return RESEARCH_ROLES.has(String(role || '').trim().toLowerCase())
}

async function resolveResearchRole(user, supabaseUrl, serviceRoleKey) {
  const appMetadataRole = user?.app_metadata?.role
  if (isResearchRole(appMetadataRole)) return appMetadataRole

  if (!user?.id) return null

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Research role lookup failed:', error.message || error)
      return null
    }

    return isResearchRole(data?.role) ? data.role : null
  } catch (error) {
    console.error('Research role lookup failed:', error?.message || error)
    return null
  }
}

function errorResponse(c, error) {
  if (error?.code === 'INVALID_QUERY' || error?.code === 'INVALID_PAPER_ID') {
    return c.json({ error: error.message }, 400)
  }
  if (error?.code === 'UPSTREAM_NOT_FOUND') {
    return c.json({ error: 'Research source not found' }, 404)
  }
  if (error?.code === 'LOCAL_RATE_LIMITED') {
    c.header('Retry-After', String(error.retryAfterSeconds || 2))
    return c.json({ error: 'Research service is busy; retry shortly' }, 429)
  }
  if (
    error?.code === 'API_KEY_NOT_CONFIGURED' ||
    error?.code === 'RATE_LIMITER_NOT_CONFIGURED' ||
    error?.code === 'RATE_LIMITER_UNAVAILABLE'
  ) {
    return c.json({ error: 'Research service is not configured' }, 503)
  }
  if (error?.code === 'UPSTREAM_REJECTED') {
    return c.json({ error: 'Research provider rejected the request' }, 502)
  }
  console.error('Semantic Scholar research request failed:', error)
  return c.json({ error: 'Research provider unavailable' }, 502)
}

export async function authorizeResearch(c, { requireSemanticScholarEnabled = true } = {}) {
  if (
    requireSemanticScholarEnabled &&
    String(c.env?.SEMANTIC_SCHOLAR_ENABLED || '').toLowerCase() !== 'true'
  ) {
    return { response: c.json({ error: 'Not found' }, 404) }
  }

  const supabaseUrl = c.env?.SUPABASE_URL
  const serviceRoleKey = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { response: c.json({ error: 'Server configuration incomplete' }, 500) }
  }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  const { user, error } = await verifySupabaseToken(token, supabaseUrl, serviceRoleKey)
  if (error || !user) {
    return { response: c.json({ error: 'Authentication required' }, 401) }
  }

  const role = await resolveResearchRole(user, supabaseUrl, serviceRoleKey)
  if (!role) {
    return { response: c.json({ error: 'Teacher, instructor, professor, or admin access required' }, 403) }
  }

  return { user, role }
}

export async function handleSemanticScholarSearch(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeResearch(c)
  if (auth.response) return auth.response

  try {
    const query = c.req.query('q')
    const limit = c.req.query('limit')
    const result = await searchSemanticScholar(query, limit, c.env)
    return c.json({
      ...result,
      query: String(query || '').trim(),
      retrievedAt: new Date().toISOString(),
      governance: {
        curriculumApproval: 'not-granted',
        scoredAssessmentEligibility: 'not-granted',
        humanReviewRequired: true
      }
    }, 200)
  } catch (error) {
    return errorResponse(c, error)
  }
}

export async function handleSemanticScholarPaper(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const auth = await authorizeResearch(c)
  if (auth.response) return auth.response

  try {
    const result = await getSemanticScholarPaper(c.req.param('paperId'), c.env)
    return c.json({
      ...result,
      retrievedAt: new Date().toISOString(),
      governance: {
        curriculumApproval: 'not-granted',
        scoredAssessmentEligibility: 'not-granted',
        humanReviewRequired: true
      }
    }, 200)
  } catch (error) {
    return errorResponse(c, error)
  }
}

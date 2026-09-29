const { createClient } = require('@supabase/supabase-js')

const baseUrl = String(
  process.env.EVIDENCE_WORKFLOW_BASE_URL || 'https://app.autolearnpro.com'
).replace(/\/$/, '')
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const accessToken = String(process.env.EVIDENCE_WORKFLOW_ACCESS_TOKEN || '').trim()
const lessonPlanId = String(
  process.env.EVIDENCE_WORKFLOW_LESSON_PLAN_ID || 'ug-electrical-charging-system'
).trim()
const expectedSupabaseRef = String(
  process.env.EVIDENCE_WORKFLOW_EXPECTED_SUPABASE_REF || 'pffdgqpynpbffbcnxmum'
).trim()
const searchQuery = String(
  process.env.EVIDENCE_WORKFLOW_SEARCH_QUERY || 'automotive charging system diagnostics'
).trim()

function required(name, value) {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function api(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} returned HTTP ${response.status}: ${payload.error || 'unknown error'}`)
  }
  return payload
}

async function main() {
  required('EVIDENCE_WORKFLOW_ACCESS_TOKEN', accessToken)
  required('SUPABASE_URL', supabaseUrl)
  required('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey)
  required('EVIDENCE_WORKFLOW_LESSON_PLAN_ID', lessonPlanId)
  required('EVIDENCE_WORKFLOW_EXPECTED_SUPABASE_REF', expectedSupabaseRef)
  assert(
    supabaseUrl.includes(expectedSupabaseRef),
    'SUPABASE_URL does not match EVIDENCE_WORKFLOW_EXPECTED_SUPABASE_REF'
  )

  const cleanup = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })

  const { error: cleanupPreflightError } = await cleanup
    .from('curriculum_module_gaps')
    .select('id')
    .limit(1)
  if (cleanupPreflightError) {
    throw new Error(`Cleanup credential preflight failed: ${cleanupPreflightError.message}`)
  }

  const marker = `e2e-${Date.now()}-${process.pid}`
  let gapId = null

  try {
    const gapPayload = await api('/api/research/curriculum-evidence/gaps', {
      method: 'POST',
      body: JSON.stringify({
        lessonPlanId,
        gapSummary: `[${marker}] Automated evidence-workflow verification; safe to delete.`,
        gapType: 'evidence',
        priority: 'low'
      })
    })

    const gap = gapPayload.data
    gapId = gap?.id || null
    assert(gapId, 'Gap creation did not return an id')
    assert(gap.lesson_plan_id === lessonPlanId, 'Gap lesson mapping changed unexpectedly')
    assert(gap.status === 'identified', 'New gap must remain identified')
    assert(gap.scored_assessment_eligible === false, 'Gap must not be assessment eligible')

    const search = await api(
      '/api/research/semantic-scholar/search?' +
        new URLSearchParams({ q: searchQuery, limit: '1' }).toString()
    )
    assert(search.governance?.curriculumApproval === 'not-granted', 'Search cannot grant curriculum approval')
    assert(
      search.governance?.scoredAssessmentEligibility === 'not-granted',
      'Search cannot grant scored-assessment eligibility'
    )

    const paper = Array.isArray(search.data) ? search.data.find((item) => item?.paperId && item?.title) : null
    assert(paper, 'Semantic Scholar search returned no usable paper')

    const evidencePayload = await api('/api/research/curriculum-evidence/records', {
      method: 'POST',
      body: JSON.stringify({
        gapId,
        providerRecordId: paper.paperId,
        title: paper.title,
        authors: Array.isArray(paper.authors) ? paper.authors : [],
        publicationYear: Number.isInteger(paper.year) ? paper.year : null,
        venue: paper.venue || null,
        doi: paper.externalIds?.DOI || null,
        sourceUrl: paper.url || null,
        abstract: paper.abstract || null,
        citationCount: Number.isInteger(paper.citationCount) ? paper.citationCount : null,
        providerMetadata: {
          verificationMarker: marker,
          publicationDate: paper.publicationDate || null,
          publicationTypes: Array.isArray(paper.publicationTypes) ? paper.publicationTypes : []
        }
      })
    })

    const evidence = evidencePayload.data
    assert(evidence?.gap_id === gapId, 'Evidence was not saved to the created gap')
    assert(evidence.discovery_provider === 'semantic-scholar', 'Unexpected evidence discovery provider')
    assert(evidence.review_status === 'discovered', 'Evidence must remain discovered after save')
    assert(evidence.license_status === 'unverified', 'Evidence license must remain unverified after save')
    assert(evidence.approved_source_id == null, 'Evidence must not auto-link to an approved source')
    assert(evidence.reviewed_by == null, 'Evidence must not acquire an automatic reviewer')
    assert(evidence.license_reviewed_by == null, 'Evidence must not acquire an automatic license reviewer')
    assert(evidence.scored_assessment_eligible === false, 'Evidence must not be assessment eligible')

    const readBack = await api(
      '/api/research/curriculum-evidence/records?' + new URLSearchParams({ gapId }).toString()
    )
    const saved = Array.isArray(readBack.data)
      ? readBack.data.find((item) => item.id === evidence.id)
      : null
    assert(saved, 'Saved evidence was not returned by the read API')
    assert(saved.review_status === 'discovered', 'Read-back evidence review status changed')
    assert(saved.license_status === 'unverified', 'Read-back evidence license status changed')
    assert(saved.scored_assessment_eligible === false, 'Read-back evidence became assessment eligible')

    console.log('[PASS] Curriculum evidence workflow verified end-to-end')
    console.log(JSON.stringify({
      lessonPlanId,
      gapStatus: gap.status,
      provider: evidence.discovery_provider,
      reviewStatus: evidence.review_status,
      licenseStatus: evidence.license_status,
      scoredAssessmentEligible: evidence.scored_assessment_eligible,
      cleanup: 'pending'
    }))
  } finally {

    if (gapId) {
      const { error: evidenceDeleteError } = await cleanup
        .from('curriculum_evidence_records')
        .delete()
        .eq('gap_id', gapId)
      if (evidenceDeleteError) {
        throw new Error(`Cleanup failed deleting evidence records: ${evidenceDeleteError.message}`)
      }

      const { error: gapDeleteError } = await cleanup
        .from('curriculum_module_gaps')
        .delete()
        .eq('id', gapId)
      if (gapDeleteError) {
        throw new Error(`Cleanup failed deleting test gap: ${gapDeleteError.message}`)
      }

      const { data: remaining, error: verifyCleanupError } = await cleanup
        .from('curriculum_module_gaps')
        .select('id')
        .eq('id', gapId)
      if (verifyCleanupError) {
        throw new Error(`Cleanup verification failed: ${verifyCleanupError.message}`)
      }
      assert(Array.isArray(remaining) && remaining.length === 0, 'Cleanup left the test gap behind')
      console.log('[PASS] Test evidence and gap records cleaned up')
    }
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error.message}`)
  process.exitCode = 1
})

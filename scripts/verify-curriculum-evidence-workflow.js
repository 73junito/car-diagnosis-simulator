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
const evidenceDoi = String(
  process.env.EVIDENCE_WORKFLOW_DOI || '10.3389/fmech.2022.1090152'
).trim()
const approvedSourceId = String(
  process.env.EVIDENCE_WORKFLOW_APPROVED_SOURCE_ID || 'frontiers-automotive-alternator-2023'
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
  required('EVIDENCE_WORKFLOW_APPROVED_SOURCE_ID', approvedSourceId)
  required('EVIDENCE_WORKFLOW_DOI', evidenceDoi)
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

    const paperLookup = await api(
      '/api/research/semantic-scholar/paper/' +
        encodeURIComponent(`DOI:${evidenceDoi}`)
    )
    assert(paperLookup.governance?.curriculumApproval === 'not-granted', 'Paper lookup cannot grant curriculum approval')
    assert(
      paperLookup.governance?.scoredAssessmentEligibility === 'not-granted',
      'Paper lookup cannot grant scored-assessment eligibility'
    )

    const paper = paperLookup.data
    assert(paper?.paperId && paper?.title, 'Semantic Scholar exact DOI lookup returned no usable paper')

    const approvedSourcesPayload = await api(
      '/api/research/curriculum-evidence/approved-sources'
    )
    const source = Array.isArray(approvedSourcesPayload.data)
      ? approvedSourcesPayload.data.find((item) => item.id === approvedSourceId)
      : null
    assert(source, 'Configured approved provenance source was not returned by the API')
    assert(source.status === 'approved', 'Configured provenance source is not approved')
    assert(source.rights_scope, 'Configured provenance source has no granular rights scope')
    assert(source.rights_scope.citation_link_allowed === true, 'Citation/link rights are not approved')
    assert(source.rights_scope.paraphrase_summary_allowed === true, 'Paraphrase/summary rights are not approved')
    assert(source.rights_scope.database_storage_allowed === true, 'Database storage rights are not approved')
    assert(
      source.rights_scope.ai_rag_ingestion_allowed === false,
      'AI/RAG ingestion must remain disabled until separately reviewed'
    )

    const paperDoi = String(paper.externalIds?.DOI || '').trim().toLowerCase()
    const sourceDoi = String(source.license?.doi || '').trim().toLowerCase()
    assert(paperDoi && sourceDoi && paperDoi === sourceDoi, 'Discovered paper DOI does not match approved provenance source DOI')

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

    const reviewPayload = await api(
      '/api/research/curriculum-evidence/records/' + encodeURIComponent(evidence.id),
      { method: 'PATCH', body: JSON.stringify({ action: 'review' }) }
    )
    assert(reviewPayload.data?.review_status === 'reviewed', 'Human review did not move evidence to reviewed')
    assert(reviewPayload.data?.reviewed_by, 'Human review did not record reviewer identity')
    assert(reviewPayload.data?.reviewed_at, 'Human review did not record review timestamp')
    assert(reviewPayload.data?.scored_assessment_eligible === false, 'Human review changed assessment eligibility')

    const licensePayload = await api(
      '/api/research/curriculum-evidence/records/' + encodeURIComponent(evidence.id),
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'license', licenseStatus: 'verified-for-use' })
      }
    )
    assert(licensePayload.data?.review_status === 'license-verified', 'License review did not move evidence to license-verified')
    assert(licensePayload.data?.license_status === 'verified-for-use', 'License review did not verify reuse rights')
    assert(licensePayload.data?.license_reviewed_by, 'License review did not record reviewer identity')
    assert(licensePayload.data?.license_reviewed_at, 'License review did not record timestamp')
    assert(licensePayload.data?.scored_assessment_eligible === false, 'License review changed assessment eligibility')

    const linkPayload = await api(
      '/api/research/curriculum-evidence/records/' + encodeURIComponent(evidence.id),
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'link-source', approvedSourceId })
      }
    )
    assert(linkPayload.data?.approved_source_id === approvedSourceId, 'Approved provenance source was not linked')
    assert(linkPayload.data?.scored_assessment_eligible === false, 'Provenance linking changed assessment eligibility')

    const approvePayload = await api(
      '/api/research/curriculum-evidence/records/' + encodeURIComponent(evidence.id),
      { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) }
    )
    assert(approvePayload.data?.review_status === 'approved', 'Evidence approval did not reach approved state')
    assert(approvePayload.data?.license_status === 'verified-for-use', 'Approved evidence lost verified license state')
    assert(approvePayload.data?.approved_source_id === approvedSourceId, 'Approved evidence lost provenance linkage')
    assert(approvePayload.data?.scored_assessment_eligible === false, 'Evidence approval changed assessment eligibility')

    console.log('[PASS] Curriculum evidence workflow verified end-to-end')
    console.log(JSON.stringify({
      lessonPlanId,
      gapStatus: gap.status,
      provider: evidence.discovery_provider,
      reviewStatus: approvePayload.data.review_status,
      licenseStatus: approvePayload.data.license_status,
      approvedSourceId: approvePayload.data.approved_source_id,
      scoredAssessmentEligible: approvePayload.data.scored_assessment_eligible,
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

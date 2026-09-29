/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const html = fs.readFileSync(
  path.join(root, 'dashboard/instructor/research/index.html'),
  'utf8'
)
const js = fs.readFileSync(
  path.join(root, 'dashboard/instructor/research/research.js'),
  'utf8'
)
const route = fs.readFileSync(
  path.join(root, 'worker/routes/curriculum-evidence.js'),
  'utf8'
)
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')

describe('Curriculum evidence review UI contract', () => {
  test('can restore an existing evidence gap after page reload', () => {
    expect(html).toContain('id="research-existing-gap"')
    expect(html).toContain('id="research-use-gap"')
    expect(js).toContain("apiRequest('/api/research/curriculum-evidence/gaps?'")
    expect(js).toContain('existingGaps.find')
    expect(js).toContain('activateGap(selected)')
  })

  test('loads saved evidence for the active gap', () => {
    expect(html).toContain('id="evidence-review-list"')
    expect(html).toContain('id="evidence-review-status"')
    expect(js).toContain("apiRequest('/api/research/curriculum-evidence/records?'")
    expect(js).toContain('gapId: activeGap.id')
    expect(js).toContain('renderEvidenceRecord(record)')
  })

  test('gets provenance choices through a server-side approved-source endpoint', () => {
    expect(workerIndex).toContain(
      "app.get('/api/research/curriculum-evidence/approved-sources'"
    )
    expect(route).toContain('handleCurriculumApprovedSources')
    expect(route).toContain(".from('approved_sources')")
    expect(route).toContain(".eq('status', 'approved')")
    expect(js).toContain(
      "apiRequest('/api/research/curriculum-evidence/approved-sources')"
    )
    expect(js).toContain('Select approved provenance source')
  })

  test('supports only explicit human review actions through PATCH', () => {
    expect(js).toContain("method: 'PATCH'")
    expect(js).toContain("patchEvidence(record, 'review')")
    expect(js).toContain("patchEvidence(record, 'license'")
    expect(js).toContain("patchEvidence(record, 'link-source'")
    expect(js).toContain("patchEvidence(record, 'approve')")
    expect(js).toContain("patchEvidence(record, 'reject')")
    expect(js).toContain('Mark reviewed')
    expect(js).toContain('Record license review')
    expect(js).toContain('Link provenance')
    expect(js).toContain('Approve evidence')
    expect(js).toContain('Reject evidence')
  })

  test('reflects server states and keeps approval gated in the browser', () => {
    expect(js).toContain("record.review_status !== 'license-verified'")
    expect(js).toContain('!record.approved_source_id')
    expect(js).toContain("record.review_status === 'approved'")
    expect(js).toContain("record.review_status === 'rejected'")
    expect(html).toContain(
      'Approval requires human review, verified reuse rights, and linkage to an approved provenance source.'
    )
  })

  test('never grants assessment eligibility or supplies reviewer identity from the browser', () => {
    expect(js).not.toContain('scored_assessment_eligible: true')
    expect(js).not.toContain('scoredAssessmentEligible: true')
    expect(js).not.toContain('reviewed_by:')
    expect(js).not.toContain('license_reviewed_by:')
    expect(js).toContain('Assessment eligibility: none')
  })

  test('renders review content without unsafe HTML injection', () => {
    expect(js).toContain('document.createElement')
    expect(js).toContain('textContent')
    expect(js).not.toContain('innerHTML')
  })
})

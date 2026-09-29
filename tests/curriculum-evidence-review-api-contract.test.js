/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const route = fs.readFileSync(path.join(root, 'worker/routes/curriculum-evidence.js'), 'utf8')
const workerIndex = fs.readFileSync(path.join(root, 'worker/index.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(
    root,
    'supabase/migrations/20260929041951_require_approved_source_for_curriculum_evidence_approval.sql'
  ),
  'utf8'
)

describe('Curriculum evidence review API contract', () => {
  test('adds an authenticated PATCH review route', () => {
    expect(workerIndex).toContain(
      "app.patch('/api/research/curriculum-evidence/records/:evidenceId'"
    )
    expect(route).toContain('handleCurriculumEvidenceRecordReview')
    expect(route).toContain("c.req.method !== 'PATCH'")
    expect(route).toContain("authorizeResearch(c, { requireSemanticScholarEnabled: false })")
  })

  test('restricts evidence review actions to instructor-level roles', () => {
    expect(route).toContain("new Set(['teacher', 'instructor', 'professor', 'admin'])")
    expect(route).toContain('EVIDENCE_REVIEW_ROLES.has')
    expect(route).toContain('Teacher, instructor, professor, or admin access required')
  })

  test('supports explicit human review, license, provenance link, approve, and reject actions', () => {
    expect(route).toContain("action === 'review'")
    expect(route).toContain("action === 'license'")
    expect(route).toContain("action === 'link-source'")
    expect(route).toContain("action === 'approve'")
    expect(route).toContain("action === 'reject'")
    expect(route).toContain('reviewed_by = auth.user.id')
    expect(route).toContain('license_reviewed_by = auth.user.id')
    expect(route).toContain("licenseStatus === 'verified-for-use'")
    expect(route).toContain("current.review_status !== 'license-verified'")
    expect(route).toContain('Finalized evidence cannot be modified')
  })

  test('requires an active approved provenance source before approval', () => {
    expect(route).toContain(".from('approved_sources')")
    expect(route).toContain("source.status !== 'approved'")
    expect(route).toContain('Provenance source must have approved status')
    expect(route).toContain('Approved provenance source linkage is required before approval')
    expect(migration).toContain('approved_source_id is not null')
  })

  test('database approval gate still requires human review and verified reuse rights', () => {
    expect(migration).toContain('reviewed_by is not null')
    expect(migration).toContain('reviewed_at is not null')
    expect(migration).toContain("license_status = 'verified-for-use'")
    expect(migration).toContain('license_reviewed_by is not null')
    expect(migration).toContain('license_reviewed_at is not null')
    expect(migration).toContain('idx_curriculum_evidence_records_approved_source')
    expect(migration).toContain('idx_curriculum_module_gaps_lesson_mapping')
  })

  test('review API never grants scored-assessment eligibility', () => {
    expect(route).toContain("scoredAssessmentEligibility: 'not-granted'")
    expect(route).not.toContain('scored_assessment_eligible: true')
  })
})

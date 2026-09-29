/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const root = path.resolve('.')
const script = fs.readFileSync(
  path.join(root, 'scripts/verify-curriculum-evidence-workflow.js'),
  'utf8'
)
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/curriculum-evidence-production-e2e.yml'),
  'utf8'
)
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')

describe('Curriculum evidence production E2E verifier contract', () => {
  test('workflow is manual-only and uses the production environment', () => {
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/\npush:/)
    expect(workflow).not.toMatch(/\npull_request:/)
    expect(workflow).not.toMatch(/\nschedule:/)
    expect(workflow).toContain('environment: pffdgqpynpbffbcnxmum_production')
  })

  test('requires authentication and cleanup credentials before execution', () => {
    expect(workflow).toContain('PRODUCTION_URL')
    expect(workflow).toContain('PRODUCTION_ANON')
    expect(workflow).toContain('PRODUCTION_SECRET')
    expect(workflow).toContain('PRODUCTION_KEY')
    expect(workflow).toContain('TEST_TEACHER_EMAIL')
    expect(workflow).toContain('TEST_TEACHER_PASSWORD')
    expect(script).toContain("required('EVIDENCE_WORKFLOW_ACCESS_TOKEN'")
    expect(script).toContain("required('SUPABASE_SERVICE_ROLE_KEY'")
    expect(script).toContain("required('EVIDENCE_WORKFLOW_EXPECTED_SUPABASE_REF'")
    expect(script).toContain("required('EVIDENCE_WORKFLOW_APPROVED_SOURCE_ID'")
    expect(script).toContain("required('EVIDENCE_WORKFLOW_DOI'")
    expect(script).toContain("'/api/research/semantic-scholar/paper/'")
    expect(script).toContain('encodeURIComponent(`DOI:${evidenceDoi}`)')
    expect(script).toContain('Cleanup credential preflight failed:')
    expect(workflow).toContain('EVIDENCE_WORKFLOW_EXPECTED_SUPABASE_REF: pffdgqpynpbffbcnxmum')
  })

  test('verifies the governance boundary after writing evidence', () => {
    expect(script).toContain("evidence.review_status === 'discovered'")
    expect(script).toContain("evidence.license_status === 'unverified'")
    expect(script).toContain('evidence.approved_source_id == null')
    expect(script).toContain('evidence.reviewed_by == null')
    expect(script).toContain('evidence.license_reviewed_by == null')
    expect(script).toContain('evidence.scored_assessment_eligible === false')
    expect(script).toContain("paperLookup.governance?.curriculumApproval === 'not-granted'")
    expect(script).toContain("paperLookup.governance?.scoredAssessmentEligibility === 'not-granted'")
  })

  test('verifies human review, license, provenance, and approval while assessment stays ineligible', () => {
    expect(script).toContain("'/api/research/curriculum-evidence/approved-sources'")
    expect(script).toContain('Discovered paper DOI does not match approved provenance source DOI')
    expect(script).toContain('source.rights_scope.citation_link_allowed === true')
    expect(script).toContain('source.rights_scope.paraphrase_summary_allowed === true')
    expect(script).toContain('source.rights_scope.database_storage_allowed === true')
    expect(script).toContain('source.rights_scope.ai_rag_ingestion_allowed === false')
    expect(script).toContain("JSON.stringify({ action: 'review' })")
    expect(script).toContain("action: 'license', licenseStatus: 'verified-for-use'")
    expect(script).toContain("action: 'link-source', approvedSourceId")
    expect(script).toContain("JSON.stringify({ action: 'approve' })")
    expect(script).toContain("review_status === 'approved'")
    expect(script).toContain("scored_assessment_eligible === false")
    expect(script).toContain("baseUrl + '/api/research/curriculum-enhancements/drafts'")
    expect(script).toContain('blockedDraftResponse.status === 409')
    expect(script).toContain('AI-assisted drafting is blocked')
    expect(script).toContain('AI rights gate persisted a curriculum enhancement draft despite denied AI/RAG rights')
    expect(script).toContain('[PASS] AI curriculum drafting remained blocked without explicit AI/RAG rights')
    expect(workflow).toContain('EVIDENCE_WORKFLOW_DOI: 10.3389/fmech.2022.1090152')
    expect(workflow).toContain('EVIDENCE_WORKFLOW_APPROVED_SOURCE_ID: frontiers-automotive-alternator-2023')
  })

  test('cleans up any draft artifacts before deleting the exact evidence gap', () => {
    expect(script).toContain(".from('curriculum_enhancement_drafts')")
    expect(script).toContain(".from('curriculum_enhancement_draft_evidence')")
    expect(script).toContain(".eq('goal', enhancementGoal)")
    expect(script).toContain(".eq('gap_id', gapId)")
    expect(script).toContain(".eq('id', gapId)")
    expect(script).toContain('Cleanup left the test gap behind')
    expect(script).toContain('[PASS] Test evidence and gap records cleaned up')
  })

  test('uses the active charging-system lesson by default and is exposed as an npm command', () => {
    expect(script).toContain("'ug-electrical-charging-system'")
    expect(packageJson).toContain(
      '"verify:evidence-workflow": "node scripts/verify-curriculum-evidence-workflow.js"'
    )
    expect(workflow).toContain('EVIDENCE_WORKFLOW_LESSON_PLAN_ID: ug-electrical-charging-system')
  })
})

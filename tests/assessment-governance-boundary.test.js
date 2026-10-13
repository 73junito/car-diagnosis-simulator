const fs = require('fs')
const path = require('path')
const { verifyAssessmentBoundary } = require('../scripts/verify-assessment-governance-boundary.js')

describe('assessment governance boundary', () => {
  const prep = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data/evidence/review-queues/charging-system-assessment-eligibility-prep-20261003.json'),
    'utf8'
  ))
  const drafts = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data/evidence/review-queues/charging-system-formative-question-drafts-20261003.json'),
    'utf8'
  ))

  test('current governed artifacts remain assessment-ineligible', () => {
    expect(verifyAssessmentBoundary(prep, drafts)).toEqual({ ok: true, errors: [] })
  })

  test('fails on accidental assessment promotion', () => {
    const promoted = JSON.parse(JSON.stringify(prep))
    promoted.reviews[0].assessment_eligible = true
    const result = verifyAssessmentBoundary(promoted, drafts)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('forbidden assessment promotion')
  })

  test('fails if a formative draft package loses its governance disclaimer', () => {
    const changed = JSON.parse(JSON.stringify(drafts))
    changed.purpose = 'Create formative question drafts.'
    const result = verifyAssessmentBoundary(prep, changed)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('explicitly deny assessment eligibility')
  })
})

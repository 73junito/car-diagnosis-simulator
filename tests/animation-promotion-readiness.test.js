const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const readJson = (relative) => JSON.parse(read(relative))

describe('ANIM-2F controlled animation promotion scaffold', () => {
  test('starts blocked with no synthesized human review or final approval records', () => {
    const readiness = readJson('animation/promotion/starting-system-voltage-drop-promotion.json')
    expect(readiness.status).toBe('blocked-awaiting-human-review-and-final-approval')
    expect(readiness.requiredHumanReviews).toEqual([
      { role: 'technical-reviewer', recordPath: null, requiredDecision: 'pass' },
      { role: 'instructional-reviewer', recordPath: null, requiredDecision: 'pass' },
    ])
    expect(readiness.finalApproval.recordPath).toBeNull()
    expect(readiness.governance).toMatchObject({
      promotionMayProceed: false,
      publicationAllowed: false,
      assessmentEligible: false,
      scoredAssessmentApproved: false,
      agentMayApprove: false,
      agentMayRelease: false,
      automationMayReject: true,
      automationMayPromote: false,
    })
  })

  test('requires a separate final human approval after both review roles', () => {
    const readiness = readJson('animation/promotion/starting-system-voltage-drop-promotion.json')
    expect(readiness.finalApproval.requiredDecision).toBe('approve-for-governed-instructional-publication')
    expect(readiness.finalApproval.reviewerIdentityRequired).toBe(true)
    expect(readiness.finalApproval.reviewedAtRequired).toBe(true)
    expect(readiness.invariants.join('\n')).toMatch(/separate named human final-approval record/)
  })

  test('does not add review assets or promotion artifacts to the production build', () => {
    const build = read('scripts/build-static-site.js')
    expect(build).not.toContain('animation/promotion')
    expect(build).not.toContain('animation/review-assets')
    expect(build).not.toContain('starting-system-voltage-drop-review.glb')
  })

  test('validator reports the expected blocked state without treating missing human records as a CI failure', () => {
    const output = childProcess.execFileSync(process.execPath, ['scripts/verify-animation-promotion-readiness.js'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(output).toContain('[PASS] Starting System controlled-promotion contract')
    expect(output).toContain('Technical review: MISSING')
    expect(output).toContain('Instructional review: MISSING')
    expect(output).toContain('Final human publication approval: MISSING')
    expect(output).toContain('Promotion state: BLOCKED')
  })
})

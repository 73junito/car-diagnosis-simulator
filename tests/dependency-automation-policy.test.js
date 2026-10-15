const { verifyDependencyAutomation } = require('../scripts/verify-dependency-automation')

describe('controlled dependency automation', () => {
  test('keeps routine dependency updates bounded and major upgrades manual', () => {
    const result = verifyDependencyAutomation()

    expect(result.provider).toBe('dependabot')
    expect(result.npmOpenPullRequestLimit).toBe(6)
    expect(result.actionsOpenPullRequestLimit).toBe(4)
    expect(result.groups).toHaveLength(8)
    expect(result.autoMergeAllowed).toBe(false)
  })
})

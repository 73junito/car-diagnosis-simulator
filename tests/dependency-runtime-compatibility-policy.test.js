const {
  compareVersions,
  parseVersion,
  verify,
  verifyCaretRuntimeDependency
} = require('../scripts/verify-dependency-runtime-compatibility')

describe('dependency runtime compatibility policy', () => {
  test('current repository dependency runtime policy passes with isolated ZenUML shim', () => {
    const result = verify()
    expect(result.zenumlPlaywrightPeer).toBe('1.57.0')
    expect(result.playwrightCoreShim).toBe('1.57.0')
    expect(result.primaryPlaywright).toBe('1.63.0')
    expect(result.primaryPlaywrightCore).toBe('1.63.0')
  })

  test('allows reviewed same-major Supabase patch/minor movement', () => {
    expect(() => verifyCaretRuntimeDependency({
      name: 'Supabase JS',
      declaredRange: '^2.117.3',
      lockedVersion: '2.117.3',
      reviewedFloor: '2.117.2',
      major: 2
    })).not.toThrow()

    expect(() => verifyCaretRuntimeDependency({
      name: 'Supabase JS',
      declaredRange: '^2.118.0',
      lockedVersion: '2.118.4',
      reviewedFloor: '2.117.2',
      major: 2
    })).not.toThrow()
  })

  test('rejects major-version changes and floor regressions', () => {
    expect(() => verifyCaretRuntimeDependency({
      name: 'Supabase JS',
      declaredRange: '^3.0.0',
      lockedVersion: '3.0.0',
      reviewedFloor: '2.117.2',
      major: 2
    })).toThrow(/major 2/)

    expect(() => verifyCaretRuntimeDependency({
      name: 'Supabase JS',
      declaredRange: '^2.116.9',
      lockedVersion: '2.117.3',
      reviewedFloor: '2.117.2',
      major: 2
    })).toThrow(/must not regress/)
  })

  test('rejects non-caret production ranges and lock versions below declared floor', () => {
    expect(() => verifyCaretRuntimeDependency({
      name: 'Hono',
      declaredRange: '~4.13.13',
      lockedVersion: '4.13.13',
      reviewedFloor: '4.13.13',
      major: 4
    })).toThrow(/caret-ranged/)

    expect(() => verifyCaretRuntimeDependency({
      name: 'Hono',
      declaredRange: '^4.14.0',
      lockedVersion: '4.13.13',
      reviewedFloor: '4.13.13',
      major: 4
    })).toThrow(/declared floor/)
  })

  test('version parsing/comparison is deterministic without installed semver tooling', () => {
    expect(parseVersion('2.117.3')).toEqual([2, 117, 3])
    expect(compareVersions('2.117.3', '2.117.2')).toBe(1)
    expect(compareVersions('2.117.2', '2.117.2')).toBe(0)
    expect(compareVersions('2.117.1', '2.117.2')).toBe(-1)
  })
})

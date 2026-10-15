const { verifyRuntimeMatrix } = require('../scripts/verify-runtime-matrix');

describe('runtime stabilization contract', () => {
  test('repository runtime surfaces and compatibility lanes match the authoritative matrix', () => {
    const result = verifyRuntimeMatrix();

    expect(result.canonicalNodeMajor).toBe(22);
    expect(result.compatibilityNodeMajors).toEqual([22, 24]);
    expect(result.releaseAuthorityMajor).toBe(22);
    expect(result.releaseAuthorityVersion).toBe('22.19.0');
    expect(result.surfaces).toEqual([
      { id: 'public', compatibilityDate: '2026-07-30' },
      { id: 'app', compatibilityDate: '2026-08-08' },
      { id: 'exam', compatibilityDate: '2026-09-25' }
    ]);
    expect(result.lmfExistingLabs).toBe(7);
    expect(result.lmfPlannedLabs).toBe(10);
  });
});

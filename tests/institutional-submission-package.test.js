const {
  REQUIRED_FILES,
  REQUIRED_PACKET_PHRASES,
  verify
} = require('../scripts/verify-institutional-submission-package.js')

describe('Phase 7D institutional submission package', () => {
  test('includes the external packet and supporting evidence set', () => {
    expect(REQUIRED_FILES).toContain('docs/institutional-submission/AutoLearnPro-Institutional-Submission-Packet.md')
    expect(REQUIRED_FILES).toContain('docs/institutional-submission/submission-manifest.json')
    expect(REQUIRED_FILES.length).toBeGreaterThanOrEqual(15)
  })

  test('locks assessment and evidence boundary language', () => {
    expect(REQUIRED_PACKET_PHRASES).toContain('Assessment authorization: Not granted')
    expect(REQUIRED_PACKET_PHRASES).toContain('64 strong / 0 solid / 0 review')
  })

  test('submission validator passes', () => {
    expect(verify()).toMatchObject({
      ok: true,
      errors: []
    })
  })
})

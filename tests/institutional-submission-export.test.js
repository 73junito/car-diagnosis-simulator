const { EXPECTED, verify } = require('../scripts/verify-institutional-submission-export.js')

describe('Phase 7E institutional submission export', () => {
  test('locks the 13-page reviewer delivery baseline', () => {
    expect(EXPECTED.page_count).toBe(13)
    expect(EXPECTED.source_main_sha).toBe('051935051b072349c6284be422854f27ac62981a')
  })

  test('locks delivered DOCX and PDF checksums', () => {
    expect(EXPECTED.docx_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(EXPECTED.pdf_sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  test('export manifest validator passes', () => {
    expect(verify()).toMatchObject({ ok:true, errors:[] })
  })
})

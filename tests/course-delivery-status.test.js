const { builtCourseIds, verify } = require('../scripts/verify-course-delivery-status.js')

describe('Phase 7F-A course delivery status baseline', () => {
  test('discovers only AUT-250 as a dedicated course page', () => {
    expect(builtCourseIds()).toEqual(['aut-250'])
  })

  test('keeps academic status separate from delivery status', () => {
    const result = verify()
    expect(result.summary.activeUndergraduateAcademicCourseIds).toEqual(['electrical-1'])
    expect(result.summary.dedicatedCoursePages).toEqual(['aut-250'])
  })

  test('baseline validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

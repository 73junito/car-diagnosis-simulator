const { builtCourseIds, verify } = require('../scripts/verify-course-delivery-status.js')

describe('Phase 7F-C current course delivery status', () => {
  test('discovers Batch 001 plus AUT-250 as dedicated course pages', () => {
    expect(builtCourseIds()).toEqual(['aut-101', 'aut-105', 'aut-110', 'aut-115', 'aut-250'])
  })

  test('keeps academic status separate from delivery status', () => {
    const result = verify()
    expect(result.summary.activeUndergraduateAcademicCourseIds).toEqual(['electrical-1'])
    expect(result.summary.dedicatedCoursePages).toEqual(['aut-101', 'aut-105', 'aut-110', 'aut-115', 'aut-250'])
  })

  test('current delivery validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

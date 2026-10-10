const { builtCourseIds, verify } = require('../scripts/verify-course-delivery-status.js')

describe('Phase 7F-F current course delivery status', () => {
  test('discovers eleven catalog pages plus the legacy AUT-250 training page', () => {
    expect(builtCourseIds()).toEqual([
      'aut-101', 'aut-105', 'aut-110', 'aut-115',
      'aut-130', 'aut-131', 'aut-160', 'aut-180',
      'aut-200', 'aut-201', 'aut-220', 'aut-250'
    ])
  })

  test('distinguishes catalog-aligned pages from the AUT-250 HEV training crosswalk', () => {
    expect(verify().summary.catalogAlignedDedicatedCoursePages).toEqual([
      'aut-101', 'aut-105', 'aut-110', 'aut-115',
      'aut-130', 'aut-131', 'aut-160', 'aut-180',
      'aut-200', 'aut-201', 'aut-220'
    ])
  })

  test('keeps academic status separate from delivery status', () => {
    expect(verify().summary.activeUndergraduateAcademicCourseIds).toEqual(['electrical-1'])
  })

  test('current delivery validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

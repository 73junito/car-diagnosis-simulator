const { builtCourseIds, verify } = require('../scripts/verify-course-delivery-status.js')

describe('Phase 7F-S current course delivery status', () => {
  test('discovers thirty-nine catalog pages plus the legacy AUT-250 training page', () => {
    expect(builtCourseIds()).toEqual([
      'aut-101','aut-105','aut-110','aut-115','aut-120','aut-121','aut-130','aut-131','aut-150','aut-160','aut-170','aut-180',
      'aut-200','aut-201','aut-210','aut-211','aut-220','aut-230','aut-240','aut-250','aut-250-diagnostics','aut-260','aut-270',
      'aut-501','aut-515','aut-520','aut-525','aut-530','aut-535','aut-540','aut-545','aut-550','aut-555','aut-560','aut-565','aut-570','aut-575','aut-580','aut-585','aut-590'
    ])
  })

  test('distinguishes catalog AUT-250 from the legacy AUT-250 HEV route', () => {
    const result=verify()
    expect(result.summary.catalogAlignedDedicatedCoursePages).toEqual([
      'aut-101','aut-105','aut-110','aut-115','aut-120','aut-121','aut-130','aut-131','aut-150','aut-160','aut-170','aut-180',
      'aut-200','aut-201','aut-210','aut-211','aut-220','aut-230','aut-240','aut-250','aut-260','aut-270',
      'aut-501','aut-515','aut-520','aut-525','aut-530','aut-535','aut-540','aut-545','aut-550','aut-555','aut-560','aut-565','aut-570','aut-575','aut-580','aut-585','aut-590'
    ])
  })

  test('keeps academic status separate from delivery status', () => {
    expect(verify().summary.activeUndergraduateAcademicCourseIds).toEqual(['electrical-1'])
  })

  test('current delivery validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

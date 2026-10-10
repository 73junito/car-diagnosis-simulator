const { catalogPrerequisiteIds, verify } = require('../scripts/verify-course-delivery-rollout-plan.js')

describe('Phase 7F-B course delivery rollout plan', () => {
  test('normalizes catalog prerequisite text', () => {
    expect(catalogPrerequisiteIds({ prerequisites: 'None' })).toEqual([])
    expect(catalogPrerequisiteIds({ prerequisites: 'AUT 110' })).toEqual(['aut-110'])
    expect(catalogPrerequisiteIds({ prerequisites: 'Concurrent enrollment in AUT 130' })).toEqual(['aut-130'])
  })

  test('locks the first foundation batch', () => {
    expect(verify().summary.batch1).toEqual(['aut-101', 'aut-105', 'aut-110', 'aut-115'])
  })

  test('keeps unresolved mapping blockers out of rollout batches', () => {
    expect(verify().summary.blockers).toEqual(['aut-120', 'aut-150'])
  })

  test('rollout plan validator passes', () => {
    expect(verify()).toMatchObject({ ok: true, errors: [] })
  })
})

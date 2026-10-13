const { EXPECTED, verifyCoverage } = require('../scripts/verify-curriculum-reference-coverage-baseline.js')

describe('curriculum reference coverage release gate', () => {
  function buildPayload() {
    const lessonPlans = []
    for (let i = 1; i <= EXPECTED.undergraduate; i += 1) {
      lessonPlans.push({ id: `ug-${i}`, academicLevel: 'undergraduate', courseId: 'ug', title: `UG ${i}` })
    }
    for (let i = 1; i <= EXPECTED.graduate; i += 1) {
      lessonPlans.push({ id: `grad-${i}`, academicLevel: 'graduate', courseId: 'grad', title: `Grad ${i}` })
    }
    return {
      curriculum: { lessonPlans },
      references: {
        data: [{ id: 'ref', title: 'Reference', publisher: 'Authority' }],
        mappings: lessonPlans.map((lesson) => ({
          reference_id: 'ref',
          lesson_plan_id: lesson.id,
          role: 'support'
        }))
      }
    }
  }

  test('passes the 64/64 baseline', () => {
    const { curriculum, references } = buildPayload()
    const result = verifyCoverage(curriculum, references)
    expect(result.ok).toBe(true)
    expect(result.report.summary.coveragePercent).toBe(100)
  })

  test('fails if any lesson loses all reference coverage', () => {
    const { curriculum, references } = buildPayload()
    references.mappings = references.mappings.filter((m) => m.lesson_plan_id !== 'ug-1')
    const result = verifyCoverage(curriculum, references)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('expected 64/64 covered')
  })

  test('fails if the denominator shrinks', () => {
    const { curriculum, references } = buildPayload()
    curriculum.lessonPlans.pop()
    const result = verifyCoverage(curriculum, references)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('expected 64 lessons')
  })
})

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const architecture = require('../data/curriculum/program-architecture.json')
const undergraduate = require('../data/curriculum/undergraduate-courses.json').courses
const graduate = require('../data/curriculum/graduate-courses.json').courses
const competencies = require('../data/curriculum/competencies.json').competencies
const lessons = require('../data/curriculum/lesson-plans.json').lessonPlans
const extensions = require('../data/curriculum/lesson-content-extensions.json').lessonContentPlans

const expected = [
  ['aut-150','ug-aut150-steering-suspension-alignment','undergraduate'],
  ['aut-210','ug-aut210-engine-performance-fuel-systems','undergraduate'],
  ['aut-330','ug-aut330-electric-vehicle-technology','undergraduate'],
  ['aut-525','grad-aut525-experimental-methods','graduate']
]

describe('Phase 7F-Q canonical curriculum blocker resolution', () => {
  test('creates identity-preserving canonical development records', () => {
    const developed = [...undergraduate, ...graduate]
    for (const [courseId, lessonId, level] of expected) {
      expect(developed.find((c) => c.id === courseId)).toMatchObject({id:courseId,academicLevel:level,status:'planned'})
      expect(architecture.catalogDevelopmentMappings.find((m) => m.catalogCourseId === courseId)).toEqual({
        catalogCourseId:courseId,
        existingCourseId:courseId,
        existingLessonPlanId:lessonId,
        mappingType:'canonical-catalog-course'
      })
      expect(architecture.catalogCourseCrosswalks.find((m) => m.catalogCourseId === courseId)).toBeUndefined()
      expect(competencies.find((c) => c.courseId === courseId)).toBeTruthy()
      expect(lessons.find((l) => l.id === lessonId)).toMatchObject({courseId,academicLevel:level,status:'planned'})
      expect(extensions.find((p) => p.lessonPlanId === lessonId)).toMatchObject({status:'planned'})
    }
  })

  test('migration creates canonical records and maps only existing governed references', () => {
    const sql = fs.readFileSync(path.join(ROOT,'supabase','migrations','20261010191000_resolve_four_canonical_curriculum_blockers.sql'),'utf8')
    for (const [courseId, lessonId] of expected) {
      expect(sql).toContain(courseId)
      expect(sql).toContain(lessonId)
    }
    expect(sql).toContain("'aut-525','automotive-engineering-technology','graduate','15.0803'")
    expect(sql).not.toContain("'aut-525','advanced-automotive-technology','graduate','15.0803'")
    for (const ref of [
      'openstax-university-physics-v1-2026',
      'nhtsa-fmvss-126-electronic-stability-control',
      'openstax-principles-data-science-2025',
      'automotive-engine-diagnostic-survey-2012',
      'nhtsa-electric-hybrid-vehicle-safety-2026',
      'doe-vto-electric-drive-systems-rd'
    ]) expect(sql).toContain(ref)
    expect(sql).not.toMatch(/insert\s+into\s+public\.curriculum_references/i)
  })
})

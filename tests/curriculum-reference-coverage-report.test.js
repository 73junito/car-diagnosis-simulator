const {
  buildCoverage,
  parseArgs,
  renderMarkdown,
  suggestedDomains
} = require('../scripts/curriculum-reference-coverage-report.js')

describe('curriculum reference coverage audit', () => {
  const curriculum = {
    lessonPlans: [
      {
        id: 'ug-electrical-charging-system',
        title: 'Charging-System Evidence and Diagnostic Decisions',
        academicLevel: 'undergraduate',
        courseId: 'charging-systems',
        status: 'active'
      },
      {
        id: 'ug-aut170-hvac-systems',
        title: 'Automotive HVAC, Refrigeration, and Climate-Control Foundations',
        academicLevel: 'undergraduate',
        courseId: 'aut-170',
        status: 'planned'
      },
      {
        id: 'grad-aut570-cybersecurity',
        title: 'Automotive Cybersecurity Threat Modeling and Verification',
        academicLevel: 'graduate',
        courseId: 'aut-570',
        status: 'planned'
      }
    ]
  }

  const references = {
    data: [
      {
        id: 'physics',
        title: 'Physics Reference',
        subjectArea: 'physics',
        rights: {
          aiRagIngestionAllowed: false,
          commercialUseAllowed: false
        }
      },
      {
        id: 'chemistry',
        title: 'Chemistry Reference',
        subjectArea: 'chemistry',
        rights: {
          aiRagIngestionAllowed: false,
          commercialUseAllowed: false
        }
      }
    ],
    mappings: [
      {
        reference_id: 'physics',
        lesson_plan_id: 'ug-electrical-charging-system',
        role: 'stem-foundation'
      },
      {
        reference_id: 'chemistry',
        lesson_plan_id: 'ug-aut170-hvac-systems',
        role: 'chemistry-foundation'
      }
    ]
  }

  test('counts active and planned lesson plans equally as developed coverage', () => {
    const report = buildCoverage(curriculum, references)
    expect(report.summary.totalLessons).toBe(3)
    expect(report.summary.coveredLessons).toBe(2)
    expect(report.summary.uncoveredLessons).toBe(1)
    expect(report.summary.coveragePercent).toBe(66.7)
    expect(report.summary.byAcademicLevel.undergraduate).toEqual({
      total: 2,
      covered: 2,
      uncovered: 0,
      coveragePercent: 100
    })
    expect(report.summary.byAcademicLevel.graduate).toEqual({
      total: 1,
      covered: 0,
      uncovered: 1,
      coveragePercent: 0
    })
    expect(report.summary.uncoveredDomainCounts).toEqual({
      'computing / data science': 1
    })
  })

  test('records mapped subjects and roles without granting additional rights', () => {
    const report = buildCoverage(curriculum, references)
    const charging = report.lessons.find(
      (row) => row.lessonPlanId === 'ug-electrical-charging-system'
    )
    expect(charging.covered).toBe(true)
    expect(charging.referenceCount).toBe(1)
    expect(charging.subjectAreas).toEqual(['physics'])
    expect(charging.roles).toEqual(['stem-foundation'])
    expect(charging.references[0]).toMatchObject({
      referenceId: 'physics',
      aiRagIngestionAllowed: false,
      commercialUseAllowed: false
    })
  })

  test('provides deterministic gap-domain hints only for uncovered lessons', () => {
    const report = buildCoverage(curriculum, references)
    const cyber = report.lessons.find(
      (row) => row.lessonPlanId === 'grad-aut570-cybersecurity'
    )
    expect(cyber.suggestedReferenceDomains).toContain('computing / data science')
    expect(
      report.lessons.find((row) => row.lessonPlanId === 'ug-aut170-hvac-systems')
        .suggestedReferenceDomains
    ).toEqual([])
  })

  test('renders a markdown audit with the all-lesson coverage table', () => {
    const escapedCurriculum = {
      lessonPlans: [
        ...curriculum.lessonPlans,
        {
          id: 'ug-path\\with-pipe|example',
          title: 'Path \\ and | delimiter',
          academicLevel: 'undergraduate',
          courseId: 'escape-test',
          status: 'planned'
        }
      ]
    }
    const markdown = renderMarkdown(buildCoverage(escapedCurriculum, references))
    expect(markdown).toContain('# Curriculum Reference Coverage Audit')
    expect(markdown).toContain('Regenerate with: `npm run audit:curriculum-references`.')
    expect(markdown).toContain('Overall coverage: **2/4 lessons (50%)**.')
    expect(markdown).toContain('## Uncovered-domain audit hints')
    expect(markdown).toContain('| computing / data science | 1 |')
    expect(markdown).toContain('ug-electrical-charging-system')
    expect(markdown).toContain('grad-aut570-cybersecurity')
    expect(markdown).toContain(
      'Suggested gap domains are deterministic audit hints only; they do not authorize or select a source.'
    )
    expect(markdown).toContain('ug-path\\\\with-pipe\\|example')
    expect(markdown).toContain('Path \\\\ and \\| delimiter')
  })

  test('parses threshold and output arguments', () => {
    expect(
      parseArgs([
        '--base-url',
        'https://example.test',
        '--json',
        'report.json',
        '--markdown',
        'report.md',
        '--fail-below',
        '25'
      ])
    ).toMatchObject({
      baseUrl: 'https://example.test',
      jsonPath: 'report.json',
      markdownPath: 'report.md',
      failBelow: 25
    })
    expect(() => parseArgs(['--fail-below', '101'])).toThrow(
      '--fail-below must be a number from 0 to 100'
    )
  })

  test('suggested domains are stable for major curriculum families', () => {
    expect(
      suggestedDomains({
        id: 'x',
        title: 'Vehicle Network and Embedded Software',
        courseId: 'x'
      })
    ).toContain('computing / data science')
    expect(
      suggestedDomains({
        id: 'y',
        title: 'Battery Thermal Management',
        courseId: 'y'
      })
    ).toEqual(
      expect.arrayContaining([
        'chemistry / materials',
        'electrical / physical science',
        'physics / engineering mechanics'
      ])
    )
  })
})

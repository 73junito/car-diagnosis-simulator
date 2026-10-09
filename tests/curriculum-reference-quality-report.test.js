const {
  ageReview,
  authorityFamily,
  buildQualityReport,
  isAutomotiveDomainSource,
  isGenericFoundation,
  parseArgs,
  renderMarkdown
} = require('../scripts/curriculum-reference-quality-report.js')

describe('curriculum reference quality and depth audit', () => {
  const curriculum = {
    lessonPlans: [
      { id: 'domain-strong', title: 'Automotive Diagnostics', academicLevel: 'undergraduate', courseId: 'a' },
      { id: 'generic-review', title: 'Research Methods', academicLevel: 'graduate', courseId: 'b' },
      { id: 'same-family', title: 'Vehicle Systems', academicLevel: 'graduate', courseId: 'c' }
    ]
  }

  const references = {
    data: [
      {
        id: 'nhtsa',
        title: 'Vehicle Safety Reference',
        publisher: 'National Highway Traffic Safety Administration',
        publicationYear: 2022,
        sourceKind: 'technical-reference',
        subjectArea: 'vehicle diagnostics'
      },
      {
        id: 'openstax',
        title: 'University Physics',
        publisher: 'OpenStax / Rice University',
        publicationYear: 2026,
        sourceKind: 'oer-textbook',
        subjectArea: 'physics'
      },
      {
        id: 'data',
        title: 'Principles of Data Science',
        publisher: 'OpenStax / Rice University',
        publicationYear: 2025,
        sourceKind: 'oer-textbook',
        subjectArea: 'data science'
      },
      {
        id: 'gm',
        title: 'Pre- and Post-Scan of Collision Vehicles',
        publisher: 'General Motors',
        publicationYear: 2022,
        sourceKind: 'technical-reference',
        subjectArea: 'automotive diagnostic verification'
      },
      {
        id: 'bosch',
        title: 'Alternator Technical Poster',
        publisher: 'Robert Bosch GmbH',
        publicationYear: 2015,
        sourceKind: 'technical-reference',
        subjectArea: 'automotive charging systems'
      }
    ],
    mappings: [
      { reference_id: 'nhtsa', lesson_plan_id: 'domain-strong', role: 'vehicle-reference' },
      { reference_id: 'openstax', lesson_plan_id: 'domain-strong', role: 'physics-foundation' },
      { reference_id: 'openstax', lesson_plan_id: 'generic-review', role: 'research-foundation' },
      { reference_id: 'data', lesson_plan_id: 'generic-review', role: 'data-foundation' },
      { reference_id: 'gm', lesson_plan_id: 'same-family', role: 'diagnostic-reference' },
      { reference_id: 'bosch', lesson_plan_id: 'same-family', role: 'charging-reference' }
    ]
  }

  test('classifies authority families deterministically', () => {
    expect(authorityFamily(references.data[0])).toBe('federal-government')
    expect(authorityFamily(references.data[1])).toBe('oer-foundation')
    expect(authorityFamily(references.data[3])).toBe('oem-industry')
  })

  test('distinguishes automotive-domain sources from generic foundations', () => {
    expect(isAutomotiveDomainSource(references.data[0])).toBe(true)
    expect(isAutomotiveDomainSource(references.data[1])).toBe(false)
    expect(isGenericFoundation(references.data[1])).toBe(true)
    expect(isGenericFoundation(references.data[3])).toBe(false)
  })

  test('rates strong, solid, and review lessons without converting flags into approvals', () => {
    const report = buildQualityReport(curriculum, references)
    expect(report.lessons.find((x) => x.lessonPlanId === 'domain-strong').rating).toBe('strong')
    const generic = report.lessons.find((x) => x.lessonPlanId === 'generic-review')
    expect(generic.rating).toBe('review')
    expect(generic.flags).toEqual(expect.arrayContaining(['no-automotive-domain-authority', 'single-authority-family', 'same-publisher-only', 'generic-foundation-only']))
    const same = report.lessons.find((x) => x.lessonPlanId === 'same-family')
    expect(same.rating).toBe('solid')
    expect(same.flags).toContain('single-authority-family')
  })

  test('screens older technical references for human currency review only', () => {
    expect(ageReview(references.data[4], 2026)).toBe(true)
    expect(ageReview(references.data[0], 2026)).toBe(false)
    const report = buildQualityReport(curriculum, references, { currentYear: 2026 })
    expect(report.technicalSourceAgeReview.map((x) => x.referenceId)).toContain('bosch')
  })

  test('renders a human-review queue and full pairing table', () => {
    const markdown = renderMarkdown(buildQualityReport(curriculum, references))
    expect(markdown).toContain('# Curriculum Reference Quality & Depth Audit')
    expect(markdown).toContain('deterministic screening audit')
    expect(markdown).toContain('generic-review')
    expect(markdown).toContain('## All lesson pairings')
    expect(markdown).toContain('## Technical-source age review')
    expect(markdown).toContain('before being described as outdated or current')
  })

  test('parses output and fail-on-review arguments', () => {
    expect(parseArgs(['--base-url', 'https://example.test', '--json', 'a.json', '--markdown', 'a.md', '--fail-on-review'])).toEqual({
      baseUrl: 'https://example.test',
      jsonPath: 'a.json',
      markdownPath: 'a.md',
      failOnReview: true
    })
    expect(() => parseArgs(['--bogus'])).toThrow('Unknown or incomplete argument')
  })
})

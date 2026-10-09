const {
  ageReview,
  authorityFamily,
  authorityOrganization,
  buildQualityReport,
  isAutomotiveDomainSource,
  isDirectDomainAuthority,
  isGenericFoundation,
  parseArgs,
  renderMarkdown
} = require('../scripts/curriculum-reference-quality-report.js')

describe('curriculum reference quality and depth audit', () => {
  const curriculum = {
    lessonPlans: [
      { id: 'domain-strong', title: 'Automotive Diagnostics', academicLevel: 'undergraduate', courseId: 'a' },
      { id: 'generic-review', title: 'Research Methods', academicLevel: 'graduate', courseId: 'b' },
      { id: 'same-family', title: 'Vehicle Systems', academicLevel: 'graduate', courseId: 'c' },
      { id: 'measurement', title: 'Automotive Measurement and Instrumentation', academicLevel: 'undergraduate', courseId: 'd' },
      { id: 'digital-twin', title: 'Vehicle Digital Twins and Validation', academicLevel: 'graduate', courseId: 'e' },
      { id: 'curriculum-design', title: 'Technical Curriculum and Assessment Design', academicLevel: 'graduate', courseId: 'f' },
      { id: 'leadership', title: 'Evidence-Informed Technical Instructional Leadership', academicLevel: 'graduate', courseId: 'g' }
    ]
  }

  const references = {
    data: [
      { id: 'nhtsa', title: 'Vehicle Safety Reference', publisher: 'National Highway Traffic Safety Administration', publicationYear: 2022, sourceKind: 'technical-reference', subjectArea: 'vehicle diagnostics' },
      { id: 'openstax', title: 'University Physics', publisher: 'OpenStax / Rice University', publicationYear: 2026, sourceKind: 'oer-textbook', subjectArea: 'physics' },
      { id: 'data', title: 'Principles of Data Science', publisher: 'OpenStax / Rice University', publicationYear: 2025, sourceKind: 'oer-textbook', subjectArea: 'data science' },
      { id: 'gm', title: 'Pre- and Post-Scan of Collision Vehicles', publisher: 'General Motors', publicationYear: 2022, sourceKind: 'technical-reference', subjectArea: 'automotive diagnostic verification' },
      { id: 'bosch', title: 'Alternator Technical Poster', publisher: 'Robert Bosch GmbH', publicationYear: 2015, sourceKind: 'technical-reference', subjectArea: 'automotive charging systems' },
      { id: 'nist-measurement', title: 'Measurement Uncertainty Guide', publisher: 'National Institute of Standards and Technology', publicationYear: 2015, sourceKind: 'technical-reference', subjectArea: 'measurement uncertainty and metrology' },
      { id: 'nist-twin', title: 'Digital Twins for Advanced Manufacturing', publisher: 'National Institute of Standards and Technology', publicationYear: 2026, sourceKind: 'technical-reference', subjectArea: 'digital twins, verification, and validation' },
      { id: 'curriculum', title: 'Open Curriculum Development Model', publisher: 'Open Oregon Educational Resources', publicationYear: 2026, sourceKind: 'oer-textbook', subjectArea: 'curriculum and assessment design' },
      { id: 'ies', title: 'Continuous Improvement in Education', publisher: 'U.S. Department of Education, Institute of Education Sciences', publicationYear: 2020, sourceKind: 'technical-reference', subjectArea: 'educational continuous improvement' }
    ],
    mappings: [
      { reference_id: 'nhtsa', lesson_plan_id: 'domain-strong', role: 'vehicle-reference' },
      { reference_id: 'openstax', lesson_plan_id: 'domain-strong', role: 'physics-foundation' },
      { reference_id: 'openstax', lesson_plan_id: 'generic-review', role: 'research-foundation' },
      { reference_id: 'data', lesson_plan_id: 'generic-review', role: 'data-foundation' },
      { reference_id: 'gm', lesson_plan_id: 'same-family', role: 'diagnostic-reference' },
      { reference_id: 'bosch', lesson_plan_id: 'same-family', role: 'charging-reference' },
      { reference_id: 'nist-measurement', lesson_plan_id: 'measurement', role: 'measurement-reference' },
      { reference_id: 'openstax', lesson_plan_id: 'measurement', role: 'physics-foundation' },
      { reference_id: 'nist-twin', lesson_plan_id: 'digital-twin', role: 'digital-twin-reference' },
      { reference_id: 'data', lesson_plan_id: 'digital-twin', role: 'data-foundation' },
      { reference_id: 'curriculum', lesson_plan_id: 'curriculum-design', role: 'curriculum-reference' },
      { reference_id: 'openstax', lesson_plan_id: 'curriculum-design', role: 'foundation' },
      { reference_id: 'ies', lesson_plan_id: 'leadership', role: 'leadership-reference' },
      { reference_id: 'openstax', lesson_plan_id: 'leadership', role: 'foundation' }
    ]
  }

  test('classifies authority families deterministically', () => {
    expect(authorityFamily(references.data[0])).toBe('federal-government')
    expect(authorityFamily(references.data[1])).toBe('oer-foundation')
    expect(authorityFamily(references.data[3])).toBe('oem-industry')
    expect(authorityOrganization(references.data[0])).toBe('nhtsa')
    expect(authorityOrganization(references.data[1])).toBe('openstax')
  })

  test('distinguishes automotive-domain sources from generic foundations', () => {
    expect(isAutomotiveDomainSource(references.data[0])).toBe(true)
    expect(isAutomotiveDomainSource(references.data[1])).toBe(false)
    expect(isAutomotiveDomainSource({
      id: 'systems-engineering',
      title: 'Systems Engineering Handbook',
      publisher: 'National Aeronautics and Space Administration',
      subjectArea: 'systems engineering'
    })).toBe(false)
    expect(isGenericFoundation(references.data[1])).toBe(true)
    expect(isGenericFoundation(references.data[3])).toBe(false)
  })

  test('recognizes direct non-automotive authority for cross-domain lessons', () => {
    expect(isDirectDomainAuthority(references.data[5], curriculum.lessonPlans[3])).toBe(true)
    expect(isDirectDomainAuthority(references.data[6], curriculum.lessonPlans[4])).toBe(true)
    expect(isDirectDomainAuthority(references.data[7], curriculum.lessonPlans[5])).toBe(true)
    expect(isDirectDomainAuthority(references.data[8], curriculum.lessonPlans[6])).toBe(true)
    expect(isDirectDomainAuthority(references.data[2], curriculum.lessonPlans[4])).toBe(false)
  })

  test('rates strong, solid, and review lessons without converting flags into approvals', () => {
    const report = buildQualityReport(curriculum, references)
    expect(report.lessons.find((x) => x.lessonPlanId === 'domain-strong').rating).toBe('strong')
    const generic = report.lessons.find((x) => x.lessonPlanId === 'generic-review')
    expect(generic.rating).toBe('review')
    expect(generic.flags).toEqual(expect.arrayContaining(['no-direct-domain-authority', 'single-authority-organization', 'same-publisher-only', 'generic-foundation-only']))
    const same = report.lessons.find((x) => x.lessonPlanId === 'same-family')
    expect(same.rating).toBe('strong')
    expect(same.flags).not.toContain('single-authority-organization')
    expect(report.lessons.find((x) => x.lessonPlanId === 'measurement').rating).toBe('strong')
    expect(report.lessons.find((x) => x.lessonPlanId === 'digital-twin').rating).toBe('strong')
  })

  test('screens older technical references for human currency review only', () => {
    expect(ageReview(references.data[4], 2026)).toBe(true)
    expect(ageReview(references.data[0], 2026)).toBe(false)
    const report = buildQualityReport(curriculum, references, { currentYear: 2026 })
    expect(report.technicalSourceAgeReview.map((x) => x.referenceId)).toContain('bosch')
  })

  test('renders direct-domain and automotive-domain metrics separately', () => {
    const markdown = renderMarkdown(buildQualityReport(curriculum, references))
    expect(markdown).toContain('# Curriculum Reference Quality & Depth Audit')
    expect(markdown).toContain('direct-domain authority')
    expect(markdown).toContain('Automotive refs')
    expect(markdown).toContain('Authority organizations')
    expect(markdown).toContain('generic-review')
    expect(markdown).toContain('## Technical-source age review')
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

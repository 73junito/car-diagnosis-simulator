'use strict'

const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const args = {
    baseUrl: 'https://app.autolearnpro.com',
    jsonPath: null,
    markdownPath: null,
    failOnReview: false
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i]
    else if (arg === '--json' && argv[i + 1]) args.jsonPath = argv[++i]
    else if (arg === '--markdown' && argv[i + 1]) args.markdownPath = argv[++i]
    else if (arg === '--fail-on-review') args.failOnReview = true
    else if (arg === '--help') args.help = true
    else throw new Error(`Unknown or incomplete argument: ${arg}`)
  }
  return args
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function authorityFamily(source) {
  const publisher = normalize(source.publisher)
  const kind = normalize(source.sourceKind)
  const license = normalize(source.licenseClassification)
  if (/national highway traffic safety|environmental protection agency|occupational safety|department of energy|national aeronautics|national institute of standards|department of education/.test(publisher)) return 'federal-government'
  if (/general motors|robert bosch|sae international|i-car/.test(publisher)) return 'oem-industry'
  if (/sage|mdpi|journal/.test(publisher) || license.includes('scholarly')) return 'scholarly'
  if (kind === 'oer-textbook' || /openstax|bccampus|open oregon|linn-benton/.test(publisher)) return 'oer-foundation'
  return 'technical-other'
}

function isAutomotiveDomainSource(source) {
  const text = [source.id, source.title, source.publisher, source.subjectArea]
    .map(normalize)
    .join(' ')
  return /automotive|vehicle|engine|alternator|charging system|brake|stability control|drivetrain|transmission|refrigerant|mvac|obd|diagnostic|battery electric|hybrid electric|electric drive|power electronics|adas|automated driving|can network|ecu|software-defined|cybersecurity|collision repair/.test(text)
}

function isGenericFoundation(source) {
  if (isAutomotiveDomainSource(source)) return false
  const text = [source.title, source.subjectArea].map(normalize).join(' ')
  const kind = normalize(source.sourceKind)
  return kind === 'oer-textbook' ||
    /mathematics|physics|chemistry|computer science|data science|technical communication|systems engineering|advanced manufacturing|electrical engineering technology|educational continuous improvement/.test(text)
}

function ageReview(source, currentYear = 2026) {
  const year = Number(source.publicationYear)
  if (!Number.isFinite(year) || year <= 0) return false
  return normalize(source.sourceKind) === 'technical-reference' && currentYear - year >= 10
}

function buildQualityReport(curriculum, referencePayload, options = {}) {
  const lessonPlans = Array.isArray(curriculum?.lessonPlans) ? curriculum.lessonPlans : []
  const sources = Array.isArray(referencePayload?.data) ? referencePayload.data : []
  const mappings = Array.isArray(referencePayload?.mappings) ? referencePayload.mappings : []
  const currentYear = options.currentYear || 2026

  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const mappingsByLesson = new Map()
  for (const mapping of mappings) {
    if (!sourceById.has(mapping.reference_id)) continue
    const list = mappingsByLesson.get(mapping.lesson_plan_id) || []
    list.push(mapping)
    mappingsByLesson.set(mapping.lesson_plan_id, list)
  }

  const sourceAgeReview = sources
    .filter((source) => ageReview(source, currentYear))
    .map((source) => ({
      referenceId: source.id,
      title: source.title,
      publisher: source.publisher,
      publicationYear: source.publicationYear
    }))
    .sort((a, b) => (a.publicationYear || 0) - (b.publicationYear || 0) || a.referenceId.localeCompare(b.referenceId))

  const lessons = lessonPlans.map((lesson) => {
    const lessonMappings = mappingsByLesson.get(lesson.id) || []
    const references = lessonMappings.map((mapping) => {
      const source = sourceById.get(mapping.reference_id)
      return {
        referenceId: mapping.reference_id,
        title: source.title,
        publisher: source.publisher,
        publicationYear: source.publicationYear ?? null,
        sourceKind: source.sourceKind,
        subjectArea: source.subjectArea,
        role: mapping.role,
        family: authorityFamily(source),
        automotiveDomain: isAutomotiveDomainSource(source),
        genericFoundation: isGenericFoundation(source),
        ageReview: ageReview(source, currentYear)
      }
    })

    const families = [...new Set(references.map((item) => item.family))].sort()
    const publishers = [...new Set(references.map((item) => item.publisher).filter(Boolean))].sort()
    const domainAuthorityCount = references.filter((item) => item.automotiveDomain).length
    const genericFoundationCount = references.filter((item) => item.genericFoundation).length
    const flags = []
    if (references.length < 2) flags.push('insufficient-reference-depth')
    if (domainAuthorityCount === 0) flags.push('no-automotive-domain-authority')
    if (families.length < 2) flags.push('single-authority-family')
    if (references.length > 1 && publishers.length === 1) flags.push('same-publisher-only')
    if (references.length > 0 && genericFoundationCount === references.length) flags.push('generic-foundation-only')
    if (references.some((item) => item.ageReview)) flags.push('technical-source-age-review')

    let rating = 'strong'
    if (references.length < 2 || domainAuthorityCount === 0) rating = 'review'
    else if (families.length < 2) rating = 'solid'

    return {
      lessonPlanId: lesson.id,
      lessonTitle: lesson.title,
      academicLevel: lesson.academicLevel,
      courseId: lesson.courseId,
      referenceCount: references.length,
      domainAuthorityCount,
      genericFoundationCount,
      authorityFamilies: families,
      publishers,
      rating,
      flags,
      references
    }
  })

  const ratingCounts = lessons.reduce((acc, row) => {
    acc[row.rating] = (acc[row.rating] || 0) + 1
    return acc
  }, {})

  const flagCounts = {}
  for (const row of lessons) {
    for (const flag of row.flags) flagCounts[flag] = (flagCounts[flag] || 0) + 1
  }

  return {
    summary: {
      totalLessons: lessons.length,
      strongLessons: ratingCounts.strong || 0,
      solidLessons: ratingCounts.solid || 0,
      reviewLessons: ratingCounts.review || 0,
      allMultiSource: lessons.every((row) => row.referenceCount >= 2),
      lessonsWithAutomotiveDomainAuthority: lessons.filter((row) => row.domainAuthorityCount > 0).length,
      lessonsWithoutAutomotiveDomainAuthority: lessons.filter((row) => row.domainAuthorityCount === 0).length,
      flagCounts,
      technicalSourceAgeReviewCount: sourceAgeReview.length
    },
    technicalSourceAgeReview: sourceAgeReview,
    lessons
  }
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function renderMarkdown(report) {
  const { summary } = report
  const lines = [
    '# Curriculum Reference Quality & Depth Audit',
    '',
    'Regenerate with: `npm run audit:curriculum-reference-quality`.',
    '',
    '> This is a deterministic screening audit. A flag means “review this pairing,” not “the source is invalid.” It does not grant source rights, evidence approval, instructional approval, or assessment eligibility.',
    '',
    '## Executive summary',
    '',
    `- Lessons audited: **${summary.totalLessons}**`,
    `- Multi-source lessons: **${summary.allMultiSource ? summary.totalLessons : 'not all'}**`,
    `- Strong: **${summary.strongLessons}**`,
    `- Solid: **${summary.solidLessons}**`,
    `- Review: **${summary.reviewLessons}**`,
    `- Lessons with at least one automotive-domain source: **${summary.lessonsWithAutomotiveDomainAuthority}/${summary.totalLessons}**`,
    `- Lessons with no automotive-domain source: **${summary.lessonsWithoutAutomotiveDomainAuthority}**`,
    `- Technical sources meeting the age-review screen: **${summary.technicalSourceAgeReviewCount}**`,
    '',
    '## Screening rules',
    '',
    '- **Strong:** at least two references, at least one automotive-domain source, and at least two authority families.',
    '- **Solid:** at least two references and at least one automotive-domain source, but only one authority family.',
    '- **Review:** fewer than two references or no automotive-domain source.',
    '- **Age review:** technical-reference publication year is at least 10 years old. This is a freshness check only; foundational or still-current standards are not automatically stale.',
    '',
    '## Review queue',
    '',
    '| Level | Lesson | Rating | Refs | Domain refs | Authority families | Flags |',
    '| --- | --- | --- | ---: | ---: | --- | --- |'
  ]

  for (const row of report.lessons
    .filter((item) => item.rating !== 'strong' || item.flags.length > 0)
    .sort((a, b) => {
      const rank = { review: 0, solid: 1, strong: 2 }
      return rank[a.rating] - rank[b.rating] || a.lessonPlanId.localeCompare(b.lessonPlanId)
    })) {
    lines.push(
      `| ${escapeCell(row.academicLevel)} | ${escapeCell(row.lessonPlanId)} - ${escapeCell(row.lessonTitle)} | ${row.rating} | ${row.referenceCount} | ${row.domainAuthorityCount} | ${escapeCell(row.authorityFamilies.join(', '))} | ${escapeCell(row.flags.join(', ') || 'none')} |`
    )
  }

  lines.push('', '## All lesson pairings', '')
  lines.push('| Lesson | Rating | Reference | Publisher | Family | Domain | Role |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const row of report.lessons.sort((a, b) => a.lessonPlanId.localeCompare(b.lessonPlanId))) {
    for (const ref of row.references) {
      lines.push(
        `| ${escapeCell(row.lessonPlanId)} | ${row.rating} | ${escapeCell(ref.referenceId)} | ${escapeCell(ref.publisher)} | ${escapeCell(ref.family)} | ${ref.automotiveDomain ? 'yes' : 'no'} | ${escapeCell(ref.role)} |`
      )
    }
  }

  lines.push('', '## Technical-source age review', '')
  lines.push('| Reference | Publisher | Year |')
  lines.push('| --- | --- | ---: |')
  for (const source of report.technicalSourceAgeReview) {
    lines.push(`| ${escapeCell(source.referenceId)} - ${escapeCell(source.title)} | ${escapeCell(source.publisher)} | ${escapeCell(source.publicationYear)} |`)
  }
  lines.push('', '> Age-review entries require a human currency check before being described as outdated or current.', '')
  return lines.join('\n')
}

async function loadJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[FAIL] Curriculum reference quality audit: ${error.message}`)
    process.exit(1)
  }

  if (args.help) {
    console.log('Usage: node scripts/curriculum-reference-quality-report.js [--base-url URL] [--json FILE] [--markdown FILE] [--fail-on-review]')
    return
  }

  const baseUrl = args.baseUrl.replace(/\/$/, '')
  let curriculum
  let references
  try {
    ;[curriculum, references] = await Promise.all([
      loadJson(`${baseUrl}/api/curriculum`),
      loadJson(`${baseUrl}/api/curriculum/references`)
    ])
  } catch (error) {
    console.error(`[FAIL] Curriculum reference quality audit: ${error.message}`)
    process.exit(1)
  }

  const report = buildQualityReport(curriculum, references)
  if (args.jsonPath) {
    fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true })
    fs.writeFileSync(args.jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  if (args.markdownPath) {
    fs.mkdirSync(path.dirname(args.markdownPath), { recursive: true })
    fs.writeFileSync(args.markdownPath, renderMarkdown(report), 'utf8')
  }

  const s = report.summary
  console.log(`[PASS] Curriculum reference quality screen: ${s.strongLessons} strong, ${s.solidLessons} solid, ${s.reviewLessons} review; automotive-domain authority ${s.lessonsWithAutomotiveDomainAuthority}/${s.totalLessons}`)
  if (args.failOnReview && s.reviewLessons > 0) {
    console.error(`[FAIL] ${s.reviewLessons} lesson(s) remain in the quality review queue`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = {
  ageReview,
  authorityFamily,
  buildQualityReport,
  isAutomotiveDomainSource,
  isGenericFoundation,
  parseArgs,
  renderMarkdown
}

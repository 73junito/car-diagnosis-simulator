'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULT_FRESHNESS_REVIEW_PATH = path.join(
  __dirname,
  '..',
  'data',
  'curriculum',
  'reference-freshness-reviews.json'
)

const RESOLVED_FRESHNESS_STATUSES = new Set([
  'current-authoritative',
  'current-authoritative-with-companion-update',
  'historical-supporting'
])

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

function authorityOrganization(source) {
  const publisher = normalize(source.publisher)
  if (/u\.s\. department of energy|department of energy alternative fuels|department of energy transportation/.test(publisher)) return 'us-department-of-energy'
  if (/national highway traffic safety/.test(publisher)) return 'nhtsa'
  if (/national aeronautics and space administration/.test(publisher)) return 'nasa'
  if (/national institute of standards and technology/.test(publisher)) return 'nist'
  if (/environmental protection agency/.test(publisher)) return 'epa'
  if (/occupational safety and health administration/.test(publisher)) return 'osha'
  if (/department of education|institute of education sciences/.test(publisher)) return 'us-department-of-education-ies'
  if (/openstax/.test(publisher)) return 'openstax'
  if (/bccampus/.test(publisher)) return 'bccampus'
  if (/open oregon|linn-benton/.test(publisher)) return 'open-oregon'
  if (/general motors/.test(publisher)) return 'general-motors'
  if (/robert bosch/.test(publisher)) return 'bosch'
  if (/sae international/.test(publisher)) return 'sae-international'
  if (/i-car/.test(publisher)) return 'i-car'
  if (/sage/.test(publisher)) return 'sage'
  if (/mdpi/.test(publisher)) return 'mdpi'
  return publisher || 'unknown'
}

function sourceText(source) {
  return [source.id, source.title, source.publisher, source.subjectArea]
    .map(normalize)
    .join(' ')
}

function lessonText(lesson) {
  return [lesson.id, lesson.title, lesson.courseId]
    .map(normalize)
    .join(' ')
}

function isAutomotiveDomainSource(source) {
  const text = sourceText(source)
  return /automotive|vehicle|\bengine\b|\bengines\b|alternator|charging system|brake|stability control|drivetrain|transmission|refrigerant|mvac|obd|diagnostic|battery electric|hybrid electric|electric drive|power electronics|adas|automated driving|can network|ecu|software-defined|cybersecurity|collision repair/.test(text)
}

function isDirectDomainAuthority(source, lesson) {
  if (isAutomotiveDomainSource(source)) return true

  const s = sourceText(source)
  const l = lessonText(lesson)

  if (/measurement|instrument/.test(l) && /measurement uncertainty|si units|quantities|metrology/.test(s)) {
    return true
  }
  if (/digital twin/.test(l) && /digital twin/.test(s)) {
    return true
  }
  if (/curriculum|assessment design/.test(l) && /curriculum and assessment|curriculum development/.test(s)) {
    return true
  }
  if (/instructional leadership|technical instructional leadership/.test(l) &&
      /educational continuous improvement|continuous improvement in education/.test(s)) {
    return true
  }
  if (/systems modeling|simulation|modeling/.test(l) &&
      /systems modeling|sysml|digital twin/.test(s)) {
    return true
  }
  if (/automotive math|mathematics|quantitative reasoning/.test(l) &&
      /mathematics|algebra|trigonometry|si units|engineering calculations/.test(s)) {
    return true
  }
  if (/electrical lab|electrical laboratory|circuit evidence/.test(l) &&
      /electrical engineering|circuit analysis|electrical controls/.test(s)) {
    return true
  }
  if (/capstone/.test(l) &&
      /systems modeling|project planning|verification|validation|advanced manufacturing|prototyp/.test(s)) {
    return true
  }

  return false
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

function freshnessReviewMap(payload) {
  const reviews = Array.isArray(payload?.reviews) ? payload.reviews : []
  return new Map(reviews.map((review) => [review.referenceId, review]))
}

function loadFreshnessReviews(filePath = DEFAULT_FRESHNESS_REVIEW_PATH) {
  if (!fs.existsSync(filePath)) return { reviewDate: null, reviews: [] }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function buildQualityReport(curriculum, referencePayload, options = {}) {
  const lessonPlans = Array.isArray(curriculum?.lessonPlans) ? curriculum.lessonPlans : []
  const sources = Array.isArray(referencePayload?.data) ? referencePayload.data : []
  const mappings = Array.isArray(referencePayload?.mappings) ? referencePayload.mappings : []
  const currentYear = options.currentYear || 2026
  const freshnessPayload = options.freshnessReviews || { reviews: [] }
  const freshnessById = freshnessReviewMap(freshnessPayload)

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
    .map((source) => {
      const freshness = freshnessById.get(source.id) || null
      const freshnessStatus = freshness?.status || null
      const ageReviewResolved = RESOLVED_FRESHNESS_STATUSES.has(freshnessStatus)
      return {
        referenceId: source.id,
        title: source.title,
        publisher: source.publisher,
        publicationYear: source.publicationYear,
        ageReviewResolved,
        freshnessStatus,
        freshnessReviewDate: freshness?.evidenceChecked || freshnessPayload.reviewDate || null,
        evidenceUrl: freshness?.evidenceUrl || null,
        companionUrl: freshness?.companionUrl || null,
        rationale: freshness?.rationale || null,
        usageConstraint: freshness?.usageConstraint || null
      }
    })
    .sort((a, b) => (a.publicationYear || 0) - (b.publicationYear || 0) || a.referenceId.localeCompare(b.referenceId))

  const ageReviewById = new Map(sourceAgeReview.map((source) => [source.referenceId, source]))

  const lessons = lessonPlans.map((lesson) => {
    const lessonMappings = mappingsByLesson.get(lesson.id) || []
    const references = lessonMappings.map((mapping) => {
      const source = sourceById.get(mapping.reference_id)
      const directDomainAuthority = isDirectDomainAuthority(source, lesson)
      return {
        referenceId: mapping.reference_id,
        title: source.title,
        publisher: source.publisher,
        publicationYear: source.publicationYear ?? null,
        sourceKind: source.sourceKind,
        subjectArea: source.subjectArea,
        role: mapping.role,
        family: authorityFamily(source),
        organization: authorityOrganization(source),
        automotiveDomain: isAutomotiveDomainSource(source),
        directDomainAuthority,
        genericFoundation: isGenericFoundation(source) && !directDomainAuthority,
        ageReview: ageReview(source, currentYear),
        ageReviewResolved: ageReviewById.get(source.id)?.ageReviewResolved === true,
        freshnessStatus: ageReviewById.get(source.id)?.freshnessStatus || null
      }
    })

    const families = [...new Set(references.map((item) => item.family))].sort()
    const organizations = [...new Set(references.map((item) => item.organization))].sort()
    const publishers = [...new Set(references.map((item) => item.publisher).filter(Boolean))].sort()
    const automotiveDomainCount = references.filter((item) => item.automotiveDomain).length
    const directDomainAuthorityCount = references.filter((item) => item.directDomainAuthority).length
    const genericFoundationCount = references.filter((item) => item.genericFoundation).length
    const flags = []
    if (references.length < 2) flags.push('insufficient-reference-depth')
    if (directDomainAuthorityCount === 0) flags.push('no-direct-domain-authority')
    if (organizations.length < 2) flags.push('single-authority-organization')
    if (references.length > 1 && publishers.length === 1) flags.push('same-publisher-only')
    if (references.length > 0 && genericFoundationCount === references.length) flags.push('generic-foundation-only')
    if (references.some((item) => item.ageReview && !item.ageReviewResolved)) flags.push('technical-source-age-review')

    let rating = 'strong'
    if (references.length < 2 || directDomainAuthorityCount === 0) rating = 'review'
    else if (organizations.length < 2) rating = 'solid'

    return {
      lessonPlanId: lesson.id,
      lessonTitle: lesson.title,
      academicLevel: lesson.academicLevel,
      courseId: lesson.courseId,
      referenceCount: references.length,
      automotiveDomainCount,
      directDomainAuthorityCount,
      genericFoundationCount,
      authorityFamilies: families,
      authorityOrganizations: organizations,
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

  const freshnessStatusCounts = {}
  for (const source of sourceAgeReview) {
    const key = source.freshnessStatus || 'unresolved'
    freshnessStatusCounts[key] = (freshnessStatusCounts[key] || 0) + 1
  }

  return {
    summary: {
      totalLessons: lessons.length,
      strongLessons: ratingCounts.strong || 0,
      solidLessons: ratingCounts.solid || 0,
      reviewLessons: ratingCounts.review || 0,
      allMultiSource: lessons.every((row) => row.referenceCount >= 2),
      lessonsWithDirectDomainAuthority: lessons.filter((row) => row.directDomainAuthorityCount > 0).length,
      lessonsWithoutDirectDomainAuthority: lessons.filter((row) => row.directDomainAuthorityCount === 0).length,
      lessonsWithAutomotiveDomainAuthority: lessons.filter((row) => row.automotiveDomainCount > 0).length,
      lessonsWithoutAutomotiveDomainAuthority: lessons.filter((row) => row.automotiveDomainCount === 0).length,
      flagCounts,
      technicalSourceAgeReviewCount: sourceAgeReview.length,
      technicalSourceAgeReviewedCount: sourceAgeReview.filter((source) => source.ageReviewResolved).length,
      technicalSourceAgeUnresolvedCount: sourceAgeReview.filter((source) => !source.ageReviewResolved).length,
      freshnessStatusCounts
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
    '> This is a deterministic screening audit. A flag means "review this pairing," not "the source is invalid." It does not grant source rights, evidence approval, instructional approval, or assessment eligibility.',
    '',
    '## Executive summary',
    '',
    `- Lessons audited: **${summary.totalLessons}**`,
    `- Multi-source lessons: **${summary.allMultiSource ? summary.totalLessons : 'not all'}**`,
    `- Strong: **${summary.strongLessons}**`,
    `- Solid: **${summary.solidLessons}**`,
    `- Review: **${summary.reviewLessons}**`,
    `- Lessons with at least one direct-domain authority: **${summary.lessonsWithDirectDomainAuthority}/${summary.totalLessons}**`,
    `- Lessons with no direct-domain authority: **${summary.lessonsWithoutDirectDomainAuthority}**`,
    `- Lessons with at least one automotive-domain source: **${summary.lessonsWithAutomotiveDomainAuthority}/${summary.totalLessons}**`,
    `- Technical sources meeting the age-review screen: **${summary.technicalSourceAgeReviewCount}**`,
    `- Age-screen sources with completed freshness review: **${summary.technicalSourceAgeReviewedCount}**`,
    `- Unresolved age-review sources: **${summary.technicalSourceAgeUnresolvedCount}**`,
    '',
    '## Screening rules',
    '',
    '- **Strong:** at least two references, at least one direct-domain authority, and at least two independent authority organizations.',
    '- **Solid:** at least two references and at least one direct-domain authority, but only one authority organization.',
    '- **Review:** fewer than two references or no direct-domain authority.',
    '- **Direct-domain authority:** normally an automotive technical source for automotive lessons; for measurement, digital twins, curriculum/assessment, and instructional leadership, a source directly authoritative in that discipline also qualifies.',
    '- **Age review:** technical-reference publication year is at least 10 years old. This is a freshness check only; foundational or still-current standards are not automatically stale.',
    '- **Resolved age review:** a source-level freshness record with an approved disposition suppresses the unresolved-age flag while preserving publication age and usage constraints.',
    '',
    '## Review queue',
    '',
    '| Level | Lesson | Rating | Refs | Direct-domain refs | Automotive refs | Authority organizations | Authority families | Flags |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |'
  ]

  for (const row of report.lessons
    .filter((item) => item.rating !== 'strong' || item.flags.length > 0)
    .sort((a, b) => {
      const rank = { review: 0, solid: 1, strong: 2 }
      return rank[a.rating] - rank[b.rating] || a.lessonPlanId.localeCompare(b.lessonPlanId)
    })) {
    lines.push(
      `| ${escapeCell(row.academicLevel)} | ${escapeCell(row.lessonPlanId)} - ${escapeCell(row.lessonTitle)} | ${row.rating} | ${row.referenceCount} | ${row.directDomainAuthorityCount} | ${row.automotiveDomainCount} | ${escapeCell(row.authorityOrganizations.join(', '))} | ${escapeCell(row.authorityFamilies.join(', '))} | ${escapeCell(row.flags.join(', ') || 'none')} |`
    )
  }

  lines.push('', '## All lesson pairings', '')
  lines.push('| Lesson | Rating | Reference | Publisher | Organization | Family | Direct domain | Automotive | Role |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const row of report.lessons.sort((a, b) => a.lessonPlanId.localeCompare(b.lessonPlanId))) {
    for (const ref of row.references) {
      lines.push(
        `| ${escapeCell(row.lessonPlanId)} | ${row.rating} | ${escapeCell(ref.referenceId)} | ${escapeCell(ref.publisher)} | ${escapeCell(ref.organization)} | ${escapeCell(ref.family)} | ${ref.directDomainAuthority ? 'yes' : 'no'} | ${ref.automotiveDomain ? 'yes' : 'no'} | ${escapeCell(ref.role)} |`
      )
    }
  }

  lines.push('', '## Technical-source age review', '')
  lines.push('| Reference | Publisher | Year | Disposition | Reviewed | Usage constraint |')
  lines.push('| --- | --- | ---: | --- | --- | --- |')
  for (const source of report.technicalSourceAgeReview) {
    lines.push(`| ${escapeCell(source.referenceId)} - ${escapeCell(source.title)} | ${escapeCell(source.publisher)} | ${escapeCell(source.publicationYear)} | ${escapeCell(source.freshnessStatus || 'unresolved')} | ${escapeCell(source.freshnessReviewDate || 'not reviewed')} | ${escapeCell(source.usageConstraint || 'human currency review required')} |`)
  }
  lines.push('', '> Publication age remains visible even after review. A reviewed historical-supporting source is not current operational guidance.', '')
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

  let freshnessReviews
  try {
    freshnessReviews = loadFreshnessReviews()
  } catch (error) {
    console.error(`[FAIL] Curriculum reference freshness review data: ${error.message}`)
    process.exit(1)
  }

  const report = buildQualityReport(curriculum, references, { freshnessReviews })
  if (args.jsonPath) {
    fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true })
    fs.writeFileSync(args.jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  if (args.markdownPath) {
    fs.mkdirSync(path.dirname(args.markdownPath), { recursive: true })
    fs.writeFileSync(args.markdownPath, renderMarkdown(report), 'utf8')
  }

  const s = report.summary
  console.log(`[PASS] Curriculum reference quality screen: ${s.strongLessons} strong, ${s.solidLessons} solid, ${s.reviewLessons} review; direct-domain authority ${s.lessonsWithDirectDomainAuthority}/${s.totalLessons}; automotive-domain authority ${s.lessonsWithAutomotiveDomainAuthority}/${s.totalLessons}; age review ${s.technicalSourceAgeReviewedCount}/${s.technicalSourceAgeReviewCount} resolved`)
  if (args.failOnReview && s.reviewLessons > 0) {
    console.error(`[FAIL] ${s.reviewLessons} lesson(s) remain in the quality review queue`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = {
  ageReview,
  authorityFamily,
  authorityOrganization,
  buildQualityReport,
  freshnessReviewMap,
  isAutomotiveDomainSource,
  isDirectDomainAuthority,
  isGenericFoundation,
  loadFreshnessReviews,
  parseArgs,
  renderMarkdown
}

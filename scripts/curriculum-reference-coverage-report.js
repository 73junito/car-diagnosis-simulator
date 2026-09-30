'use strict'

const fs = require('fs')
const path = require('path')

function parseArgs(argv) {
  const args = {
    baseUrl: 'https://app.autolearnpro.com',
    jsonPath: null,
    markdownPath: null,
    failBelow: null
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i]
    else if (arg === '--json' && argv[i + 1]) args.jsonPath = argv[++i]
    else if (arg === '--markdown' && argv[i + 1]) args.markdownPath = argv[++i]
    else if (arg === '--fail-below' && argv[i + 1]) args.failBelow = Number(argv[++i])
    else if (arg === '--help') args.help = true
    else throw new Error(`Unknown or incomplete argument: ${arg}`)
  }

  if (args.failBelow != null && (!Number.isFinite(args.failBelow) || args.failBelow < 0 || args.failBelow > 100)) {
    throw new Error('--fail-below must be a number from 0 to 100')
  }

  return args
}

function percent(covered, total) {
  return total > 0 ? Number(((covered / total) * 100).toFixed(1)) : 0
}

function suggestedDomains(lesson) {
  const text = `${lesson.id} ${lesson.title} ${lesson.courseId || ''}`.toLowerCase()
  const domains = new Set()

  if (/math|quantitative|measurement|instrument/.test(text)) domains.add('mathematics / measurement')
  if (/brake|suspension|steering|dynamics|drivetrain|transmission|engine|energy|hvac|refriger|thermal/.test(text)) {
    domains.add('physics / engineering mechanics')
  }
  if (/battery|electric|hybrid|electrical|electronic|power|control|sensor|actuator/.test(text)) {
    domains.add('electrical / physical science')
  }
  if (/battery|emission|hvac|refriger|material/.test(text)) domains.add('chemistry / materials')
  if (/data|network|embedded|software|cyber|adas|autonomous|digital twin|simulation|model/.test(text)) {
    domains.add('computing / data science')
  }
  if (/research|capstone|documentation|service information|internship|leadership|curriculum|seminar/.test(text)) {
    domains.add('technical communication / research')
  }
  if (/safety|environment|professional/.test(text)) domains.add('safety / professional practice')
  if (/manufactur|prototype|fabricat|design/.test(text)) domains.add('design / manufacturing')

  if (domains.size === 0) domains.add('technical systems foundation')
  return [...domains].sort()
}

function buildCoverage(curriculum, referencePayload) {
  const lessonPlans = Array.isArray(curriculum?.lessonPlans) ? curriculum.lessonPlans : []
  const sources = Array.isArray(referencePayload?.data) ? referencePayload.data : []
  const mappings = Array.isArray(referencePayload?.mappings) ? referencePayload.mappings : []

  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const mappingsByLesson = new Map()

  for (const mapping of mappings) {
    if (!sourceById.has(mapping.reference_id)) continue
    const list = mappingsByLesson.get(mapping.lesson_plan_id) || []
    list.push(mapping)
    mappingsByLesson.set(mapping.lesson_plan_id, list)
  }

  const rows = lessonPlans.map((lesson) => {
    const lessonMappings = mappingsByLesson.get(lesson.id) || []
    const references = lessonMappings.map((mapping) => {
      const source = sourceById.get(mapping.reference_id)
      return {
        referenceId: mapping.reference_id,
        title: source?.title || mapping.reference_id,
        subjectArea: source?.subjectArea || null,
        role: mapping.role,
        aiRagIngestionAllowed: source?.rights?.aiRagIngestionAllowed === true,
        commercialUseAllowed: source?.rights?.commercialUseAllowed === true
      }
    })

    return {
      lessonPlanId: lesson.id,
      lessonTitle: lesson.title,
      academicLevel: lesson.academicLevel,
      courseId: lesson.courseId,
      status: lesson.status,
      covered: references.length > 0,
      referenceCount: references.length,
      subjectAreas: [...new Set(references.map((item) => item.subjectArea).filter(Boolean))].sort(),
      roles: [...new Set(references.map((item) => item.role).filter(Boolean))].sort(),
      references,
      suggestedReferenceDomains: references.length === 0 ? suggestedDomains(lesson) : []
    }
  })

  const byLevel = {}
  for (const row of rows) {
    const key = row.academicLevel || 'unknown'
    if (!byLevel[key]) byLevel[key] = { total: 0, covered: 0, uncovered: 0, coveragePercent: 0 }
    byLevel[key].total += 1
    if (row.covered) byLevel[key].covered += 1
    else byLevel[key].uncovered += 1
  }
  for (const summary of Object.values(byLevel)) {
    summary.coveragePercent = percent(summary.covered, summary.total)
  }

  const covered = rows.filter((row) => row.covered).length
  const subjectAreaCounts = {}
  const roleCounts = {}
  const uncoveredDomainCounts = {}
  for (const row of rows) {
    for (const subject of row.subjectAreas) subjectAreaCounts[subject] = (subjectAreaCounts[subject] || 0) + 1
    for (const role of row.roles) roleCounts[role] = (roleCounts[role] || 0) + 1
    if (!row.covered) {
      for (const domain of row.suggestedReferenceDomains) {
        uncoveredDomainCounts[domain] = (uncoveredDomainCounts[domain] || 0) + 1
      }
    }
  }

  return {
    summary: {
      totalLessons: rows.length,
      coveredLessons: covered,
      uncoveredLessons: rows.length - covered,
      coveragePercent: percent(covered, rows.length),
      byAcademicLevel: byLevel,
      subjectAreaLessonCounts: subjectAreaCounts,
      roleLessonCounts: roleCounts,
      uncoveredDomainCounts
    },
    lessons: rows
  }
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function renderMarkdown(report) {
  const lines = []
  const summary = report.summary
  lines.push('# Curriculum Reference Coverage Audit')
  lines.push('')
  lines.push('Regenerate with: `npm run audit:curriculum-references`.')
  lines.push('')
  lines.push(`Overall coverage: **${summary.coveredLessons}/${summary.totalLessons} lessons (${summary.coveragePercent}%)**.`)
  lines.push('')
  lines.push('| Academic level | Lessons | Covered | Uncovered | Coverage |')
  lines.push('| --- | ---: | ---: | ---: | ---: |')
  for (const [level, stats] of Object.entries(summary.byAcademicLevel).sort()) {
    lines.push(`| ${escapeCell(level)} | ${stats.total} | ${stats.covered} | ${stats.uncovered} | ${stats.coveragePercent}% |`)
  }

  lines.push('')
  lines.push('## Uncovered-domain audit hints')
  lines.push('')
  lines.push('| Suggested domain | Uncovered lessons |')
  lines.push('| --- | ---: |')
  for (const [domain, count] of Object.entries(summary.uncoveredDomainCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    lines.push(`| ${escapeCell(domain)} | ${count} |`)
  }

  lines.push('')
  lines.push('## Lesson coverage')
  lines.push('')
  lines.push('| Level | Course | Lesson | Status | Refs | Subject areas / roles | Gap domains when uncovered |')
  lines.push('| --- | --- | --- | --- | ---: | --- | --- |')
  for (const row of report.lessons) {
    const mapped = [
      ...row.subjectAreas,
      ...row.roles.map((role) => `role:${role}`)
    ].join(', ')
    lines.push(
      `| ${escapeCell(row.academicLevel)} | ${escapeCell(row.courseId)} | ${escapeCell(row.lessonPlanId)} - ${escapeCell(row.lessonTitle)} | ${escapeCell(row.status)} | ${row.referenceCount} | ${escapeCell(mapped || 'none')} | ${escapeCell(row.suggestedReferenceDomains.join(', ') || 'none')} |`
    )
  }
  lines.push('')
  lines.push('> Suggested gap domains are deterministic audit hints only; they do not authorize or select a source.')
  lines.push('')
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
    console.error(`[FAIL] Curriculum reference coverage audit: ${error.message}`)
    process.exit(1)
  }

  if (args.help) {
    console.log('Usage: node scripts/curriculum-reference-coverage-report.js [--base-url URL] [--json FILE] [--markdown FILE] [--fail-below PERCENT]')
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
    console.error(`[FAIL] Curriculum reference coverage audit: ${error.message}`)
    process.exit(1)
  }

  const report = buildCoverage(curriculum, references)

  if (args.jsonPath) {
    fs.mkdirSync(path.dirname(args.jsonPath), { recursive: true })
    fs.writeFileSync(args.jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
  if (args.markdownPath) {
    fs.mkdirSync(path.dirname(args.markdownPath), { recursive: true })
    fs.writeFileSync(args.markdownPath, renderMarkdown(report), 'utf8')
  }

  const s = report.summary
  console.log(
    `[PASS] Curriculum reference coverage: ${s.coveredLessons}/${s.totalLessons} lessons (${s.coveragePercent}%), ${s.uncoveredLessons} uncovered`
  )
  for (const [level, stats] of Object.entries(s.byAcademicLevel).sort()) {
    console.log(`  - ${level}: ${stats.covered}/${stats.total} (${stats.coveragePercent}%), ${stats.uncovered} uncovered`)
  }

  if (args.failBelow != null && s.coveragePercent < args.failBelow) {
    console.error(`[FAIL] Coverage ${s.coveragePercent}% is below required threshold ${args.failBelow}%`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  buildCoverage,
  parseArgs,
  renderMarkdown,
  suggestedDomains
}

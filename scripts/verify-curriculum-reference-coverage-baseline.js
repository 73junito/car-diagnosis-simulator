'use strict'

const { buildCoverage } = require('./curriculum-reference-coverage-report.js')

const EXPECTED = {
  total: 64,
  undergraduate: 43,
  graduate: 21
}

function verifyCoverage(curriculum, references) {
  const report = buildCoverage(curriculum, references)
  const errors = []
  const summary = report.summary
  const ug = summary.byAcademicLevel?.undergraduate
  const grad = summary.byAcademicLevel?.graduate

  if (summary.totalLessons !== EXPECTED.total) {
    errors.push(`expected ${EXPECTED.total} lessons, found ${summary.totalLessons}`)
  }
  if (!ug || ug.total !== EXPECTED.undergraduate) {
    errors.push(`expected ${EXPECTED.undergraduate} undergraduate lessons, found ${ug?.total ?? 0}`)
  }
  if (!grad || grad.total !== EXPECTED.graduate) {
    errors.push(`expected ${EXPECTED.graduate} graduate lessons, found ${grad?.total ?? 0}`)
  }
  if (summary.coveredLessons !== EXPECTED.total || summary.uncoveredLessons !== 0) {
    errors.push(`expected 64/64 covered, found ${summary.coveredLessons}/${summary.totalLessons}`)
  }
  if (ug && (ug.covered !== EXPECTED.undergraduate || ug.uncovered !== 0)) {
    errors.push(`expected undergraduate 43/43 covered, found ${ug.covered}/${ug.total}`)
  }
  if (grad && (grad.covered !== EXPECTED.graduate || grad.uncovered !== 0)) {
    errors.push(`expected graduate 21/21 covered, found ${grad.covered}/${grad.total}`)
  }

  return { ok: errors.length === 0, report, errors }
}

async function loadJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

async function main() {
  const baseUrl = (process.argv[2] || 'https://app.autolearnpro.com').replace(/\/$/, '')
  try {
    const [curriculum, references] = await Promise.all([
      loadJson(`${baseUrl}/api/curriculum`),
      loadJson(`${baseUrl}/api/curriculum/references`)
    ])
    const result = verifyCoverage(curriculum, references)
    if (!result.ok) {
      console.error('[FAIL] Curriculum reference coverage release gate')
      for (const error of result.errors) console.error('  - ' + error)
      process.exit(1)
    }
    console.log('[PASS] Curriculum reference coverage release gate: 64/64; undergraduate 43/43; graduate 21/21')
  } catch (error) {
    console.error('[FAIL] Curriculum reference coverage release gate: ' + error.message)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = { EXPECTED, verifyCoverage }

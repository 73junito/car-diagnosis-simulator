'use strict'

const {
  buildQualityReport,
  loadFreshnessReviews
} = require('./curriculum-reference-quality-report.js')

const BASE_URL = process.env.CURRICULUM_BASE_URL || 'https://app.autolearnpro.com'

async function loadJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

async function verify() {
  const errors = []
  const baseUrl = BASE_URL.replace(/\/$/, '')

  const [curriculum, references] = await Promise.all([
    loadJson(`${baseUrl}/api/curriculum`),
    loadJson(`${baseUrl}/api/curriculum/references`)
  ])

  const freshnessReviews = loadFreshnessReviews()
  const report = buildQualityReport(curriculum, references, { freshnessReviews })
  const s = report.summary

  const expected = {
    totalLessons: 64,
    strongLessons: 64,
    solidLessons: 0,
    reviewLessons: 0,
    lessonsWithDirectDomainAuthority: 64,
    lessonsWithoutDirectDomainAuthority: 0,
    technicalSourceAgeUnresolvedCount: 0
  }

  for (const [key, value] of Object.entries(expected)) {
    if (s[key] !== value) {
      errors.push(`${key} expected ${value} but received ${s[key]}`)
    }
  }

  if (s.technicalSourceAgeReviewCount !== s.technicalSourceAgeReviewedCount) {
    errors.push(
      `technical source age reviews not fully resolved: ${s.technicalSourceAgeReviewedCount}/${s.technicalSourceAgeReviewCount}`
    )
  }

  return { ok: errors.length === 0, errors, summary: s }
}

async function main() {
  try {
    const result = await verify()
    if (!result.ok) {
      console.error('[FAIL] Phase 7C curriculum reference quality baseline')
      for (const error of result.errors) console.error('  - ' + error)
      process.exit(1)
    }

    const s = result.summary
    console.log(
      `[PASS] Phase 7C curriculum reference quality baseline: ${s.strongLessons}/${s.totalLessons} strong; ` +
      `0 review; direct-domain authority ${s.lessonsWithDirectDomainAuthority}/${s.totalLessons}; ` +
      `age review ${s.technicalSourceAgeReviewedCount}/${s.technicalSourceAgeReviewCount} resolved`
    )
  } catch (error) {
    console.error('[FAIL] Phase 7C curriculum reference quality baseline: ' + error.message)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = { BASE_URL, verify }

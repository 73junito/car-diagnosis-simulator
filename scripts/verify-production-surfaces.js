'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const SURFACES = {
  public: 'https://autolearnpro.com',
  app: 'https://app.autolearnpro.com',
  exam: 'https://exam.autolearnpro.com'
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { Accept: options.accept || 'text/html,application/json;q=0.9,*/*;q=0.8' }
  })
  const text = await response.text()
  return { response, text }
}

function containsAny(text, needles) {
  return needles.some((needle) => text.toLowerCase().includes(needle.toLowerCase()))
}

function committedLessonPlanIds() {
  const payload = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'curriculum', 'lesson-plans.json'), 'utf8')
  )
  const lessonPlans = Array.isArray(payload) ? payload : (payload.lessonPlans || [])
  const ids = lessonPlans.map((lesson) => lesson.id)
  if (ids.some((id) => !id)) throw new Error('Committed curriculum contains a lesson plan without an id')
  if (new Set(ids).size !== ids.length) throw new Error('Committed curriculum contains duplicate lesson-plan ids')
  return ids.sort()
}

async function auditProductionSurfaces(fetcher = fetchText) {
  const failures = []
  const observations = []

  for (const [name, base] of Object.entries(SURFACES)) {
    try {
      const { response, text } = await fetcher(base + '/')
      observations.push({ surface: name, url: base + '/', status: response.status })
      if (!response.ok) failures.push(`${name} home returned HTTP ${response.status}`)

      if (name === 'public' && !containsAny(text, ['AutoLearnPro'])) {
        failures.push('public home does not identify AutoLearnPro')
      }
      if (name === 'app' && !containsAny(text, ['AutoLearnPro', 'TorqueMind'])) {
        failures.push('app home does not identify the product')
      }
      if (name === 'exam') {
        if (!containsAny(text, ['exam launch pending', 'prelaunch', 'launch pending'])) {
          failures.push('exam home no longer exposes an explicit prelaunch/pending status')
        }
      }
    } catch (error) {
      failures.push(`${name} home request failed: ${error.message}`)
    }
  }

  for (const [name, url] of [
    ['public-health', SURFACES.public + '/api/health'],
    ['app-health', SURFACES.app + '/api/health']
  ]) {
    try {
      const { response, text } = await fetcher(url, { accept: 'application/json' })
      observations.push({ surface: name, url, status: response.status })
      if (!response.ok) failures.push(`${name} returned HTTP ${response.status}`)
      if (!containsAny(text, ['ok', 'healthy', 'health'])) {
        failures.push(`${name} response does not look like a health response`)
      }
    } catch (error) {
      failures.push(`${name} request failed: ${error.message}`)
    }
  }

  for (const [name, url, requiredText] of [
    ['reference-library', SURFACES.app + '/reference-library/', 'Reference Library'],
    ['student-coach', SURFACES.app + '/dashboard/student/coach/', 'Diagnostic Coach'],
    ['student-copilot', SURFACES.app + '/dashboard/student/copilot/', 'Automotive Diagnostic Copilot'],
    ['public-help', SURFACES.public + '/help/', "platform's public explanation"],
    ['public-privacy', SURFACES.public + '/privacy', '30 calendar days'],
    ['public-research', SURFACES.public + '/research-sources/', 'How research becomes governed evidence']
  ]) {
    try {
      const { response, text } = await fetcher(url)
      observations.push({ surface: name, url, status: response.status })
      if (!response.ok) failures.push(`${name} returned HTTP ${response.status}`)
      if (!containsAny(text, [requiredText])) {
        failures.push(`${name} is missing expected production content: ${requiredText}`)
      }
    } catch (error) {
      failures.push(`${name} request failed: ${error.message}`)
    }
  }

  try {
    const url = SURFACES.app + '/api/curriculum'
    const { response, text } = await fetcher(url, { accept: 'application/json' })
    observations.push({ surface: 'curriculum-api', url, status: response.status })
    if (!response.ok) failures.push(`curriculum API returned HTTP ${response.status}`)
    else {
      const payload = JSON.parse(text)
      const lessonPlans = Array.isArray(payload.lessonPlans) ? payload.lessonPlans : []
      const expectedIds = committedLessonPlanIds()
      const liveIds = lessonPlans.map((lesson) => lesson.id).filter(Boolean).sort()
      if (liveIds.length !== lessonPlans.length) {
        failures.push('curriculum API contains a lesson plan without an id')
      }
      if (liveIds.length !== expectedIds.length) {
        failures.push(`curriculum API expected ${expectedIds.length} committed lesson plans, found ${liveIds.length}`)
      } else {
        const missing = expectedIds.filter((id) => !liveIds.includes(id))
        const extra = liveIds.filter((id) => !expectedIds.includes(id))
        if (missing.length || extra.length) {
          failures.push(
            `curriculum API lesson-plan identity drift: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`
          )
        }
      }
    }
  } catch (error) {
    failures.push(`curriculum API validation failed: ${error.message}`)
  }

  return {
    ok: failures.length === 0,
    surfaces: SURFACES,
    observations,
    failures
  }
}

async function main() {
  const result = await auditProductionSurfaces()
  if (!result.ok) {
    console.error('[FAIL] Production surface release smoke')
    for (const failure of result.failures) console.error('  - ' + failure)
    process.exit(1)
  }

  console.log('[PASS] Production surface release smoke: public, app, exam, health, hardened UI routes, curriculum API')
  for (const item of result.observations) {
    console.log(`  - ${item.surface}: HTTP ${item.status} ${item.url}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[FAIL] Production surface release smoke: ' + error.message)
    process.exit(1)
  })
}

module.exports = {
  SURFACES,
  auditProductionSurfaces,
  containsAny,
  committedLessonPlanIds
}

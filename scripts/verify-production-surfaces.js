'use strict'

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

  try {
    const url = SURFACES.app + '/api/curriculum'
    const { response, text } = await fetcher(url, { accept: 'application/json' })
    observations.push({ surface: 'curriculum-api', url, status: response.status })
    if (!response.ok) failures.push(`curriculum API returned HTTP ${response.status}`)
    else {
      const payload = JSON.parse(text)
      const lessonPlans = Array.isArray(payload.lessonPlans) ? payload.lessonPlans : []
      if (lessonPlans.length !== 64) {
        failures.push(`curriculum API expected 64 lesson plans, found ${lessonPlans.length}`)
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

  console.log('[PASS] Production surface release smoke: public, app, exam, health, curriculum API')
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
  containsAny
}

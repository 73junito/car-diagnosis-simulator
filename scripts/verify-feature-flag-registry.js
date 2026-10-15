const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''))
}

function fail(message) {
  throw new Error(message)
}

function expectedBool(value) {
  return value ? 'true' : 'false'
}

function verifyFeatureFlagRegistry() {
  const registry = readJson('data/architecture/feature-flag-registry.json')
  const wrangler = readJson('wrangler.app.jsonc')

  if (registry.status !== 'active') fail('Feature flag registry must remain active.')

  const envs = {
    production: wrangler.vars || {},
    staging: wrangler.env?.staging?.vars || {},
    preview: wrangler.previews?.vars || {}
  }

  const operationalIds = new Set()
  for (const flag of registry.operationalFlags || []) {
    if (operationalIds.has(flag.id)) fail(`Duplicate operational feature flag: ${flag.id}`)
    operationalIds.add(flag.id)

    for (const [environment, expected] of Object.entries(flag.environments || {})) {
      const actual = envs[environment]?.[flag.envVar]
      if (actual !== expectedBool(expected)) {
        fail(
          `${flag.id}: ${environment} ${flag.envVar} drift; expected ${expectedBool(expected)}, found ${actual || 'missing'}`
        )
      }

      if (flag.killSwitchEnvVar) {
        const killSwitch = envs[environment]?.[flag.killSwitchEnvVar]
        if (killSwitch !== 'false') {
          fail(`${flag.id}: ${environment} kill switch must default false in checked-in config.`)
        }
      }
    }
  }

  const protectedIds = new Set()
  for (const flag of registry.protectedFlags || []) {
    if (protectedIds.has(flag.id)) fail(`Duplicate protected feature flag: ${flag.id}`)
    protectedIds.add(flag.id)

    if (flag.enabled !== false) fail(`${flag.id}: protected flag must remain disabled.`)
    if (flag.environmentActivationAllowed !== false) {
      fail(`${flag.id}: environment activation must remain prohibited.`)
    }
    if (flag.authority !== 'external-human-governance-only') {
      fail(`${flag.id}: protected flag authority drift.`)
    }
  }

  const baseline = readJson('data/release/production-release-baseline-2026-10-09.json')
  const governance = baseline.assessment_governance || {}
  const requiredFalse = [
    'assessment_eligibility_change',
    'scored_enabled',
    'institutional_assessment_enabled',
    'high_stakes_enabled',
    'production_assessment_release',
    'question_display_unlock'
  ]
  for (const key of requiredFalse) {
    if (governance[key] !== false) {
      fail(`Release baseline governance flag must remain false: ${key}`)
    }
  }

  return {
    operationalCount: operationalIds.size,
    protectedCount: protectedIds.size,
    operationalIds: [...operationalIds],
    protectedIds: [...protectedIds]
  }
}

if (require.main === module) {
  const result = verifyFeatureFlagRegistry()
  console.log(
    `Feature flag registry: PASS (${result.operationalCount} operational; ${result.protectedCount} governance-locked)`
  )
}

module.exports = { verifyFeatureFlagRegistry }

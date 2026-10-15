'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function fail(message) {
  throw new Error(message)
}

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return null
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) fail(`Invalid semantic version comparison: ${left} vs ${right}`)
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1
    if (a[i] < b[i]) return -1
  }
  return 0
}

function verifyCaretRuntimeDependency({ name, declaredRange, lockedVersion, reviewedFloor, major }) {
  const match = String(declaredRange || '').trim().match(/^\^(\d+\.\d+\.\d+)$/)
  if (!match) fail(`${name} must remain a caret-ranged production dependency`)

  const declaredFloor = match[1]
  const parsedDeclared = parseVersion(declaredFloor)
  const parsedLocked = parseVersion(lockedVersion)

  if (!parsedDeclared || parsedDeclared[0] !== major) {
    fail(`${name} declared range must remain on major ${major}`)
  }
  if (!parsedLocked || parsedLocked[0] !== major) {
    fail(`${name} lock version must remain on major ${major}`)
  }
  if (compareVersions(declaredFloor, reviewedFloor) < 0) {
    fail(`${name} declared floor must not regress below reviewed ${reviewedFloor}`)
  }
  if (compareVersions(lockedVersion, reviewedFloor) < 0) {
    fail(`${name} lock version must not regress below reviewed ${reviewedFloor}`)
  }
  if (compareVersions(lockedVersion, declaredFloor) < 0) {
    fail(`${name} lock version must satisfy its declared floor ${declaredFloor}`)
  }
}

function verify() {
  const pkg = readJson('package.json')
  const lock = readJson('package-lock.json')
  const legacy = readJson('torquemind-api/package.json')
  const legacyLock = readJson('torquemind-api/package-lock.json')
  const nvmrc = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()

  if (pkg.engines?.node !== '>=22.19.0 <25') fail('Root Node engine must remain >=22.19.0 <25')
  if (nvmrc !== '22.19.0') fail('.nvmrc must pin the reviewed Node 22.19.0 baseline')
  if (pkg.scripts?.minimist) fail('minimist must not appear as an npm script')

  const supabaseRange = pkg.dependencies?.['@supabase/supabase-js']
  if (pkg.devDependencies?.['@supabase/supabase-js']) fail('Supabase JS must not remain dev-only')

  const rootSupabase = lock.packages?.['node_modules/@supabase/supabase-js']
  if (!rootSupabase) fail('Root Supabase lock record is required')
  if (rootSupabase.dev === true) fail('Root Supabase lock record must be production-reachable')
  verifyCaretRuntimeDependency({
    name: 'Supabase JS',
    declaredRange: supabaseRange,
    lockedVersion: rootSupabase.version,
    reviewedFloor: '2.117.2',
    major: 2
  })

  const honoRange = pkg.dependencies?.hono
  const rootHono = lock.packages?.['node_modules/hono']
  if (!rootHono) fail('Root Hono lock record is required')
  if (rootHono.dev === true) fail('Root Hono lock record must be production-reachable')
  verifyCaretRuntimeDependency({
    name: 'Hono',
    declaredRange: honoRange,
    lockedVersion: rootHono.version,
    reviewedFloor: '4.13.13',
    major: 4
  })

  const zenumlCore = lock.packages?.['node_modules/@mermaid-js/mermaid-zenuml/node_modules/@zenuml/core']
  const zenumlPlaywrightPeer = zenumlCore?.peerDependencies?.['playwright-core']
  if (!zenumlPlaywrightPeer) fail('ZenUML Playwright peer requirement is missing from lockfile metadata')

  const playwrightCoreShim = pkg.devDependencies?.['playwright-core']
  if (playwrightCoreShim !== zenumlPlaywrightPeer) {
    fail(`playwright-core compatibility shim must exactly match ZenUML peer ${zenumlPlaywrightPeer}`)
  }

  const rootPlaywrightCore = lock.packages?.['node_modules/playwright-core']
  if (!rootPlaywrightCore || rootPlaywrightCore.version !== zenumlPlaywrightPeer) {
    fail(`Root playwright-core lock record must satisfy ZenUML peer ${zenumlPlaywrightPeer}`)
  }

  const primaryPlaywright = lock.packages?.['node_modules/playwright']
  const primaryPlaywrightCoreVersion = primaryPlaywright?.dependencies?.['playwright-core']
  if (!primaryPlaywright || !primaryPlaywrightCoreVersion) {
    fail('Primary Playwright lock record and playwright-core dependency are required')
  }

  if (primaryPlaywrightCoreVersion !== zenumlPlaywrightPeer) {
    const nestedPrimaryCore = lock.packages?.['node_modules/playwright/node_modules/playwright-core']
    if (!nestedPrimaryCore || nestedPrimaryCore.version !== primaryPlaywrightCoreVersion) {
      fail(
        `Primary Playwright ${primaryPlaywright.version} must retain nested playwright-core ${primaryPlaywrightCoreVersion} while ZenUML uses ${zenumlPlaywrightPeer}`
      )
    }
  }

  if (legacy.engines?.node !== '>=22.19.0') fail('Legacy API Node engine must align to >=22.19.0')
  if (legacy.dependencies?.['@supabase/supabase-js'] !== '2.105.1') {
    fail('Legacy API Supabase version must remain explicitly pinned to 2.105.1')
  }
  const legacySupabase = legacyLock.packages?.['node_modules/@supabase/supabase-js']
  if (!legacySupabase || legacySupabase.version !== '2.105.1') fail('Legacy Supabase lock version must match 2.105.1')

  const expectedOverrides = {
    'lodash-es': '4.18.1',
    katex: '0.18.9',
    sharp: '0.35.5'
  }
  for (const [name, version] of Object.entries(expectedOverrides)) {
    if (pkg.overrides?.[name] !== version) fail(`Override ${name} must remain documented at ${version}`)
  }

  const policyPath = path.join(root, 'docs', 'dependency-runtime-policy.md')
  if (!fs.existsSync(policyPath)) fail('Dependency runtime policy documentation is required')

  return {
    nodeBaseline: nvmrc,
    rootSupabase: rootSupabase.version,
    legacySupabase: legacySupabase.version,
    zenumlPlaywrightPeer,
    playwrightCoreShim,
    primaryPlaywright: primaryPlaywright.version,
    primaryPlaywrightCore: primaryPlaywrightCoreVersion,
    overrides: expectedOverrides
  }
}

if (require.main === module) {
  try {
    process.stdout.write(JSON.stringify(verify()) + '\n')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

module.exports = {
  compareVersions,
  parseVersion,
  verify,
  verifyCaretRuntimeDependency
}

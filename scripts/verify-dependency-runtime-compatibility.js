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

function verify() {
  const pkg = readJson('package.json')
  const lock = readJson('package-lock.json')
  const legacy = readJson('torquemind-api/package.json')
  const legacyLock = readJson('torquemind-api/package-lock.json')
  const nvmrc = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()

  if (pkg.engines?.node !== '>=22.19.0') fail('Root Node engine must remain >=22.19.0')
  if (nvmrc !== '22.19.0') fail('.nvmrc must pin the reviewed Node 22.19.0 baseline')
  if (pkg.scripts?.minimist) fail('minimist must not appear as an npm script')

  const supabaseRange = pkg.dependencies?.['@supabase/supabase-js']
  if (supabaseRange !== '^2.117.2') fail('Supabase JS must be a root production dependency at ^2.117.2')
  if (pkg.devDependencies?.['@supabase/supabase-js']) fail('Supabase JS must not remain dev-only')

  const rootSupabase = lock.packages?.['node_modules/@supabase/supabase-js']
  if (!rootSupabase || rootSupabase.version !== '2.117.2') fail('Root Supabase lock version must be 2.117.2')
  if (rootSupabase.dev === true) fail('Root Supabase lock record must be production-reachable')

  if (pkg.dependencies?.hono !== '^4.13.13') fail('Hono runtime dependency drifted unexpectedly')

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

module.exports = { verify }

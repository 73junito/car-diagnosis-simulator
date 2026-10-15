const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DEPENDABOT_PATH = path.join(ROOT, '.github', 'dependabot.yml')
const POLICY_PATH = path.join(ROOT, 'data', 'architecture', 'dependency-automation-policy.json')

function fail(message) {
  throw new Error(message)
}

function count(text, pattern) {
  return (text.match(pattern) || []).length
}

function verifyDependencyAutomation() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'))
  const config = fs.readFileSync(DEPENDABOT_PATH, 'utf8')

  if (policy.provider !== 'dependabot' || policy.status !== 'controlled') {
    fail('Dependency automation provider/status drift.')
  }
  if (policy.autoMergeAllowed !== false) {
    fail('Dependency automation may not enable auto-merge.')
  }

  if (count(config, /package-ecosystem:\s*"npm"/g) !== 1) {
    fail('Dependabot must define exactly one root npm update block.')
  }
  if (count(config, /package-ecosystem:\s*"github-actions"/g) !== 1) {
    fail('Dependabot must define exactly one GitHub Actions update block.')
  }
  if (count(config, /interval:\s*weekly/g) !== 2) {
    fail('Both Dependabot ecosystems must remain on weekly cadence.')
  }

  const expectedLimits = [
    policy.versionUpdates.npm.openPullRequestLimit,
    policy.versionUpdates.githubActions.openPullRequestLimit
  ]
  for (const limit of expectedLimits) {
    if (!config.includes(`open-pull-requests-limit: ${limit}`)) {
      fail(`Dependabot open PR limit missing: ${limit}`)
    }
  }

  const expectedGroups = [
    ...policy.versionUpdates.npm.groups,
    ...policy.versionUpdates.githubActions.groups
  ]
  for (const group of expectedGroups) {
    if (!new RegExp(`^\\s{6}${group}:\\s*$`, 'm').test(config)) {
      fail(`Dependabot group missing: ${group}`)
    }
  }

  if (count(config, /dependency-name:\s*"\*"/g) !== 2) {
    fail('Both ecosystems must explicitly exclude wildcard major version updates.')
  }
  if (count(config, /version-update:semver-major/g) !== 2) {
    fail('Both ecosystems must keep routine major updates disabled.')
  }

  const playwrightCoreIgnore = config.match(
    /dependency-name:\s*"playwright-core"[\s\S]{0,220}?version-update:semver-minor[\s\S]{0,120}?version-update:semver-patch/
  )
  if (!playwrightCoreIgnore) {
    fail('Dependabot must not independently update the ZenUML playwright-core compatibility shim.')
  }

  if (!config.includes('dependency-type: "production"')) {
    fail('Production runtime dependency grouping is missing.')
  }
  if (!config.includes('- "hono"') || !config.includes('- "@supabase/supabase-js"')) {
    fail('Runtime-core group must contain Hono and Supabase JS.')
  }
  if (!config.includes('- "wrangler"') || !config.includes('- "@cloudflare/workers-types"')) {
    fail('Cloudflare toolchain group is incomplete.')
  }

  const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
  if (!ci.includes('npm run validate:dependency-runtime-compatibility')) {
    fail('CI dependency runtime compatibility gate is missing.')
  }
  if (!ci.includes('npm run validate:dependency-security-exceptions')) {
    fail('CI dependency security exception gate is missing.')
  }
  if (!ci.includes('npm run validate:dependency-automation')) {
    fail('CI dependency automation policy gate is missing.')
  }
  if (!ci.includes('npm run audit:production-dependencies')) {
    fail('CI production dependency audit gate is missing.')
  }

  return {
    provider: policy.provider,
    npmOpenPullRequestLimit: policy.versionUpdates.npm.openPullRequestLimit,
    actionsOpenPullRequestLimit: policy.versionUpdates.githubActions.openPullRequestLimit,
    groups: expectedGroups,
    autoMergeAllowed: policy.autoMergeAllowed
  }
}

if (require.main === module) {
  const result = verifyDependencyAutomation()
  console.log(
    `Dependency automation: PASS (provider=${result.provider}; groups=${result.groups.length}; npm PR limit=${result.npmOpenPullRequestLimit}; actions PR limit=${result.actionsOpenPullRequestLimit}; auto-merge=${result.autoMergeAllowed})`
  )
}

module.exports = { verifyDependencyAutomation }

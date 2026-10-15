'use strict'

const fs = require('fs')
const path = require('path')
const { auditProductionSurfaces, SURFACES } = require('./verify-production-surfaces')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = path.join(ROOT, 'reports', 'production-runtime-synthetic.json')
const REQUEST_TIMEOUT_MS = 15000

function databaseMonitoringPolicy() {
  return JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'data', 'architecture', 'database-observability-policy.json'),
      'utf8'
    )
  )
}

function existingLabChecks() {
  const registry = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'lmf', 'lab-registry.json'), 'utf8')
  )

  return registry.labs
    .filter((lab) => lab.lifecycle === 'existing')
    .map((lab) => {
      const relative = lab.route.replace(/^\//, '')
      const localPath = path.join(ROOT, relative, 'index.html')
      if (!fs.existsSync(localPath)) throw new Error(`Missing local lab page for ${lab.labId}: ${relative}index.html`)
      const html = fs.readFileSync(localPath, 'utf8')
      const title = /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.trim()
      if (!title) throw new Error(`Missing local title marker for ${lab.labId}`)

      return {
        id: lab.labId,
        url: SURFACES.app + lab.route,
        expectedText: title
      }
    })
}

async function timedFetch(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = Date.now()
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { Accept: options.accept || 'text/html,application/json;q=0.9,*/*;q=0.8' },
      signal: controller.signal
    })
    const text = await response.text()
    return {
      response,
      text,
      durationMs: Date.now() - started
    }
  } finally {
    clearTimeout(timer)
  }
}

async function runSyntheticMonitor(fetcher = timedFetch, now = () => new Date()) {
  const startedAt = now().toISOString()
  const requestTimings = []

  const wrappedFetcher = async (url, options = {}) => {
    const result = await fetcher(url, options)
    requestTimings.push({
      url,
      status: result.response?.status || 0,
      duration_ms: Number(result.durationMs) || 0
    })
    return result
  }

  const core = await auditProductionSurfaces(wrappedFetcher)
  const checks = []
  const failures = [...core.failures]
  const databasePolicy = databaseMonitoringPolicy()
  const databaseUrl = SURFACES.app + databasePolicy.probe.route
  let databaseCheck = {
    url: databaseUrl,
    ok: false,
    status: 0,
    latency_ms: null,
    warning: false
  }

  try {
    const { response, text } = await wrappedFetcher(databaseUrl, { accept: 'application/json' })
    const payload = JSON.parse(text)
    const probeLatency = Number(payload?.database?.latencyMs)
    const validLatency = Number.isFinite(probeLatency) && probeLatency >= 0
    const ok = response.ok && payload?.database?.ok === true && validLatency
    const warning = ok && probeLatency >= databasePolicy.probe.warningLatencyMs
    const tooSlow = ok && probeLatency >= databasePolicy.probe.failureLatencyMs

    databaseCheck = {
      url: databaseUrl,
      ok: ok && !tooSlow,
      status: response.status,
      latency_ms: validLatency ? probeLatency : null,
      warning
    }

    if (!response.ok || payload?.database?.ok !== true) {
      failures.push(`database health probe returned HTTP ${response.status} or degraded state`)
    } else if (!validLatency) {
      failures.push('database health probe did not report a valid latency')
    } else if (tooSlow) {
      failures.push(
        `database health latency ${probeLatency}ms exceeded failure threshold ${databasePolicy.probe.failureLatencyMs}ms`
      )
    }
  } catch (error) {
    databaseCheck.error = error.message
    failures.push(`database health probe failed: ${error.message}`)
  }

  for (const lab of existingLabChecks()) {
    try {
      const { response, text, durationMs } = await wrappedFetcher(lab.url)
      const ok = response.ok && text.toLowerCase().includes(lab.expectedText.toLowerCase())
      checks.push({
        id: lab.id,
        url: lab.url,
        status: response.status,
        duration_ms: Number(durationMs) || 0,
        expected_text: lab.expectedText,
        ok
      })
      if (!response.ok) failures.push(`${lab.id} returned HTTP ${response.status}`)
      else if (!ok) failures.push(`${lab.id} is missing committed title marker: ${lab.expectedText}`)
    } catch (error) {
      checks.push({
        id: lab.id,
        url: lab.url,
        status: 0,
        duration_ms: 0,
        expected_text: lab.expectedText,
        ok: false,
        error: error.message
      })
      failures.push(`${lab.id} request failed: ${error.message}`)
    }
  }

  const report = {
    schema_version: '1.0.0',
    monitor: 'production-runtime-synthetic',
    started_at: startedAt,
    completed_at: now().toISOString(),
    github_sha: process.env.GITHUB_SHA || null,
    core_ok: core.ok,
    database_check: databaseCheck,
    lab_checks_total: checks.length,
    lab_checks_passed: checks.filter((item) => item.ok).length,
    request_timings: requestTimings,
    lab_checks: checks,
    failures,
    ok: failures.length === 0
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n')
  return report
}

async function main() {
  const report = await runSyntheticMonitor()
  console.log(
    `Production runtime synthetic monitor: ${report.ok ? 'PASS' : 'FAIL'}; labs ${report.lab_checks_passed}/${report.lab_checks_total}`
  )
  for (const timing of report.request_timings) {
    console.log(`  - HTTP ${timing.status} ${timing.duration_ms}ms ${timing.url}`)
  }
  for (const failure of report.failures) console.error(`  - ${failure}`)
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`)
  if (!report.ok) process.exit(1)
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[FAIL] Production runtime synthetic monitor: ' + error.message)
    process.exit(1)
  })
}

module.exports = {
  REPORT_PATH,
  REQUEST_TIMEOUT_MS,
  databaseMonitoringPolicy,
  existingLabChecks,
  runSyntheticMonitor
}

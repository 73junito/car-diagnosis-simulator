#!/usr/bin/env node
/**
 * R21 - JWT negative probes against the approved staging authentication boundary.
 *
 * Objective (per R21): show that the REAL staging boundary rejects tokens it should
 * reject. This does not implement a local JWT verifier; production delegates
 * verification to Supabase (api/_utils/auth-utils.js -> supabase.auth.getUser()).
 *
 * Safety properties, enforced here rather than in YAML:
 *   - destination allowlist: https + exact host, hard-coded below
 *   - read-only: only GET requests to a single read-only PostgREST path
 *   - no writes, no administrative credentials (anon key only, never service role)
 *   - rate/latency caps: <= MAX_REQUESTS total, sequential, per-request timeout
 *   - no secret or token material in output: status codes and labels only
 *   - fail closed: missing config or an unexpected 2xx exits non-zero
 *
 * Usage:
 *   STAGING_URL=https://<ref>.supabase.co STAGING_ANON=<anon key> \
 *     node tests/r21/jwt-negative-probes.mjs
 *   node tests/r21/jwt-negative-probes.mjs --self-test   # no network at all
 *
 * Exit codes: 0 all probes rejected · 1 a probe was accepted · 2 allowlist/config
 * refusal · 3 harness error.
 */

const ALLOWED_HOSTS = new Set(['jchfruprqpeypdttvlam.supabase.co'])
const READONLY_PATH = '/rest/v1/syllabi?select=id&limit=1'
const TOKEN_PATH = '/auth/v1/token?grant_type=password'
// 1 anonymous reachability GET + 1 password grant + 1 authenticated GET + 7 negative probes.
const MAX_REQUESTS = 10
const REQUEST_TIMEOUT_MS = 10_000
const SPACING_MS = 500

const b64url = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function token(header, payload, signature = '') {
  return `${b64url(header)}.${b64url(payload)}.${signature}`
}

const nowSec = () => Math.floor(Date.now() / 1000)

/**
 * Probe definitions. Every token is synthetic and unsigned (or signed with a random
 * key) - we do NOT hold the project's JWT secret and deliberately never will.
 */
function buildProbes() {
  const base = {
    iss: 'supabase',
    sub: '00000000-0000-4000-8000-000000000000',
    role: 'authenticated',
    aud: 'authenticated',
  }
  const forged = 'Zm9yZ2VkLXNpZ25hdHVyZQ'

  return [
    // Reachability control. With the publishable key and no bearer token PostgREST
    // answers 200 and RLS filters the rows, so this proves host+path are correct.
    // Without it, a wrong URL returning 404 would masquerade as a rejected token.
    { label: 'reachability control (anon key, no bearer)', auth: null, expect: 'reachable' },
    { label: 'malformed: two segments', auth: 'not.a-jwt', expect: 'rejected' },
    { label: 'malformed: not a token', auth: 'definitely-not-a-token', expect: 'rejected' },
    { label: 'malformed: empty bearer', auth: '', expect: 'rejected' },
    {
      label: 'alg=none with empty signature',
      auth: token({ alg: 'none', typ: 'JWT' }, { ...base, exp: nowSec() + 3600 }),
      expect: 'rejected',
    },
    {
      label: 'HS256 forged signature (random key)',
      auth: token({ alg: 'HS256', typ: 'JWT' }, { ...base, exp: nowSec() + 3600 }, forged),
      expect: 'rejected',
    },
    {
      label: 'past-exp token signed with a random key',
      auth: token({ alg: 'HS256', typ: 'JWT' }, { ...base, exp: nowSec() - 3600 }, forged),
      expect: 'rejected',
      caveat: 'invalid-JWT evidence only; expiry enforcement NOT demonstrated',
    },
    {
      label: 'foreign-audience token signed with a random key',
      auth: token({ alg: 'HS256', typ: 'JWT' }, { ...base, aud: 'other-audience', exp: nowSec() + 3600 }, forged),
      expect: 'rejected',
      caveat: 'invalid-JWT evidence only; audience enforcement NOT demonstrated',
    },
  ]
}

/** Refuse anything that is not the approved staging project over TLS. */
function assertTarget(rawUrl) {
  if (!rawUrl) throw new Error('STAGING_URL is not set')
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('STAGING_URL is not a valid URL')
  }
  if (parsed.protocol !== 'https:') throw new Error(`refusing non-TLS target (${parsed.protocol})`)
  if (parsed.port && parsed.port !== '443') throw new Error(`refusing non-default port (${parsed.port})`)
  if (!ALLOWED_HOSTS.has(parsed.hostname)) throw new Error(`refusing non-allowlisted host (${parsed.hostname})`)
  return `https://${parsed.hostname}${READONLY_PATH}`
}

async function probe(url, anonKey, p) {
  const headers = { apikey: anonKey, accept: 'application/json' }
  if (p.auth) headers.authorization = `Bearer ${p.auth}`

  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  // The body is never read or printed - only the status code is recorded.
  if (response.body) await response.body.cancel().catch(() => {})
  return response.status
}

/**
 * Obtain a genuine staging session for the positive control.
 *
 * The token is returned to the caller and is never printed or logged. This is the same
 * read-only password grant the staging smoke workflows perform; it creates a session
 * row in GoTrue (a write to the auth subsystem, not to application data).
 */
async function fetchStagingToken(origin, anonKey, email, password) {
  const response = await fetch(`${origin}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (response.status !== 200) {
    // Never read or echo an error body: it can contain account detail.
    if (response.body) await response.body.cancel().catch(() => {})
    return { status: response.status, token: null }
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const candidate = payload && typeof payload.access_token === 'string' ? payload.access_token : null
  // A JWT has three dot-separated segments; anything else is not a usable control.
  const token = candidate && candidate.split('.').length === 3 ? candidate : null
  return { status: response.status, token }
}

/**
 * Contemporaneous positive control: a legitimate staging JWT must be ACCEPTED.
 * Without it, a boundary that rejects everything would satisfy every negative probe.
 */
async function runPositiveControl(origin, anonKey, credentials) {
  const grant = await fetchStagingToken(origin, anonKey, credentials.email, credentials.password)
  if (!grant.token) {
    console.log(`FAIL  positive control: staging sign-in returned no token (HTTP ${grant.status})`)
    return { pass: false }
  }
  const status = await probe(`${origin}${READONLY_PATH}`, anonKey, { auth: grant.token })
  const pass = status === 200
  console.log(`${pass ? 'PASS' : 'FAIL'}  positive control: valid staging JWT is accepted by the endpoint  -> HTTP ${status}`)
  return { pass }
}

async function selfTest() {
  console.log('R21 self-test (no network):')
  const cases = [
    ['https://evil.example.com', 'refused'],
    ['http://jchfruprqpeypdttvlam.supabase.co', 'refused'],
    ['https://jchfruprqpeypdttvlam.supabase.co:8443', 'refused'],
    ['https://jchfruprqpeypdttvlam.supabase.co', 'allowed'],
  ]
  let ok = true
  for (const [url, expectation] of cases) {
    let outcome
    try {
      assertTarget(url)
      outcome = 'allowed'
    } catch {
      outcome = 'refused'
    }
    const pass = outcome === expectation
    ok = ok && pass
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${outcome.padEnd(8)} ${url}`)
  }
  const probes = buildProbes()
  const unique = new Set(probes.map((p) => (p.auth === null ? '<none>' : p.auth)))
  const countOk = probes.length <= MAX_REQUESTS
  const uniqOk = unique.size === probes.length
  const controlOk = probes[0]?.expect === 'reachable'
  const restRejected = probes.slice(1).every((p) => p.expect === 'rejected')
  // Budget must also cover the password grant and the authenticated positive-control GET.
  const budgetOk = MAX_REQUESTS >= probes.length + 2
  const caveatOk = probes.slice(-2).every((p) => typeof p.caveat === 'string')
  console.log(`  ${countOk ? 'PASS' : 'FAIL'}  probe count ${probes.length} <= ${MAX_REQUESTS}`)
  console.log(`  ${uniqOk ? 'PASS' : 'FAIL'}  ${probes.length} distinct probe credentials`)
  console.log(`  ${controlOk ? 'PASS' : 'FAIL'}  first probe is the reachability control`)
  console.log(`  ${restRejected ? 'PASS' : 'FAIL'}  remaining ${probes.length - 1} probes expect rejection`)
  console.log(`  ${budgetOk ? 'PASS' : 'FAIL'}  budget ${MAX_REQUESTS} covers probes + grant + positive-control GET`)
  console.log(`  ${caveatOk ? 'PASS' : 'FAIL'}  expiry/audience probes carry an explicit limitation caveat`)
  return ok && countOk && uniqOk && controlOk && restRejected && budgetOk && caveatOk
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const ok = await selfTest()
    process.exitCode = ok ? 0 : 2
    return
  }

  const anonKey = process.env.STAGING_ANON
  const credentials = {
    email: process.env.SMOKE_TEACHER_EMAIL,
    password: process.env.SMOKE_TEACHER_PASSWORD,
  }
  let url
  try {
    url = assertTarget(process.env.STAGING_URL)
    if (!anonKey) throw new Error('STAGING_ANON is not set')
    // Fail closed without a positive control: otherwise a boundary that rejects
    // everything would satisfy every negative probe below.
    if (!credentials.email || !credentials.password) {
      throw new Error('SMOKE_TEACHER_EMAIL / SMOKE_TEACHER_PASSWORD are required for the positive control')
    }
  } catch (error) {
    console.error(`REFUSING TO PROBE: ${error.message}`)
    process.exitCode = 2
    return
  }

  const origin = new URL(url).origin
  const probes = buildProbes().slice(0, MAX_REQUESTS)
  console.log(`target: ${new URL(url).host}${READONLY_PATH}`)
  console.log(`probes: ${probes.length} negatives + anon control (GET only, ${REQUEST_TIMEOUT_MS}ms timeout, ${SPACING_MS}ms spacing)\n`)

  // Phase 1: anonymous reachability (proves host/path, not authentication).
  // Phase 2: authenticated positive control (a legitimate staging JWT).
  // Phase 3: negative probes.
  const positive = await runPositiveControl(origin, anonKey, credentials)
  console.log(
    positive.pass
      ? '      (positive control satisfied: negatives below are meaningful)\n'
      : '      (positive control FAILED: negative results below cannot be interpreted)\n'
  )
  if (!positive.pass) {
    process.exitCode = 1
    return
  }

  const results = []
  for (const p of probes) {
    let status
    try {
      status = await probe(url, anonKey, p)
    } catch (error) {
      results.push({ label: p.label, status: `transport:${error.name || 'Error'}`, pass: false })
      console.log(`FAIL  ${p.label}  -> transport error`)
      if (p.expect === 'reachable') {
        console.error('ABORTING: staging endpoint unreachable; results would be meaningless.')
        process.exitCode = 2
        return
      }
      continue
    }

    if (p.expect === 'reachable') {
      const reachable = status === 200
      results.push({ label: p.label, status, pass: reachable })
      console.log(`${reachable ? 'PASS' : 'FAIL'}  ${p.label}  -> HTTP ${status}`)
      if (!reachable) {
        console.error('ABORTING: control probe did not return 200; a later 404 would be indistinguishable from a rejected token.')
        process.exitCode = 2
        return
      }
      await new Promise((resolve) => setTimeout(resolve, SPACING_MS))
      continue
    }

    // A rejection must be an authentication rejection. 404 means the path is wrong
    // (not evidence), and 2xx means the token was accepted (a finding).
    const pass = status === 400 || status === 401
    results.push({ label: p.label, status, pass })
    const note = status === 404 ? '  <- path not found: NOT evidence' : ''
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${p.label}  -> HTTP ${status}${note}`)
    await new Promise((resolve) => setTimeout(resolve, SPACING_MS))
  }

  const accepted = results.filter((r) => !r.pass)
  console.log(`\n${results.length - accepted.length}/${results.length} probes rejected as required`)
  if (accepted.length) {
    console.log('ACCEPTED (must be investigated):')
    for (const a of accepted) console.log(`  - ${a.label} -> ${a.status}`)
  }
  process.exitCode = accepted.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error('PROBE HARNESS ERROR:', error && error.message)
  process.exitCode = 3
})


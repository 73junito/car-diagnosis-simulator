'use strict'

const { EXPECTED_URLS } = require('./verify-public-indexability.js')

const TARGET = 'https://autolearnpro.com/'
const USER_AGENTS = [
  {
    name: 'Google-InspectionTool',
    value: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)'
  },
  {
    name: 'Googlebot smartphone',
    value: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  }
]

function canonicalFromHtml(html) {
  return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i)?.[1]
    || html.match(/<link\s+href=["']([^"']+)["']\s+rel=["']canonical["'][^>]*>/i)?.[1]
    || null
}

function robotsMetaFromHtml(html) {
  return html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i)?.[1]
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']robots["'][^>]*>/i)?.[1]
    || null
}

function hasNoindex(value) {
  return typeof value === 'string' && /(^|[,\s])noindex([,\s]|$)/i.test(value)
}

async function probe(url = TARGET, fetchImpl = fetch) {
  const results = []

  for (const agent of USER_AGENTS) {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': agent.value,
        Accept: 'text/html,application/xhtml+xml'
      }
    })

    const html = typeof response.text === 'function' ? await response.text() : ''
    const xRobotsTag = response.headers.get('x-robots-tag')
    const robotsMeta = robotsMetaFromHtml(html)
    const liveCanonical = canonicalFromHtml(html)
    const finalUrl = response.url || url
    const redirectDrift = finalUrl !== url
    const canonicalMismatch = liveCanonical !== url
    const noindex = hasNoindex(xRobotsTag) || hasNoindex(robotsMeta)

    results.push({
      crawler: agent.name,
      url,
      status: response.status,
      ok: response.ok && !redirectDrift && !canonicalMismatch && !noindex,
      httpOk: response.ok,
      finalUrl,
      redirectDrift,
      canonical: liveCanonical,
      canonicalMismatch,
      xRobotsTag,
      robotsMeta,
      noindex,
      cfRay: response.headers.get('cf-ray'),
      server: response.headers.get('server')
    })
  }

  return results
}

async function probeInventory(urls = EXPECTED_URLS, fetchImpl = fetch) {
  const results = []
  for (const url of urls) {
    results.push(...await probe(url, fetchImpl))
  }
  return results
}

async function main() {
  let results
  try {
    results = await probeInventory()
  } catch (error) {
    console.error('[FAIL] Google crawler access probe: ' + error.message)
    process.exit(1)
  }

  const failures = results.filter((item) => !item.ok)
  for (const item of results) {
    const details = []
    if (item.cfRay) details.push('CF-Ray ' + item.cfRay)
    if (item.redirectDrift) details.push('final=' + item.finalUrl)
    if (item.canonicalMismatch) details.push('canonical=' + (item.canonical || 'missing'))
    if (item.noindex) details.push('noindex')
    console.log(
      `${item.ok ? '[PASS]' : '[FAIL]'} ${item.crawler}: HTTP ${item.status} ${item.url}` +
      (details.length ? ` (${details.join('; ')})` : '')
    )
  }

  if (failures.length) {
    console.error(
      'One or more canonical public URLs are not safely crawlable/indexable. ' +
      'Inspect the URL-specific status, canonical, robots directives, and Cloudflare Security Events.'
    )
    process.exit(1)
  }

  console.log(
    `[PASS] Google crawler inventory: ${EXPECTED_URLS.length} canonical URLs x ${USER_AGENTS.length} crawler agents`
  )
}

if (require.main === module) {
  main()
}

module.exports = {
  TARGET,
  USER_AGENTS,
  canonicalFromHtml,
  robotsMetaFromHtml,
  hasNoindex,
  probe,
  probeInventory
}

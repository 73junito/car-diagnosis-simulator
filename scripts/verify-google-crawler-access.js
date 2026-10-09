'use strict'

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

    results.push({
      crawler: agent.name,
      status: response.status,
      ok: response.ok,
      cfRay: response.headers.get('cf-ray'),
      server: response.headers.get('server')
    })
  }

  return results
}

async function main() {
  let results
  try {
    results = await probe()
  } catch (error) {
    console.error('[FAIL] Google crawler access probe: ' + error.message)
    process.exit(1)
  }

  const failures = results.filter((item) => !item.ok)
  for (const item of results) {
    console.log(
      `${item.ok ? '[PASS]' : '[FAIL]'} ${item.crawler}: HTTP ${item.status}` +
      (item.cfRay ? ` (CF-Ray ${item.cfRay})` : '')
    )
  }

  if (failures.length) {
    console.error(
      'Google crawler traffic is not receiving a successful public response. ' +
      'Inspect Cloudflare Security Events before changing application routing.'
    )
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { TARGET, USER_AGENTS, probe }

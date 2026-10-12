const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

async function run() {
  const html = fs.readFileSync(path.resolve(__dirname, '../dashboard/instructor/live-session.html'), 'utf8')
  const scriptSrc = fs.readFileSync(path.resolve(__dirname, '../dashboard/instructor/live-session.js'), 'utf8')

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://app.autolearnpro.com/dashboard/instructor/live-session.html'
  })
  const { window } = dom

  window.getAccessToken = () => 'test-token'
  window.apiGet = async (path) => {
    if (path === '/api/classes') return { classes: [{ id: 'class-1', name: 'AUT 250' }] }
    throw new Error('unexpected apiGet: ' + path)
  }

  const fetchCalls = []
  window.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init })
    return {
      ok: true,
      status: 200,
      text: async () =>
        'retry: 3000\n\n' +
        'event: telemetry\n' +
        'data: {"created_at":"2026-10-12T07:00:00.000Z","event_type":"scenario_started","session_id":"session-1","payload":{"scenario_id":1}}\n\n'
    }
  }

  const scriptEl = window.document.createElement('script')
  scriptEl.textContent = scriptSrc
  window.document.body.appendChild(scriptEl)

  await new Promise((resolve) => setTimeout(resolve, 30))

  const classSelect = window.document.querySelector('#live-class')
  const status = window.document.querySelector('#conn-status')
  const list = window.document.querySelector('#event-list')
  const active = window.document.querySelector('#active-sessions')
  const reconnect = window.document.querySelector('#reconnect')
  const clear = window.document.querySelector('#clear-feed')

  if (classSelect.value !== 'class-1') throw new Error('single owned class was not selected')
  if (!fetchCalls.length) throw new Error('authenticated stream fetch was not started')
  if (!fetchCalls[0].url.includes('/api/telemetry/stream?')) throw new Error('stream route not requested')
  if (!fetchCalls[0].url.includes('classId=class-1')) throw new Error('classId missing from stream request')
  if (fetchCalls[0].init.headers.Authorization !== 'Bearer test-token') throw new Error('bearer token missing')
  if (!/Connected/i.test(status.textContent)) throw new Error('connected status not shown')
  if (list.children.length !== 1) throw new Error('SSE event was not rendered')
  if (active.textContent !== '1') throw new Error('active session count not updated')

  reconnect.click()
  await new Promise((resolve) => setTimeout(resolve, 20))
  if (fetchCalls.length < 2) throw new Error('reconnect did not issue a new stream request')
  if (!fetchCalls[1].url.includes('since=2026-10-12T07%3A00%3A00.000Z')) {
    throw new Error('reconnect cursor was not preserved')
  }

  clear.click()
  if (list.children.length !== 0) throw new Error('clear did not empty feed')
  if (active.textContent !== '0') throw new Error('clear did not reset active sessions')

  window.close()
}

module.exports = run

if (typeof describe === 'function' && typeof test === 'function') {
  describe('live session UI', () => {
    test('uses authenticated class-scoped SSE snapshots', async () => {
      await run()
    })
  })
} else if (require.main === module) {
  run().catch((err) => { console.error(err); process.exit(1) })
}

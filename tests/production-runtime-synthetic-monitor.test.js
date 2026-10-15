const { existingLabChecks, runSyntheticMonitor } = require('../scripts/monitor-production-runtime')

function response(status, text, durationMs = 10) {
  return {
    response: { ok: status >= 200 && status < 300, status },
    text,
    durationMs
  }
}

describe('production runtime synthetic monitor', () => {
  test('derives exactly the seven existing lab routes from governed registry', () => {
    const labs = existingLabChecks()
    expect(labs).toHaveLength(7)
    expect(labs.map((lab) => lab.id)).toEqual([
      'circuit-lab',
      'starting-system-lab',
      'relay-load-lab',
      'sensor-lab',
      'actuator-lab',
      'network-lab',
      'multivoltage-lab'
    ])
  })

  test('passes when core surfaces and all governed lab markers are healthy', async () => {
    const labs = existingLabChecks()
    const labByUrl = new Map(labs.map((lab) => [lab.url, lab]))
    const committed = require('../data/curriculum/lesson-plans.json').lessonPlans

    const fetcher = async (url) => {
      if (labByUrl.has(url)) {
        const lab = labByUrl.get(url)
        return response(200, `<title>${lab.expectedText}</title>`)
      }
      if (url === 'https://autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://app.autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://exam.autolearnpro.com/') return response(200, 'Exam launch pending')
      if (url.endsWith('/api/health')) return response(200, '{"status":"ok"}')
      if (url.endsWith('/api/curriculum')) return response(200, JSON.stringify({ lessonPlans: committed }))
      if (url.includes('/reference-library/')) return response(200, 'Reference Library')
      if (url.includes('/dashboard/student/coach/')) return response(200, 'Diagnostic Coach')
      if (url.includes('/dashboard/student/copilot/')) return response(200, 'Automotive Diagnostic Copilot')
      if (url.includes('/help/')) return response(200, "platform's public explanation")
      if (url.endsWith('/privacy')) return response(200, '30 calendar days')
      if (url.includes('/research-sources/')) return response(200, 'How research becomes governed evidence')
      throw new Error(`unexpected URL ${url}`)
    }

    const report = await runSyntheticMonitor(fetcher)
    expect(report.ok).toBe(true)
    expect(report.lab_checks_passed).toBe(7)
    expect(report.failures).toEqual([])
  })

  test('fails when one governed lab route serves the wrong content', async () => {
    const labs = existingLabChecks()
    const target = labs[0]
    const labByUrl = new Map(labs.map((lab) => [lab.url, lab]))
    const committed = require('../data/curriculum/lesson-plans.json').lessonPlans

    const fetcher = async (url) => {
      if (labByUrl.has(url)) {
        const lab = labByUrl.get(url)
        return response(200, url === target.url ? '<title>wrong page</title>' : `<title>${lab.expectedText}</title>`)
      }
      if (url === 'https://autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://app.autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://exam.autolearnpro.com/') return response(200, 'Prelaunch')
      if (url.endsWith('/api/health')) return response(200, '{"status":"healthy"}')
      if (url.endsWith('/api/curriculum')) return response(200, JSON.stringify({ lessonPlans: committed }))
      if (url.includes('/reference-library/')) return response(200, 'Reference Library')
      if (url.includes('/dashboard/student/coach/')) return response(200, 'Diagnostic Coach')
      if (url.includes('/dashboard/student/copilot/')) return response(200, 'Automotive Diagnostic Copilot')
      if (url.includes('/help/')) return response(200, "platform's public explanation")
      if (url.endsWith('/privacy')) return response(200, '30 calendar days')
      if (url.includes('/research-sources/')) return response(200, 'How research becomes governed evidence')
      throw new Error(`unexpected URL ${url}`)
    }

    const report = await runSyntheticMonitor(fetcher)
    expect(report.ok).toBe(false)
    expect(report.failures.join('\n')).toContain(target.id)
  })
})

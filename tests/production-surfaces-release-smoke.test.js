const { auditProductionSurfaces, containsAny, committedLessonPlanIds } = require('../scripts/verify-production-surfaces.js')

function response(status, body) {
  return {
    response: { ok: status >= 200 && status < 300, status },
    text: typeof body === 'string' ? body : JSON.stringify(body)
  }
}

function curriculumPayload() {
  return { lessonPlans: committedLessonPlanIds().map((id) => ({ id })) }
}

function hardenedRouteResponse(url) {
  const routes = new Map([
    ['https://app.autolearnpro.com/reference-library/', '<h1>Reference Library</h1>'],
    ['https://app.autolearnpro.com/dashboard/student/coach/', '<h1>Diagnostic Coach</h1>'],
    ['https://app.autolearnpro.com/dashboard/student/copilot/', '<h1>Automotive Diagnostic Copilot</h1>'],
    ['https://autolearnpro.com/help/', "<p>platform's public explanation</p>"],
    ['https://autolearnpro.com/privacy', '<p>30 calendar days</p>'],
    ['https://autolearnpro.com/research-sources/', '<h2>How research becomes governed evidence</h2>']
  ]);
  return routes.has(url) ? response(200, routes.get(url)) : null;
}

describe('production surface release smoke', () => {
  test('passes a healthy three-surface deployment', async () => {
    const fetcher = async (url) => {
      if (url === 'https://autolearnpro.com/') return response(200, '<title>AutoLearnPro</title>')
      if (url === 'https://app.autolearnpro.com/') return response(200, '<title>AutoLearnPro</title>')
      if (url === 'https://exam.autolearnpro.com/') return response(200, '<h1>Exam launch pending</h1>')
      const hardened = hardenedRouteResponse(url)
      if (hardened) return hardened
      if (url.endsWith('/api/health')) return response(200, { status: 'ok' })
      if (url.endsWith('/api/curriculum')) {
        return response(200, curriculumPayload())
      }
      throw new Error('unexpected URL ' + url)
    }

    const result = await auditProductionSurfaces(fetcher)
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
  })

  test('fails if exam surface stops declaring prelaunch status', async () => {
    const fetcher = async (url) => {
      if (url === 'https://autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://app.autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://exam.autolearnpro.com/') return response(200, 'Take your scored exam now')
      const hardened = hardenedRouteResponse(url)
      if (hardened) return hardened
      if (url.endsWith('/api/health')) return response(200, { status: 'ok' })
      if (url.endsWith('/api/curriculum')) {
        return response(200, curriculumPayload())
      }
      throw new Error('unexpected URL ' + url)
    }

    const result = await auditProductionSurfaces(fetcher)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('explicit prelaunch/pending status')
  })

  test('fails on curriculum denominator regression', async () => {
    const fetcher = async (url) => {
      if (url === 'https://autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://app.autolearnpro.com/') return response(200, 'AutoLearnPro')
      if (url === 'https://exam.autolearnpro.com/') return response(200, 'Prelaunch')
      const hardened = hardenedRouteResponse(url)
      if (hardened) return hardened
      if (url.endsWith('/api/health')) return response(200, { status: 'healthy' })
      if (url.endsWith('/api/curriculum')) return response(200, { lessonPlans: [] })
      throw new Error('unexpected URL ' + url)
    }

    const result = await auditProductionSurfaces(fetcher)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('committed lesson plans')
  })

  test('content matching is case insensitive', () => {
    expect(containsAny('AUTOLEARNPRO', ['AutoLearnPro'])).toBe(true)
  })
})

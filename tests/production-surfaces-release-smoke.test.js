const { auditProductionSurfaces, containsAny } = require('../scripts/verify-production-surfaces.js')

function response(status, body) {
  return {
    response: { ok: status >= 200 && status < 300, status },
    text: typeof body === 'string' ? body : JSON.stringify(body)
  }
}

describe('production surface release smoke', () => {
  test('passes a healthy three-surface deployment', async () => {
    const fetcher = async (url) => {
      if (url === 'https://autolearnpro.com/') return response(200, '<title>AutoLearnPro</title>')
      if (url === 'https://app.autolearnpro.com/') return response(200, '<title>AutoLearnPro</title>')
      if (url === 'https://exam.autolearnpro.com/') return response(200, '<h1>Exam launch pending</h1>')
      if (url.endsWith('/api/health')) return response(200, { status: 'ok' })
      if (url.endsWith('/api/curriculum')) {
        return response(200, { lessonPlans: Array.from({ length: 64 }, (_, i) => ({ id: String(i + 1) })) })
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
      if (url.endsWith('/api/health')) return response(200, { status: 'ok' })
      if (url.endsWith('/api/curriculum')) {
        return response(200, { lessonPlans: Array.from({ length: 64 }, (_, i) => ({ id: String(i + 1) })) })
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
      if (url.endsWith('/api/health')) return response(200, { status: 'healthy' })
      if (url.endsWith('/api/curriculum')) return response(200, { lessonPlans: [] })
      throw new Error('unexpected URL ' + url)
    }

    const result = await auditProductionSurfaces(fetcher)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('expected 64 lesson plans')
  })

  test('content matching is case insensitive', () => {
    expect(containsAny('AUTOLEARNPRO', ['AutoLearnPro'])).toBe(true)
  })
})

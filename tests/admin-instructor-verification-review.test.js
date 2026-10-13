jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('../api/_utils/auth-utils.js', () => ({
  extractBearerToken: jest.fn(),
  verifySupabaseToken: jest.fn()
}))

const { createClient } = require('@supabase/supabase-js')
const authUtils = require('../api/_utils/auth-utils.js')
const {
  handleAdminInstructorVerificationQueue,
  handleAdminInstructorVerificationDecision
} = require('../worker/routes/instructor-verification.js')

function query(result = { data: null, error: null }) {
  const q = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'in']) q[method] = jest.fn(() => q)
  q.update = jest.fn((payload) => { q.updatedPayload = payload; return q })
  q.maybeSingle = jest.fn().mockResolvedValue(result)
  q.then = (resolve) => Promise.resolve(result).then(resolve)
  return q
}

function context({ method = 'GET', body = {}, queryParams = {}, requestId = '' } = {}) {
  return {
    env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
    req: {
      method,
      header: jest.fn(() => 'Bearer token'),
      query: jest.fn((name) => queryParams[name]),
      param: jest.fn((name) => name === 'requestId' ? requestId : undefined),
      json: jest.fn().mockResolvedValue(body)
    },
    json: jest.fn((payload, status = 200) => ({ payload, status }))
  }
}

function authenticated(role = 'admin', id = 'admin-user') {
  authUtils.extractBearerToken.mockReturnValue('token')
  authUtils.verifySupabaseToken.mockResolvedValue({
    user: { id, email: 'admin@example.edu', app_metadata: { role } },
    error: null
  })
}

beforeEach(() => jest.clearAllMocks())

describe('admin instructor verification review', () => {
  test('rejects non-admin queue access', async () => {
    authenticated('instructor', 'instructor-user')
    const client = { from: jest.fn() }
    createClient.mockReturnValue(client)

    const response = await handleAdminInstructorVerificationQueue(context())
    expect(response.status).toBe(403)
    expect(response.payload.error).toBe('Admin access required')
    expect(client.from).not.toHaveBeenCalled()
  })

  test('lists pending requests for an authenticated admin with institution details', async () => {
    authenticated('admin')
    const requests = query({
      data: [{
        id: '11111111-1111-4111-8111-111111111111', user_id: 'instructor-user',
        school_code: '001234', status: 'pending', verification_method: 'school_code_plus_affiliation_review',
        requested_at: '2026-10-11T20:00:00.000Z', reviewed_at: null, reviewed_by: null, review_note: null
      }],
      error: null
    })
    const institutions = query({
      data: [{ school_code: '001234', school_name: 'Example College', city: 'Example', state_code: 'KS' }],
      error: null
    })
    createClient.mockReturnValue({ from: jest.fn((table) => table === 'instructor_verification_requests' ? requests : institutions) })

    const response = await handleAdminInstructorVerificationQueue(context({ queryParams: { status: 'pending' } }))
    expect(response.status).toBe(200)
    expect(response.payload.requests).toHaveLength(1)
    expect(response.payload.requests[0]).toMatchObject({
      userId: 'instructor-user', schoolCode: '001234', status: 'pending',
      institution: { schoolName: 'Example College' }
    })
    expect(requests.eq).toHaveBeenCalledWith('status', 'pending')
    expect(requests.limit).toHaveBeenCalledWith(50)
  })

  test('requires a note when rejecting', async () => {
    authenticated('admin')
    createClient.mockReturnValue({ from: jest.fn() })
    const response = await handleAdminInstructorVerificationDecision(context({
      method: 'PATCH',
      requestId: '11111111-1111-4111-8111-111111111111',
      body: { decision: 'rejected', reviewNote: '' }
    }))
    expect(response.status).toBe(400)
    expect(response.payload.error).toMatch(/reviewNote is required/i)
  })

  test('fails closed when immutable audit schema is unavailable', async () => {
    authenticated('admin')
    const auditUnavailable = query({ data: null, error: { message: 'relation does not exist' } })
    createClient.mockReturnValue({ from: jest.fn(() => auditUnavailable) })

    const response = await handleAdminInstructorVerificationDecision(context({
      method: 'PATCH', requestId: '11111111-1111-4111-8111-111111111111',
      body: { decision: 'approved' }
    }))
    expect(response.status).toBe(503)
    expect(response.payload.error).toBe('Instructor verification review audit unavailable')
    expect(auditUnavailable.update).not.toHaveBeenCalled()
  })

  test('binds decision reviewer to the verified admin identity and keeps role grants separate', async () => {
    authenticated('admin', 'verified-admin')
    const current = query({
      data: {
        id: '11111111-1111-4111-8111-111111111111', user_id: 'instructor-user', school_code: '001234',
        status: 'pending', verification_method: 'school_code_plus_affiliation_review', requested_at: '2026-10-11T20:00:00.000Z'
      },
      error: null
    })
    const updated = query({
      data: {
        id: '11111111-1111-4111-8111-111111111111', user_id: 'instructor-user', school_code: '001234',
        status: 'approved', verification_method: 'school_code_plus_affiliation_review', requested_at: '2026-10-11T20:00:00.000Z',
        reviewed_at: '2026-10-11T21:00:00.000Z', reviewed_by: 'verified-admin', review_note: null
      },
      error: null
    })
    const institution = query({ data: { school_code: '001234', school_name: 'Example College' }, error: null })
    const auditReady = query({ data: [], error: null })
    let requestCalls = 0
    createClient.mockReturnValue({
      from: jest.fn((table) => {
        if (table === 'instructor_verification_decisions') return auditReady
        if (table === 'institutions') return institution
        requestCalls += 1
        return requestCalls === 1 ? current : updated
      })
    })

    const response = await handleAdminInstructorVerificationDecision(context({
      method: 'PATCH',
      requestId: '11111111-1111-4111-8111-111111111111',
      body: { decision: 'approved', reviewedBy: 'attacker-supplied' }
    }))

    expect(response.status).toBe(200)
    expect(updated.update).toHaveBeenCalledTimes(1)
    expect(updated.updatedPayload.reviewed_by).toBe('verified-admin')
    expect(updated.updatedPayload.status).toBe('approved')
    expect(response.payload.authorizationGranted).toBe(false)
    expect(response.payload.message).toMatch(/trusted instructor role is still required/i)
  })

  test('refuses to overwrite a final decision', async () => {
    authenticated('admin')
    const finalRequest = query({ data: { id: '11111111-1111-4111-8111-111111111111', status: 'approved' }, error: null })
    const auditReady = query({ data: [], error: null })
    createClient.mockReturnValue({ from: jest.fn((table) => table === 'instructor_verification_decisions' ? auditReady : finalRequest) })

    const response = await handleAdminInstructorVerificationDecision(context({
      method: 'PATCH', requestId: '11111111-1111-4111-8111-111111111111',
      body: { decision: 'rejected', reviewNote: 'No longer valid.' }
    }))
    expect(response.status).toBe(409)
    expect(finalRequest.update).not.toHaveBeenCalled()
  })
})

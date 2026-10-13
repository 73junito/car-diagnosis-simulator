import { createClient } from '@supabase/supabase-js'
import { extractBearerToken, verifySupabaseToken } from '../../api/_utils/auth-utils.js'
import copilot from '../../src/ai/diagnostics/diagnostic-copilot.js'
import contracts from '../../src/ai/diagnostics/contracts.js'
import { resolveDiagnosticCopilotActivation } from '../runtime/diagnostic-copilot-activation.js'
import { requestDiagnosticCopilotAdvice } from '../services/diagnostic-copilot-model.js'
import { logCopilotStarted, logCopilotCompleted, logCopilotFailed } from '../utils/copilot-logger.js'

const { planDiagnosticCopilot, prepareDiagnosticReport } = copilot
const { createDiagnosticSession } = contracts

const MODES = new Set(['training', 'technician'])
const SESSION_STATUSES = new Set(['open', 'closed', 'abandoned'])
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,128}$/

function serviceClient(c) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

async function authenticate(c) {
  const url = c.env?.SUPABASE_URL
  const key = c.env?.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { response: c.json({ error: 'Server configuration incomplete' }, 500) }

  const token = extractBearerToken(c.req.header('authorization'))
  if (!token) return { response: c.json({ error: 'Authentication required' }, 401) }

  const { user, error } = await verifySupabaseToken(token, url, key)
  if (error || !user?.id) return { response: c.json({ error: error || 'Invalid token' }, 401) }

  return { user, supabase: serviceClient(c) }
}

async function bodyJson(c) {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function text(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function stringArray(value, maxItems = 50, maxLength = 500) {
  if (!Array.isArray(value)) return []
  return value.slice(0, maxItems).map((item) => text(item, maxLength)).filter(Boolean)
}

function safeVehicle(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const key of ['vin','year','make','model','trim','engine','drivetrain','market','source','match','unresolvedFields']) {
    if (value[key] !== undefined) out[key] = value[key]
  }
  return out
}

function publicVehicle(value = {}) {
  const vehicle = { ...(value || {}) }
  delete vehicle.vin
  return vehicle
}

function publicSession(row) {
  const state = row.state_json && typeof row.state_json === 'object' ? row.state_json : {}
  return {
    id: row.id,
    mode: row.mode,
    vehicle: publicVehicle(row.vehicle_json),
    complaint: row.complaint || '',
    symptoms: Array.isArray(state.symptoms) ? state.symptoms : [],
    observations: Array.isArray(state.observations) ? state.observations : [],
    measurements: Array.isArray(state.measurements) ? state.measurements : [],
    hypotheses: Array.isArray(state.hypotheses) ? state.hypotheses : [],
    eliminatedHypotheses: Array.isArray(state.eliminatedHypotheses) ? state.eliminatedHypotheses : [],
    testsPerformed: Array.isArray(state.testsPerformed) ? state.testsPerformed : [],
    technicianDecisions: Array.isArray(state.technicianDecisions) ? state.technicianDecisions : [],
    finalVerification: state.finalVerification || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    boundary: {
      advisoryOnly: true,
      technicianVerificationRequired: true
    }
  }
}

function sessionContract(row) {
  const state = row.state_json && typeof row.state_json === 'object' ? row.state_json : {}
  return createDiagnosticSession({
    sessionId: row.id,
    mode: row.mode,
    vehicle: row.vehicle_json || {},
    complaint: row.complaint || '',
    symptoms: state.symptoms || [],
    observations: state.observations || [],
    measurements: state.measurements || [],
    hypotheses: state.hypotheses || [],
    eliminatedHypotheses: state.eliminatedHypotheses || [],
    testsPerformed: state.testsPerformed || [],
    evidenceIds: state.evidenceIds || [],
    technicianDecisions: state.technicianDecisions || [],
    finalVerification: state.finalVerification || null
  })
}

async function ownedSession(supabase, userId, sessionId) {
  const { data, error } = await supabase
    .from('diagnostic_sessions')
    .select('id,user_id,mode,vehicle_json,complaint,state_json,status,created_at,updated_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function idempotencyKey(c) {
  const key = text(c.req.header('idempotency-key'), 128)
  return IDEMPOTENCY_RE.test(key) ? key : null
}

async function loadEvidence(supabase, userId, sessionId) {
  const { data: links, error: linkError } = await supabase
    .from('diagnostic_session_evidence')
    .select('chunk_id,claim_id,claim_scope,vehicle_match,directly_relevant,current_enough')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (linkError) throw linkError
  if (!links?.length) return []

  const ids = [...new Set(links.map((row) => row.chunk_id))]
  const { data: chunks, error: chunkError } = await supabase
    .from('source_chunks')
    .select('chunk_id,source_id,text_hash,status,approved,approved_sources!inner(id,title,publisher,storage_path,checksum,status)')
    .in('chunk_id', ids)
    .eq('approved', true)
    .eq('status', 'approved')
    .eq('approved_sources.status', 'approved')

  if (chunkError) throw chunkError

  const byId = new Map((chunks || []).map((row) => [row.chunk_id, row]))
  return links.flatMap((link) => {
    const chunk = byId.get(link.chunk_id)
    if (!chunk) return []
    const source = chunk.approved_sources
    return [{
      evidenceId: link.chunk_id,
      claimId: link.claim_id,
      claimScope: link.claim_scope,
      sourceId: chunk.source_id,
      sourceType: 'approved-source-chunk',
      sourceAuthority: 'instructional',
      sourceApproval: 'approved',
      canonicalUrl: source?.storage_path || null,
      artifactSha256: source?.checksum || null,
      chunkId: link.chunk_id,
      vehicleMatch: link.vehicle_match,
      evidenceStatus: 'supported',
      directlyRelevant: link.directly_relevant === true,
      currentEnough: link.current_enough !== false,
      verificationRequired: true
    }]
  })
}

async function appendEvent(supabase, execution, eventType, event = {}) {
  const { error } = await supabase.from('diagnostic_execution_events').insert({
    execution_id: execution.id,
    session_id: execution.session_id,
    user_id: execution.user_id,
    event_type: eventType,
    event_json: event
  })
  if (error) throw error
}

async function beginExecution({ supabase, userId, sessionId, key, operation, inputHash }) {
  const payload = {
    session_id: sessionId,
    user_id: userId,
    idempotency_key: key,
    operation,
    status: 'running',
    attempt_count: 1,
    max_attempts: 1,
    timeout_ms: 2500,
    input_hash: inputHash
  }

  const { data, error } = await supabase
    .from('diagnostic_executions')
    .insert(payload)
    .select('id,session_id,user_id,idempotency_key,operation,status,attempt_count,max_attempts,timeout_ms,input_hash,result_json,error_code,created_at,completed_at')
    .single()

  if (!error) {
    await appendEvent(supabase, data, 'execution_started', { operation })
    return { execution: data, replayed: false }
  }

  if (error.code !== '23505') throw error

  const { data: existing, error: readError } = await supabase
    .from('diagnostic_executions')
    .select('id,session_id,user_id,idempotency_key,operation,status,attempt_count,max_attempts,timeout_ms,input_hash,result_json,error_code,created_at,completed_at')
    .eq('user_id', userId)
    .eq('idempotency_key', key)
    .maybeSingle()

  if (readError) throw readError
  if (!existing) throw error
  if (existing.session_id !== sessionId || existing.operation !== operation || existing.input_hash !== inputHash) {
    const conflict = new Error('Idempotency key is already bound to different input')
    conflict.code = 'idempotency_conflict'
    throw conflict
  }
  return { execution: existing, replayed: true }
}

async function finishExecution(supabase, execution, result) {
  const completedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('diagnostic_executions')
    .update({ status: 'succeeded', result_json: result, completed_at: completedAt })
    .eq('id', execution.id)
    .eq('user_id', execution.user_id)
    .select('id,session_id,user_id,status,result_json,completed_at')
    .single()
  if (error) throw error
  await appendEvent(supabase, execution, 'execution_succeeded', { operation: execution.operation })
  return data
}

async function failExecution(supabase, execution, error) {
  const completedAt = new Date().toISOString()
  const errorCode = text(error?.code || 'copilot_execution_failed', 120)
  await supabase
    .from('diagnostic_executions')
    .update({ status: 'failed', error_code: errorCode, completed_at: completedAt })
    .eq('id', execution.id)
    .eq('user_id', execution.user_id)
  await appendEvent(supabase, execution, 'execution_failed', { errorCode })
}

export async function handleDiagnosticSessions(c) {
  const auth = await authenticate(c)
  if (auth.response) return auth.response
  const { user, supabase } = auth

  if (c.req.method === 'GET') {
    const { data, error } = await supabase
      .from('diagnostic_sessions')
      .select('id,user_id,mode,vehicle_json,complaint,state_json,status,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) return c.json({ error: 'Diagnostic sessions unavailable' }, 500)
    return c.json({ sessions: (data || []).map(publicSession) }, 200)
  }

  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)
  const body = await bodyJson(c)
  if (!body) return c.json({ error: 'Valid JSON body required' }, 400)

  const mode = text(body.mode, 20) || 'training'
  if (!MODES.has(mode)) return c.json({ error: 'mode must be training or technician' }, 400)

  const sessionId = crypto.randomUUID()
  let session
  try {
    session = createDiagnosticSession({
      sessionId,
      mode,
      vehicle: safeVehicle(body.vehicle),
      complaint: text(body.complaint),
      symptoms: stringArray(body.symptoms),
      observations: stringArray(body.observations),
      measurements: stringArray(body.measurements),
      hypotheses: stringArray(body.hypotheses),
      eliminatedHypotheses: stringArray(body.eliminatedHypotheses),
      testsPerformed: stringArray(body.testsPerformed),
      technicianDecisions: [],
      finalVerification: null
    })
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }

  const state = {
    symptoms: session.symptoms,
    observations: session.observations,
    measurements: session.measurements,
    hypotheses: session.hypotheses,
    eliminatedHypotheses: session.eliminatedHypotheses,
    testsPerformed: session.testsPerformed,
    evidenceIds: [],
    technicianDecisions: [],
    finalVerification: null
  }

  const { data, error } = await supabase
    .from('diagnostic_sessions')
    .insert({
      id: sessionId,
      user_id: user.id,
      mode,
      vehicle_json: session.vehicle,
      complaint: session.complaint,
      state_json: state
    })
    .select('id,user_id,mode,vehicle_json,complaint,state_json,status,created_at,updated_at')
    .single()

  if (error) return c.json({ error: 'Unable to create diagnostic session' }, 500)
  return c.json({ session: publicSession(data) }, 201)
}

export async function handleDiagnosticSession(c) {
  const auth = await authenticate(c)
  if (auth.response) return auth.response
  const { user, supabase } = auth
  const sessionId = text(c.req.param('sessionId'), 80)
  if (!sessionId) return c.json({ error: 'Session id is required' }, 400)

  let current
  try {
    current = await ownedSession(supabase, user.id, sessionId)
  } catch {
    return c.json({ error: 'Diagnostic session unavailable' }, 500)
  }
  if (!current) return c.json({ error: 'Diagnostic session not found' }, 404)

  if (c.req.method === 'GET') return c.json({ session: publicSession(current) }, 200)
  if (c.req.method !== 'PATCH') return c.json({ error: 'Method not allowed' }, 405)

  const body = await bodyJson(c)
  if (!body) return c.json({ error: 'Valid JSON body required' }, 400)
  const previous = sessionContract(current)
  const nextStatus = body.status === undefined ? current.status : text(body.status, 20)
  if (!SESSION_STATUSES.has(nextStatus)) return c.json({ error: 'Invalid session status' }, 400)

  let next
  try {
    next = createDiagnosticSession({
      sessionId: current.id,
      mode: current.mode,
      vehicle: body.vehicle === undefined ? previous.vehicle : safeVehicle(body.vehicle),
      complaint: body.complaint === undefined ? previous.complaint : text(body.complaint),
      symptoms: body.symptoms === undefined ? previous.symptoms : stringArray(body.symptoms),
      observations: body.observations === undefined ? previous.observations : stringArray(body.observations),
      measurements: body.measurements === undefined ? previous.measurements : stringArray(body.measurements),
      hypotheses: body.hypotheses === undefined ? previous.hypotheses : stringArray(body.hypotheses),
      eliminatedHypotheses: body.eliminatedHypotheses === undefined ? previous.eliminatedHypotheses : stringArray(body.eliminatedHypotheses),
      testsPerformed: body.testsPerformed === undefined ? previous.testsPerformed : stringArray(body.testsPerformed),
      evidenceIds: previous.evidenceIds,
      technicianDecisions: previous.technicianDecisions,
      finalVerification: body.finalVerification === undefined ? previous.finalVerification : (text(body.finalVerification, 2000) || null)
    })
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }

  const state = {
    symptoms: next.symptoms,
    observations: next.observations,
    measurements: next.measurements,
    hypotheses: next.hypotheses,
    eliminatedHypotheses: next.eliminatedHypotheses,
    testsPerformed: next.testsPerformed,
    evidenceIds: previous.evidenceIds,
    technicianDecisions: previous.technicianDecisions,
    finalVerification: next.finalVerification
  }

  const { data, error } = await supabase
    .from('diagnostic_sessions')
    .update({
      vehicle_json: next.vehicle,
      complaint: next.complaint,
      state_json: state,
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', current.id)
    .eq('user_id', user.id)
    .select('id,user_id,mode,vehicle_json,complaint,state_json,status,created_at,updated_at')
    .single()

  if (error) return c.json({ error: 'Unable to update diagnostic session' }, 500)
  return c.json({ session: publicSession(data) }, 200)
}

export async function handleDiagnosticEvidence(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)
  const auth = await authenticate(c)
  if (auth.response) return auth.response
  const { user, supabase } = auth
  const sessionId = text(c.req.param('sessionId'), 80)
  const body = await bodyJson(c)
  if (!sessionId || !body) return c.json({ error: 'Session id and valid JSON body are required' }, 400)

  const session = await ownedSession(supabase, user.id, sessionId)
  if (!session) return c.json({ error: 'Diagnostic session not found' }, 404)

  const chunkId = text(body.chunkId, 240)
  const claimId = text(body.claimId, 240)
  const claimScope = text(body.claimScope, 40) || 'general'
  if (!chunkId || !claimId) return c.json({ error: 'chunkId and claimId are required' }, 400)
  if (claimScope !== 'general') {
    return c.json({
      error: 'Stage 2 does not infer primary vehicle-specific authority; vehicle-specific evidence remains blocked pending an authoritative source-classification layer.'
    }, 409)
  }

  const { data: chunk, error: chunkError } = await supabase
    .from('source_chunks')
    .select('chunk_id,source_id,status,approved,approved_sources!inner(id,status)')
    .eq('chunk_id', chunkId)
    .eq('approved', true)
    .eq('status', 'approved')
    .eq('approved_sources.status', 'approved')
    .maybeSingle()

  if (chunkError) return c.json({ error: 'Evidence lookup unavailable' }, 500)
  if (!chunk) return c.json({ error: 'Approved evidence chunk not found' }, 404)

  const { data, error } = await supabase
    .from('diagnostic_session_evidence')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      chunk_id: chunkId,
      claim_id: claimId,
      claim_scope: 'general',
      vehicle_match: 'generic',
      directly_relevant: body.directlyRelevant === true,
      current_enough: body.currentEnough !== false
    })
    .select('id,chunk_id,claim_id,claim_scope,vehicle_match,directly_relevant,current_enough,created_at')
    .single()

  if (error?.code === '23505') return c.json({ error: 'Evidence is already linked to this claim' }, 409)
  if (error) return c.json({ error: 'Unable to link evidence' }, 500)

  return c.json({
    evidence: data,
    boundary: {
      sourceApprovalResolvedByServer: true,
      vehicleSpecificAuthorityInferred: false
    }
  }, 201)
}

async function runPreparation(c, operation) {
  const auth = await authenticate(c)
  if (auth.response) return auth.response
  const { user, supabase } = auth
  const sessionId = text(c.req.param('sessionId'), 80)
  const key = idempotencyKey(c)
  if (!sessionId) return c.json({ error: 'Session id is required' }, 400)
  if (!key) return c.json({ error: 'A valid Idempotency-Key header (8-128 safe characters) is required' }, 400)

  let row
  let evidence
  try {
    row = await ownedSession(supabase, user.id, sessionId)
    if (!row) return c.json({ error: 'Diagnostic session not found' }, 404)
    if (row.status !== 'open') return c.json({ error: 'Only open diagnostic sessions can run Copilot preparation' }, 409)
    evidence = await loadEvidence(supabase, user.id, sessionId)
  } catch {
    return c.json({ error: 'Diagnostic session unavailable' }, 500)
  }

  const session = sessionContract(row)
  const inputHash = await sha256({
    operation,
    session: {
      ...publicSession(row),
      updatedAt: row.updated_at
    },
    evidence: evidence.map((item) => ({
      evidenceId: item.evidenceId,
      claimId: item.claimId,
      directlyRelevant: item.directlyRelevant,
      currentEnough: item.currentEnough
    }))
  })

  let begun
  try {
    begun = await beginExecution({
      supabase,
      userId: user.id,
      sessionId,
      key,
      operation,
      inputHash
    })
  } catch (error) {
    if (error.code === 'idempotency_conflict') return c.json({ error: error.message }, 409)
    return c.json({ error: 'Unable to begin Copilot execution' }, 500)
  }

  if (begun.replayed) {
    if (begun.execution.status === 'succeeded') {
      return c.json({
        executionId: begun.execution.id,
        replayed: true,
        result: begun.execution.result_json
      }, 200)
    }
    return c.json({
      error: 'The idempotent execution already exists and is not in a replayable succeeded state',
      executionId: begun.execution.id,
      status: begun.execution.status
    }, 409)
  }

  try {
    const result = operation === 'report'
      ? prepareDiagnosticReport({ session, evidence })
      : planDiagnosticCopilot({ intent: 'plan-next-check', session, evidence })

    if (operation === 'report') {
      const { error: reportError } = await supabase
        .from('diagnostic_reports')
        .insert({
          session_id: sessionId,
          execution_id: begun.execution.id,
          user_id: user.id,
          report_json: result,
          evidence_chunk_ids: evidence.map((item) => item.chunkId)
        })
      if (reportError) throw reportError
    }

    await finishExecution(supabase, begun.execution, result)

    return c.json({
      executionId: begun.execution.id,
      replayed: false,
      result
    }, 200)
  } catch (error) {
    try { await failExecution(supabase, begun.execution, error) } catch {}
    return c.json({ error: 'Copilot preparation failed' }, 500)
  }
}


async function persistenceHealth(supabase) {
  const { error } = await supabase
    .from('diagnostic_sessions')
    .select('id')
    .limit(1)
  return { ok: !error, error: error ? 'diagnostic_session_store_unavailable' : null }
}

function modelTimeoutMs(env = {}) {
  const raw = Number.parseInt(env.TORQUEMIND_COPILOT_TIMEOUT_MS || '', 10)
  if (!Number.isFinite(raw)) return 12000
  return Math.min(Math.max(raw, 1000), 30000)
}

export async function handleDiagnosticCopilotHealth(c) {
  if (c.req.method !== 'GET') return c.json({ error: 'Method not allowed' }, 405)

  const activation = resolveDiagnosticCopilotActivation(c.env)
  const auth = await authenticate(c)
  if (auth.response) return auth.response

  const persistence = await persistenceHealth(auth.supabase)
  const ready = activation.enabled && persistence.ok

  return c.json({
    ready,
    activation: {
      configuredEnabled: activation.configuredEnabled,
      enabled: activation.enabled,
      killSwitch: activation.killSwitch,
      environment: activation.environment,
      persistenceHealthy: activation.persistenceHealthy && persistence.ok,
      reason: !persistence.ok ? 'persistence-unhealthy' : activation.reason,
      provider: activation.provider
    },
    boundary: {
      advisoryOnly: true,
      deterministicNextAction: true,
      technicianVerificationRequired: true
    }
  }, ready ? 200 : 503)
}

export async function handleDiagnosticAdvice(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)

  let activation
  try {
    activation = resolveDiagnosticCopilotActivation(c.env)
  } catch (error) {
    return c.json({ error: 'Diagnostic Copilot provider configuration invalid' }, 503)
  }

  if (!activation.enabled) {
    return c.json({
      error: 'Diagnostic Copilot is unavailable',
      reason: activation.reason
    }, 503)
  }

  const auth = await authenticate(c)
  if (auth.response) return auth.response
  const { user, supabase } = auth
  const sessionId = text(c.req.param('sessionId'), 80)
  if (!sessionId) return c.json({ error: 'Session id is required' }, 400)

  const persistence = await persistenceHealth(supabase)
  if (!persistence.ok) {
    return c.json({ error: 'Diagnostic Copilot persistence health check failed' }, 503)
  }

  let row
  let evidence
  try {
    row = await ownedSession(supabase, user.id, sessionId)
    if (!row) return c.json({ error: 'Diagnostic session not found' }, 404)
    if (row.status !== 'open') {
      return c.json({ error: 'Only open diagnostic sessions can request Copilot advice' }, 409)
    }
    evidence = await loadEvidence(supabase, user.id, sessionId)
  } catch {
    return c.json({ error: 'Diagnostic session unavailable' }, 500)
  }

  const session = sessionContract(row)
  const plan = planDiagnosticCopilot({
    intent: 'plan-next-check',
    session,
    evidence
  })

  if (!Array.isArray(plan.nextActions) || plan.nextActions.length === 0) {
    return c.json({
      modelUsed: false,
      deterministicPlan: plan,
      advice: {
        summary: 'The deterministic Copilot cannot advance this session yet.',
        nextAction: '',
        verificationReminder: 'Technician verification is required before treating any diagnostic direction as final.'
      }
    }, 200)
  }

  const requestId = c.reqId || crypto.randomUUID()
  const executionId = crypto.randomUUID()
  const timeoutMs = modelTimeoutMs(c.env)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  logCopilotStarted({
    requestId,
    executionId,
    environment: activation.environment,
    provider: activation.provider?.provider,
    model: activation.provider?.model
  })

  try {
    const modelAdvice = await requestDiagnosticCopilotAdvice({
      env: c.env,
      session: {
        ...session,
        vehicle: publicVehicle(session.vehicle)
      },
      plan,
      signal: controller.signal
    })

    const advice = {
      summary: text(modelAdvice.summary, 800),
      nextAction: plan.nextActions[0],
      verificationReminder: 'Technician verification is required before treating any diagnostic direction as final.'
    }

    logCopilotCompleted({
      requestId,
      executionId,
      durationMs: Date.now() - startedAt,
      provider: activation.provider?.provider,
      model: activation.provider?.model
    })

    return c.json({
      modelUsed: true,
      requestId,
      executionId,
      deterministicPlan: plan,
      advice,
      boundary: {
        advisoryOnly: true,
        modelMayChooseNextAction: false,
        technicianVerificationRequired: true
      }
    }, 200)
  } catch (error) {
    const errorType = error?.name === 'AbortError' ? 'timeout' : (error?.code || 'provider_error')
    logCopilotFailed({
      requestId,
      executionId,
      durationMs: Date.now() - startedAt,
      errorType,
      provider: activation.provider?.provider,
      model: activation.provider?.model
    })
    return c.json({
      error: error?.name === 'AbortError'
        ? 'Diagnostic Copilot provider timed out'
        : 'Diagnostic Copilot provider unavailable',
      code: errorType
    }, error?.name === 'AbortError' ? 504 : 503)
  } finally {
    clearTimeout(timer)
  }
}

export async function handleDiagnosticPlan(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)
  return runPreparation(c, 'plan')
}

export async function handleDiagnosticReport(c) {
  if (c.req.method !== 'POST') return c.json({ error: 'Method not allowed' }, 405)
  return runPreparation(c, 'report')
}

export { publicSession, sha256, idempotencyKey, loadEvidence }

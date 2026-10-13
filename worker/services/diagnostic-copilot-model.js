import { requestOllama } from './ollama.js'
import { requestOpenAI } from './openai-compatible.js'

function text(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function compactSession(session = {}) {
  return {
    mode: session.mode === 'technician' ? 'technician' : 'training',
    vehicle: {
      year: session.vehicle?.year || null,
      make: text(session.vehicle?.make, 80) || null,
      model: text(session.vehicle?.model, 80) || null,
      engine: text(session.vehicle?.engine, 120) || null,
      match: text(session.vehicle?.match, 40) || 'unknown'
    },
    complaint: text(session.complaint, 1200),
    symptoms: Array.isArray(session.symptoms) ? session.symptoms.slice(0, 20).map(v => text(v, 300)) : [],
    observations: Array.isArray(session.observations) ? session.observations.slice(0, 20).map(v => text(v, 300)) : [],
    measurements: Array.isArray(session.measurements) ? session.measurements.slice(0, 20).map(v => text(v, 300)) : []
  }
}

function buildPrompt({ session, plan }) {
  const payload = {
    session: compactSession(session),
    deterministicStatus: plan.status,
    allowedNextActions: Array.isArray(plan.nextActions) ? plan.nextActions : [],
    evidenceGate: {
      allowed: plan.evidenceGate?.allowed === true,
      reasons: Array.isArray(plan.evidenceGate?.reasons) ? plan.evidenceGate.reasons : []
    }
  }

  return [
    'You are the AutoLearnPro Automotive Diagnostic Copilot.',
    'You are advisory only and may not diagnose conclusively, grade, approve, publish, release, or change assessment eligibility.',
    'Use only the deterministic status and allowedNextActions supplied below.',
    'Do not invent facts, measurements, evidence, specifications, answer keys, or additional procedures.',
    'Return JSON with keys: summary, nextAction, verificationReminder.',
    'summary: at most 2 concise sentences.',
    'nextAction: must be either empty or a close paraphrase of one supplied allowedNextActions item.',
    'verificationReminder: explicitly state that technician verification is required.',
    JSON.stringify(payload)
  ].join('\n')
}

function parseAdvice(raw, fallbackAction) {
  let parsed = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = String(raw || '').match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  const summary = text(parsed.summary, 800)
  const requestedAction = text(parsed.nextAction, 700)
  const nextAction = requestedAction || text(fallbackAction, 700)
  const verificationReminder = text(parsed.verificationReminder, 500) ||
    'Technician verification is required before treating any diagnostic direction as final.'

  return {
    summary: summary || 'The deterministic Copilot has prepared an advisory next step.',
    nextAction,
    verificationReminder
  }
}

export async function requestDiagnosticCopilotAdvice({
  env,
  session,
  plan,
  signal
}) {
  const provider = env.TORQUEMIND_AI_PROVIDER || 'ollama'
  const model = env.TORQUEMIND_AI_MODEL || 'gpt-oss:20b-cloud'
  const url = env.TORQUEMIND_AI_URL
  const prompt = buildPrompt({ session, plan })
  let raw

  if (provider === 'ollama') {
    raw = await requestOllama({
      url,
      model,
      prompt,
      apiKey: env.TORQUEMIND_AI_API_KEY || '',
      accessClientId: env.OLLAMA_ACCESS_CLIENT_ID || '',
      accessClientSecret: env.OLLAMA_ACCESS_CLIENT_SECRET || '',
      signal,
      systemPrompt: 'Return only valid JSON. Never add diagnostic facts or authority beyond the supplied deterministic plan.',
      numPredict: 180,
      temperature: 0.1
    })
  } else if (provider === 'openai-compatible') {
    raw = await requestOpenAI({
      url,
      model,
      prompt,
      apiKey: env.TORQUEMIND_AI_API_KEY || '',
      signal
    })
  } else {
    const error = new Error('Unsupported diagnostic Copilot provider')
    error.code = 'unsupported_provider'
    throw error
  }

  return parseAdvice(raw, plan.nextActions?.[0] || '')
}

export { buildPrompt, compactSession, parseAdvice }

export function buildPrompt({ scenario, question, studentAnswer, topic = 'automotive diagnostics' }) {
  const header = `You are an ASE-certified automotive tutor. Produce a JSON object with the exact shape described below.`

  const schema = `Return exactly one JSON object with the following string fields:\n` +
    `  "reasonIncorrect": explanation of why the student's answer is incorrect,\n` +
    `  "reasonCorrect": explanation of why the correct answer is correct,\n` +
    `  "aseConcept": the ASE concept or principle involved,\n` +
    `  "nextStep": a concise next diagnostic step or repair suggestion\n` +
    `Do not include any additional keys or commentary outside the JSON.`

  const contextLines = [
    `Scenario: ${scenario}`,
    `Question: ${question}`,
    `Student Answer: ${studentAnswer}`,
    `Topic: ${topic}`
  ]

  const context = contextLines.join('\n')

  return [header, schema, '', context, '', 'Respond with the JSON object only:'].join('\n')
}

function tryParseJson(text) {
  return JSON.parse(text)
}

export function extractJson(text) {
  if (!text || String(text).trim().length === 0) {
    throw new Error('AI provider returned an empty response')
  }

  const str = String(text)

  // 1) Try fenced ```json blocks first
  const fenceMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch && fenceMatch[1]) {
    const candidate = fenceMatch[1].trim()
    try {
      return tryParseJson(candidate)
    } catch (err) {
      throw new Error('AI provider returned malformed JSON')
    }
  }

  // 2) Try to find the first {...} object in the text
  const objMatch = str.match(/\{[\s\S]*\}/)
  if (!objMatch) {
    throw new Error('AI provider did not return a JSON object')
  }

  const candidate = objMatch[0]
  try {
    return tryParseJson(candidate)
  } catch (err) {
    throw new Error('AI provider returned malformed JSON')
  }
}

export function validateTutorResponse(obj) {
  const required = ['reasonIncorrect', 'reasonCorrect', 'aseConcept', 'nextStep']

  const source = obj && typeof obj === 'object' && obj.feedback && typeof obj.feedback === 'object'
    ? obj.feedback
    : obj

  const aliases = {
    reasonIncorrect: ['reasonIncorrect', 'explanation', 'whyIncorrect', 'why_incorrect'],
    reasonCorrect: ['reasonCorrect', 'reasoning', 'correctReasoning', 'correct_reasoning'],
    aseConcept: ['aseConcept', 'ase_concept', 'ase'],
    nextStep: ['nextStep', 'nextDiagnosticStep', 'next_diagnostic_step']
  }

  if (!source || typeof source !== 'object') {
    throw new Error(`Tutor response is missing ${required[0]}`)
  }

  const out = {}
  for (const key of required) {
    const candidates = aliases[key] || [key]
    let val
    for (const candidate of candidates) {
      if (candidate in source) {
        val = source[candidate]
        break
      }
    }
    if (typeof val !== 'string') {
      throw new Error(`Tutor response is missing ${key}`)
    }
    const trimmed = val.trim()
    if (trimmed.length === 0) {
      throw new Error(`Tutor response is missing ${key}`)
    }
    out[key] = trimmed
  }

  return out
}

function plainTextFromFallback(value) {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^<!doctype|<html/i.test(trimmed)) return ''
  const noFence = trimmed.replace(/```[\s\S]*?```/g, ' ')
  const noTags = noFence.replace(/<[^>]+>/g, ' ')
  return noTags.replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function normalizeTutorResponse(obj, fallbackText = '') {
  try {
    return validateTutorResponse(obj)
  } catch (err) {
    const fallback = plainTextFromFallback(fallbackText)
    return {
      reasonIncorrect: fallback || 'Your selected answer does not align with the expected diagnostic result.',
      reasonCorrect: 'The correct answer follows evidence-based diagnostic logic and should be confirmed with measured test results.',
      aseConcept: 'Systematic diagnosis with verification before replacement.',
      nextStep: 'Perform the next manufacturer-recommended diagnostic test and confirm the fault with scan-tool or meter data.'
    }
  }
}

export default {
  buildPrompt,
  extractJson,
  validateTutorResponse,
  normalizeTutorResponse
}

export function buildPrompt({ scenario, question, studentAnswer, correctAnswer, topic = 'automotive diagnostics' }) {
  const header = `You are an ASE-certified automotive tutor. Produce a JSON object with the exact shape described below.`

  const schema = `Return exactly one JSON object with the following string fields:\n` +
    `  "reasonIncorrect": explanation of why the student's answer is incorrect,\n` +
    `  "reasonCorrect": explanation of why the correct answer is correct,\n` +
    `  "aseConcept": the ASE concept or principle involved,\n` +
    `  "nextStep": a concise next diagnostic step or repair suggestion\n` +
    `Do not include any additional keys or commentary outside the JSON.`

  const context = [
    `Scenario: ${scenario}`,
    `Question: ${question}`,
    `Student Answer: ${studentAnswer}`,
    `Correct Answer: ${correctAnswer}`,
    `Topic: ${topic}`
  ].join('\n')

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

  if (!obj || typeof obj !== 'object') {
    throw new Error(`Tutor response is missing ${required[0]}`)
  }

  const out = {}
  for (const key of required) {
    if (!(key in obj)) {
      throw new Error(`Tutor response is missing ${key}`)
    }
    const val = obj[key]
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

export default {
  buildPrompt,
  extractJson,
  validateTutorResponse
}

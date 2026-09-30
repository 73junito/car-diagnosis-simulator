function roundPercent(numerator, denominator) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

function buildStudentProgress(attempts, answers) {
  const attemptRows = Array.isArray(attempts) ? attempts : []
  const answerRows = Array.isArray(answers) ? answers : []
  const attemptMap = new Map(
    attemptRows
      .filter((row) => row && row.id && row.scenario)
      .map((row) => [row.id, row])
  )

  const validAnswers = answerRows.filter((row) => {
    if (!row || !row.attempt_id) return false
    return attemptMap.has(row.attempt_id)
  })

  const byScenario = new Map()

  for (const answer of validAnswers) {
    const attempt = attemptMap.get(answer.attempt_id)
    const scenarioId = attempt.scenario

    if (!byScenario.has(scenarioId)) {
      byScenario.set(scenarioId, {
        scenario_id: scenarioId,
        responses: 0,
        correct_responses: 0,
        first_activity: null,
        last_activity: null
      })
    }

    const summary = byScenario.get(scenarioId)
    summary.responses += 1
    if (answer.is_correct === true) summary.correct_responses += 1

    const timestamp = answer.submitted_at || answer.created_at || attempt.updated_at || attempt.created_at || null
    if (timestamp) {
      if (!summary.first_activity || timestamp < summary.first_activity) summary.first_activity = timestamp
      if (!summary.last_activity || timestamp > summary.last_activity) summary.last_activity = timestamp
    }
  }

  const performance = Array.from(byScenario.values())
    .map((row) => ({
      ...row,
      accuracy_pct: roundPercent(row.correct_responses, row.responses)
    }))
    .sort((a, b) => {
      if (a.accuracy_pct !== b.accuracy_pct) return a.accuracy_pct - b.accuracy_pct
      return String(a.scenario_id).localeCompare(String(b.scenario_id))
    })

  if (validAnswers.length === 0) {
    return {
      performance,
      transcript: null
    }
  }

  const scenarioCount = new Set(validAnswers.map((answer) => attemptMap.get(answer.attempt_id).scenario)).size
  const correctResponseCount = validAnswers.filter((answer) => answer.is_correct === true).length
  const activity = validAnswers
    .map((answer) => {
      const attempt = attemptMap.get(answer.attempt_id)
      return answer.submitted_at || answer.created_at || attempt.updated_at || attempt.created_at || null
    })
    .filter(Boolean)
    .sort()

  return {
    performance,
    transcript: {
      scenario_count: scenarioCount,
      response_count: validAnswers.length,
      correct_response_count: correctResponseCount,
      accuracy_pct: roundPercent(correctResponseCount, validAnswers.length),
      last_activity: activity.length ? activity[activity.length - 1] : null
    }
  }
}

export { buildStudentProgress }

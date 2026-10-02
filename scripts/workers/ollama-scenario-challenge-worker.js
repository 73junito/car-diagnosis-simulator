'use strict';

const { parseModelJson } = require('../lib/parse-model-json');
const { AGENT_VERSION, buildChallengeMessages } = require('../agents/scenario-challenge-question-agent');

async function runScenarioChallengeWorker({
  apiUrl, apiKey, model, batchId, batchTarget, allocation, scenarioContext, retainedQuestions, timeoutMs = 120000
}) {
  if (!apiUrl || !apiKey || !model) throw new Error('Ollama Cloud configuration is incomplete.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: buildChallengeMessages({
          batchId, batchTarget, allocation, scenarioContext, retainedQuestions
        })
      }),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama Cloud request failed with HTTP ${response.status}.`);
    }
    let envelope;
    try { envelope = JSON.parse(text); } catch { throw new Error('Ollama Cloud returned invalid JSON envelope.'); }
    const content = envelope?.message?.content;
    if (!content) throw new Error('Ollama Cloud returned no message content.');
    return { generated: parseModelJson(content), agentVersion: AGENT_VERSION };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { runScenarioChallengeWorker };

'use strict';

const { parseModelJson } = require('../lib/parse-model-json');
const { AGENT_VERSION, buildQuestionMessages } = require('../agents/automotive-question-agent');

async function runOllamaQuestionWorker({
  apiUrl, apiKey, model, scenarioId, targetCount, evidenceBundle, retainedQuestions,
  fetchImpl = globalThis.fetch, timeoutMs = 120000
}) {
  if (!apiKey) throw new Error('OLLAMA_API_KEY is required for question generation.');
  if (!model || typeof model !== 'string') throw new Error('An Ollama model is required.');
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const messages = buildQuestionMessages({ scenarioId, targetCount, evidenceBundle, retainedQuestions });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 }
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Ollama API returned ${response.status}.`);
    const payload = await response.json();
    const content = payload?.message?.content || payload?.response || '';
    if (!content) throw new Error('Ollama API returned no usable content.');
    return { generated: parseModelJson(content), model, agentVersion: AGENT_VERSION };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { runOllamaQuestionWorker };

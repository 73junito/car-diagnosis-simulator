'use strict';

const { parseModelJson } = require('../lib/parse-model-json');
const {
  AGENT_VERSION,
  buildChallengeMessages,
  buildChallengeJsonSchema
} = require('../agents/scenario-challenge-question-agent');

function describeContent(content) {
  const text = String(content || '');
  const trimmed = text.trim();
  return {
    chars: text.length,
    startsObject: trimmed.startsWith('{'),
    endsObject: trimmed.endsWith('}')
  };
}

async function runScenarioChallengeWorker({
  apiUrl, apiKey, model, batchId, batchTarget, allocation, scenarioContext, retainedQuestions,
  timeoutMs = 120000, fetchImpl = globalThis.fetch
}) {
  if (!apiUrl || !apiKey || !model) throw new Error('Ollama Cloud configuration is incomplete.');

  const startedAt = Date.now();
  const baseMessages = buildChallengeMessages({
    batchId, batchTarget, allocation, scenarioContext, retainedQuestions
  });
  const format = buildChallengeJsonSchema({ batchId, batchTarget });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const elapsed = Date.now() - startedAt;
    const remainingMs = timeoutMs - elapsed;
    if (remainingMs <= 0) {
      throw new Error('Ollama Cloud request timed out before a valid model response was received.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    const messages = attempt === 1
      ? baseMessages
      : [
          ...baseMessages,
          {
            role: 'user',
            content: [
              'The previous response could not be parsed as the required JSON object.',
              'Retry from the original instructions.',
              'Return one complete JSON object only; no markdown, prose, code fences, prefix, or suffix.',
              'The object must match the supplied JSON schema and contain the full requested batch.'
            ].join(' ')
          }
        ];

    try {
      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          stream: false,
          format,
          messages
        }),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Ollama Cloud request failed with HTTP ${response.status}.`);
      }

      let envelope;
      try {
        envelope = JSON.parse(text);
      } catch {
        throw new Error('Ollama Cloud returned invalid JSON envelope.');
      }

      const content = envelope?.message?.content;
      if (!content) throw new Error('Ollama Cloud returned no message content.');

      try {
        const generated = parseModelJson(content);
        if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
          throw new Error('Model response was not a JSON object.');
        }
        return { generated, agentVersion: AGENT_VERSION };
      } catch (error) {
        const diagnostic = describeContent(content);
        console.warn(
          `Ollama challenge parse failure attempt ${attempt}/2: ` +
          `chars=${diagnostic.chars}, starts_object=${diagnostic.startsObject}, ` +
          `ends_object=${diagnostic.endsObject}`
        );

        if (attempt === 2) {
          throw new Error(
            'Ollama Cloud returned malformed message content after 2 attempts ' +
            `(chars=${diagnostic.chars}, starts_object=${diagnostic.startsObject}, ` +
            `ends_object=${diagnostic.endsObject}).`
          );
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Ollama Cloud did not return a valid model response.');
}

module.exports = { runScenarioChallengeWorker, describeContent };

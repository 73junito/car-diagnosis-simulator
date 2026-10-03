'use strict';

const { parseModelJson } = require('../lib/parse-model-json');
const {
  AGENT_VERSION,
  buildChallengeMessages,
  buildChallengeJsonSchema
} = require('../agents/scenario-challenge-question-agent');

const MAX_QUESTIONS_PER_REQUEST = 10;

function describeContent(content) {
  const text = String(content || '');
  const trimmed = text.trim();
  return {
    chars: text.length,
    startsObject: trimmed.startsWith('{'),
    endsObject: trimmed.endsWith('}')
  };
}

function validateChunkScenarioAllocation(questions, allocation) {
  const expectedIds = new Set(Object.keys(allocation));
  const actualCounts = Object.fromEntries(
    Object.keys(allocation).map((scenarioId) => [scenarioId, 0])
  );

  for (const question of questions) {
    const scenarioId = question?.scenario_id;
    if (!expectedIds.has(scenarioId)) {
      throw new Error('Model response included a scenario outside the requested chunk allocation.');
    }
    actualCounts[scenarioId] += 1;
  }

  for (const [scenarioId, expectedCount] of Object.entries(allocation)) {
    if (actualCounts[scenarioId] !== expectedCount) {
      throw new Error(
        'Model response scenario allocation did not match the requested chunk.'
      );
    }
  }
}

function normalizeQuestionStem(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
}

function validateChunkQuestionStems(questions, priorQuestions = []) {
  const seen = new Set(
    priorQuestions
      .map((item) => normalizeQuestionStem(item?.question))
      .filter(Boolean)
  );

  for (const question of questions) {
    const stem = normalizeQuestionStem(question?.question);
    if (stem.length < 15 || seen.has(stem)) {
      throw new Error('Model response contained an invalid or duplicate question stem.');
    }
    seen.add(stem);
  }
}

function buildAllocationChunks(allocation, maxQuestions = MAX_QUESTIONS_PER_REQUEST) {
  if (!Number.isInteger(maxQuestions) || maxQuestions < 1) {
    throw new Error('maxQuestions must be a positive integer.');
  }

  const chunks = [];
  let currentAllocation = {};
  let currentCount = 0;

  for (const [scenarioId, rawCount] of Object.entries(allocation || {})) {
    if (!Number.isInteger(rawCount) || rawCount < 0) {
      throw new Error(`Allocation for ${scenarioId} must be a non-negative integer.`);
    }

    let remaining = rawCount;
    while (remaining > 0) {
      const available = maxQuestions - currentCount;
      const take = Math.min(remaining, available);
      currentAllocation[scenarioId] = (currentAllocation[scenarioId] || 0) + take;
      currentCount += take;
      remaining -= take;

      if (currentCount === maxQuestions) {
        chunks.push({ allocation: currentAllocation, target: currentCount });
        currentAllocation = {};
        currentCount = 0;
      }
    }
  }

  if (currentCount > 0) {
    chunks.push({ allocation: currentAllocation, target: currentCount });
  }

  return chunks;
}

async function requestChallengeChunk({
  apiUrl,
  apiKey,
  model,
  batchId,
  batchTarget,
  allocation,
  scenarioContext,
  retainedQuestions,
  priorGeneratedQuestions,
  deadlineAt,
  fetchImpl,
  chunkIndex,
  chunkCount
}) {
  const baseMessages = buildChallengeMessages({
    batchId, batchTarget, allocation, scenarioContext, retainedQuestions
  });
  const format = buildChallengeJsonSchema({ batchId, batchTarget });

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();
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
              'The previous response did not satisfy the required output contract.',
              'Retry from the original instructions.',
              'Return one complete JSON object only; no markdown, prose, code fences, prefix, or suffix.',
              'The object must match the supplied JSON schema and contain the full requested chunk.'
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
        if (typeof content !== 'string') {
          throw new Error('Model response content was not a string.');
        }
        const trimmed = content.trim();
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
          throw new Error('Model response violated the JSON-only boundary contract.');
        }

        const generated = parseModelJson(trimmed);
        if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
          throw new Error('Model response was not a JSON object.');
        }
        if (generated.batch_id !== batchId) {
          throw new Error('Model response batch_id did not match the requested batch.');
        }
        if (!Array.isArray(generated.questions) || generated.questions.length !== batchTarget) {
          throw new Error('Model response question count did not match the requested chunk.');
        }
        validateChunkScenarioAllocation(generated.questions, allocation);
        validateChunkQuestionStems(generated.questions, priorGeneratedQuestions);

        return generated.questions;
      } catch (error) {
        const diagnostic = describeContent(content);
        console.warn(
          `Ollama challenge parse failure chunk ${chunkIndex}/${chunkCount}, attempt ${attempt}/2: ` +
          `target=${batchTarget}, chars=${diagnostic.chars}, ` +
          `starts_object=${diagnostic.startsObject}, ends_object=${diagnostic.endsObject}, ` +
          `reason=${error.message}`
        );

        if (attempt === 2) {
          throw new Error(
            `Ollama Cloud returned malformed message content for chunk ${chunkIndex}/${chunkCount} after 2 attempts ` +
            `(target=${batchTarget}, chars=${diagnostic.chars}, ` +
            `starts_object=${diagnostic.startsObject}, ends_object=${diagnostic.endsObject}).`
          );
        }
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Ollama Cloud did not return a valid chunk response.');
}

async function runScenarioChallengeWorker({
  apiUrl, apiKey, model, batchId, batchTarget, allocation, scenarioContext, retainedQuestions,
  timeoutMs = 120000, fetchImpl = globalThis.fetch
}) {
  if (!apiUrl || !apiKey || !model) throw new Error('Ollama Cloud configuration is incomplete.');

  const chunks = buildAllocationChunks(allocation);
  const plannedCount = chunks.reduce((sum, chunk) => sum + chunk.target, 0);
  if (plannedCount !== batchTarget) {
    throw new Error(`Allocation total ${plannedCount} does not match batch target ${batchTarget}.`);
  }

  const deadlineAt = Date.now() + timeoutMs;
  const questions = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const scenarioIds = new Set(Object.keys(chunk.allocation));
    const chunkScenarioContext = (scenarioContext || [])
      .filter((row) => scenarioIds.has(row.scenario_id));
    const previouslyGeneratedForPrompt = questions.map((row) => ({
      scenario_id: row.scenario_id,
      question_id: null,
      status: 'synthetic-draft-current-run',
      question: row.question,
      options: row.options,
      correct_answer: row.correct_answer
    }));
    const chunkRetainedQuestions = [
      ...(retainedQuestions || []).filter((row) => scenarioIds.has(row.scenario_id)),
      ...previouslyGeneratedForPrompt
    ];

    const generatedQuestions = await requestChallengeChunk({
      apiUrl,
      apiKey,
      model,
      batchId,
      batchTarget: chunk.target,
      allocation: chunk.allocation,
      scenarioContext: chunkScenarioContext,
      retainedQuestions: chunkRetainedQuestions,
      priorGeneratedQuestions: questions,
      deadlineAt,
      fetchImpl,
      chunkIndex: index + 1,
      chunkCount: chunks.length
    });

    questions.push(...generatedQuestions);
  }

  if (questions.length !== batchTarget) {
    throw new Error(`Generated question count ${questions.length} does not match batch target ${batchTarget}.`);
  }

  return {
    generated: {
      batch_id: batchId,
      questions
    },
    agentVersion: AGENT_VERSION
  };
}

module.exports = {
  runScenarioChallengeWorker,
  describeContent,
  buildAllocationChunks,
  validateChunkScenarioAllocation,
  validateChunkQuestionStems,
  MAX_QUESTIONS_PER_REQUEST
};

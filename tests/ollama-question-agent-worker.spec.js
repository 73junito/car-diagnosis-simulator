const { buildQuestionMessages, selectDrafts, AGENT_VERSION } =
  require('../scripts/agents/automotive-question-agent');
const { runOllamaQuestionWorker } =
  require('../scripts/workers/ollama-question-worker');
const retained = require('../data/evidence/review-queues/charging-system-human-review-packet.json').questions;

const evidence = [{
  source_id: 'frontiers-automotive-alternator-2023',
  chunk_id: 'frontiers-alternator-ac-dc-rectification-p7',
  text_excerpt: 'An alternator is a synchronous AC generator with DC diode rectification and PWM voltage control.'
}];
const citations = [
  { source_id: evidence[0].source_id, chunk_id: evidence[0].chunk_id, role: 'supports-answer' },
  { source_id: evidence[0].source_id, chunk_id: evidence[0].chunk_id, role: 'supports-explanation' }
];

describe('dedicated Ollama question agent and worker', () => {
  test('instructions and retained items are sent as separate system and user messages', () => {
    const messages = buildQuestionMessages({
      scenarioId: 'charging-system', targetCount: 3, evidenceBundle: evidence, retainedQuestions: retained
    });
    expect(AGENT_VERSION).toBe('automotive-question-agent-v1');
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[0].content).toContain('A component is not a generator type');
    expect(messages[0].content).toContain('Do not repeat a retained learning target');
    const request = JSON.parse(messages[1].content);
    expect(request.retained_questions).toHaveLength(6);
    expect(request.evidence).toEqual(evidence);
  });

  test('worker sends the versioned agent messages to the requested model', async () => {
    let sent;
    const fetchImpl = async (url, options) => {
      sent = { url, options, request: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ message: { content: JSON.stringify({ questions: [] }) } })
      };
    };
    const result = await runOllamaQuestionWorker({
      apiUrl: 'https://ollama.com/api/chat', apiKey: 'test-secret',
      model: 'gpt-oss:20b', scenarioId: 'charging-system',
      targetCount: 1, evidenceBundle: evidence, retainedQuestions: retained, fetchImpl
    });
    expect(result.agentVersion).toBe(AGENT_VERSION);
    expect(result.generated).toEqual({ questions: [] });
    expect(sent.request.model).toBe('gpt-oss:20b');
    expect(sent.request.messages[0].role).toBe('system');
    expect(JSON.parse(sent.request.messages[1].content).retained_questions).toHaveLength(6);
    expect(sent.request.format).toBe('json');
    expect(sent.options.headers.Authorization).toBe('Bearer test-secret');
  });

  test('worker does not surface provider response body on failure', async () => {
    const fetchImpl = async () => ({
      ok: false, status: 401,
      text: async () => 'provider response containing sensitive content'
    });
    await expect(runOllamaQuestionWorker({
      apiUrl: 'https://ollama.com/api/chat', apiKey: 'test-secret',
      model: 'gpt-oss:20b', scenarioId: 'charging-system',
      targetCount: 1, evidenceBundle: evidence, retainedQuestions: retained, fetchImpl
    })).rejects.toThrow('Ollama API returned 401.');
  });

  test('agent filters the live duplicate before returning a draft', () => {
    const duplicate = {
      difficulty: 'intermediate',
      question: 'Which part of an automotive alternator converts the generated alternating current into direct current for the vehicle’s electrical system?',
      options: { A: 'Rotor', B: 'Stator', C: 'Diode rectifier', D: 'Voltage regulator' },
      correct_answer: 'C', explanation: 'The diode rectifier converts AC to DC.', citations
    };
    expect(() => selectDrafts({
      generated: { questions: [duplicate] }, scenarioId: 'charging-system',
      targetCount: 1, eligibleChunks: evidence, retainedQuestions: retained
    })).toThrow('No distinct draft questions remained; filtered 1 duplicate(s).');
  });
});

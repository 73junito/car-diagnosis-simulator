const { runScenarioChallengeWorker } =
  require('../scripts/workers/ollama-scenario-challenge-worker');
const { AGENT_VERSION } =
  require('../scripts/agents/scenario-challenge-question-agent');

const baseArgs = {
  apiUrl: 'https://ollama.com/api/chat',
  apiKey: 'test-secret',
  model: 'gpt-oss:20b-cloud',
  batchId: 1,
  batchTarget: 50,
  allocation: { 'no-crank': 50 },
  scenarioContext: [{ scenario_id: 'no-crank' }],
  retainedQuestions: []
};

describe('Ollama scenario challenge worker', () => {
  test('sends the requested model and versioned messages', async () => {
    let sent;
    const fetchImpl = async (url, options) => {
      sent = { url, options, request: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: { content: JSON.stringify({ batch_id: 1, questions: [] }) }
        })
      };
    };

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.agentVersion).toBe(AGENT_VERSION);
    expect(result.generated).toEqual({ batch_id: 1, questions: [] });
    expect(sent.url).toBe(baseArgs.apiUrl);
    expect(sent.request.model).toBe(baseArgs.model);
    expect(sent.request.format).toBe('json');
    expect(sent.request.stream).toBe(false);
    expect(sent.request.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(sent.options.headers.Authorization).toBe('Bearer test-secret');
  });

  test('reports non-2xx failures without surfacing provider body', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      text: async () => 'sensitive provider body'
    });

    await expect(runScenarioChallengeWorker({ ...baseArgs, fetchImpl }))
      .rejects.toThrow('Ollama Cloud request failed with HTTP 401.');
  });

  test('rejects an invalid JSON envelope', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => 'not-json'
    });

    await expect(runScenarioChallengeWorker({ ...baseArgs, fetchImpl }))
      .rejects.toThrow('Ollama Cloud returned invalid JSON envelope.');
  });

  test('rejects an empty message content', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message: { content: '' } })
    });

    await expect(runScenarioChallengeWorker({ ...baseArgs, fetchImpl }))
      .rejects.toThrow('Ollama Cloud returned no message content.');
  });

  test('clears the timeout when the request fails', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const fetchImpl = async () => {
      throw new Error('network failed');
    };

    await expect(runScenarioChallengeWorker({
      ...baseArgs,
      fetchImpl,
      timeoutMs: 25
    })).rejects.toThrow('network failed');

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

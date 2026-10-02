const { runScenarioChallengeWorker } =
  require('../scripts/workers/ollama-scenario-challenge-worker');
const {
  AGENT_VERSION,
  buildChallengeJsonSchema
} = require('../scripts/agents/scenario-challenge-question-agent');

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
  test('sends the requested model, structured format, and versioned messages', async () => {
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
    expect(sent.request.format).toEqual(buildChallengeJsonSchema({
      batchId: 1,
      batchTarget: 50
    }));
    expect(sent.request.format.properties.questions.minItems).toBe(50);
    expect(sent.request.format.properties.questions.maxItems).toBe(50);
    expect(sent.request.stream).toBe(false);
    expect(sent.request.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(sent.options.headers.Authorization).toBe('Bearer test-secret');
  });

  test('retries one malformed model response with a stricter JSON-only instruction', async () => {
    const requests = [];
    const responses = [
      'I will provide the questions next.',
      JSON.stringify({ batch_id: 1, questions: [] })
    ];
    const fetchImpl = async (url, options) => {
      requests.push(JSON.parse(options.body));
      const content = responses.shift();
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { content } })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated).toEqual({ batch_id: 1, questions: [] });
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.map((m) => m.role)).toEqual(['system', 'user', 'user']);
    expect(requests[1].messages[2].content).toContain('previous response could not be parsed');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('chars=34'));
    expect(warnSpy.mock.calls[0][0]).not.toContain('I will provide the questions next.');
    warnSpy.mockRestore();
  });

  test('retries fenced or prose-wrapped JSON instead of accepting permissive extraction', async () => {
    const requests = [];
    const responses = [
      '```json\\n{"batch_id":1,"questions":[]}\\n```',
      JSON.stringify({ batch_id: 1, questions: [] })
    ];
    const fetchImpl = async (url, options) => {
      requests.push(JSON.parse(options.body));
      const content = responses.shift();
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { content } })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated).toEqual({ batch_id: 1, questions: [] });
    expect(requests).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('starts_object=false');
    expect(warnSpy.mock.calls[0][0]).toContain('ends_object=false');
    warnSpy.mockRestore();
  });

  test('fails closed after two malformed responses without logging response content', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        message: { content: 'sensitive malformed provider content' }
      })
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runScenarioChallengeWorker({ ...baseArgs, fetchImpl }))
      .rejects.toThrow('Ollama Cloud returned malformed message content after 2 attempts');

    expect(warnSpy).toHaveBeenCalledTimes(2);
    for (const [message] of warnSpy.mock.calls) {
      expect(message).not.toContain('sensitive malformed provider content');
      expect(message).toContain('chars=');
    }
    warnSpy.mockRestore();
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

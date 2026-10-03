const {
  runScenarioChallengeWorker,
  buildAllocationChunks,
  MAX_QUESTIONS_PER_REQUEST
} = require('../scripts/workers/ollama-scenario-challenge-worker');
const {
  AGENT_VERSION,
  buildChallengeJsonSchema
} = require('../scripts/agents/scenario-challenge-question-agent');

const makeContractQuestion = (scenarioId, index, prefix = 'Question') => ({
  scenario_id: scenarioId,
  difficulty: 'intermediate',
  question: `${prefix} diagnostic ${scenarioId} ${index + 1} with enough detail`,
  options: {
    A: `Option A ${index + 1}`,
    B: `Option B ${index + 1}`,
    C: `Option C ${index + 1}`,
    D: `Option D ${index + 1}`
  },
  correct_answer: 'A',
  explanation: `Explanation ${index + 1}`,
  challenge_pattern: 'next-best diagnostic step',
  claims_to_verify: [`Claim ${index + 1}`],
  support_status: 'synthetic-draft-pending-evidence',
  status: 'draft',
  eligible_for_training_mix: false,
  eligible_for_scoring: false,
  assessment_eligible: false
});

const makeContractQuestions = (count, scenarioId = 'no-crank', prefix = 'Question') =>
  Array.from({ length: count }, (_, index) =>
    makeContractQuestion(scenarioId, index, prefix)
  );

const makeContractAllocatedQuestions = (allocation, prefix = 'Question') =>
  Object.entries(allocation).flatMap(([scenarioId, count]) =>
    Array.from({ length: count }, (_, index) =>
      makeContractQuestion(scenarioId, index, prefix)
    )
  );

const baseArgs = {
  apiUrl: 'https://ollama.com/api/chat',
  apiKey: 'test-secret',
  model: 'gpt-oss:20b-cloud',
  batchId: 1,
  batchTarget: 10,
  allocation: { 'no-crank': 10 },
  scenarioContext: [{ scenario_id: 'no-crank' }],
  retainedQuestions: []
};

describe('Ollama scenario challenge worker', () => {
  test('splits a large allocation into bounded requests without changing the total', () => {
    expect(MAX_QUESTIONS_PER_REQUEST).toBe(10);
    expect(buildAllocationChunks({ a: 12, b: 13 })).toEqual([
      { allocation: { a: 10 }, target: 10 },
      { allocation: { a: 2, b: 8 }, target: 10 },
      { allocation: { b: 5 }, target: 5 }
    ]);
  });

  test('sends the requested model, structured format, and versioned messages', async () => {
    let sent;
    const fetchImpl = async (url, options) => {
      sent = { url, options, request: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({
              batch_id: 1,
              questions: makeContractQuestions(10)
            })
          }
        })
      };
    };

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.agentVersion).toBe(AGENT_VERSION);
    expect(result.generated.batch_id).toBe(1);
    expect(result.generated.questions).toHaveLength(10);
    expect(sent.url).toBe(baseArgs.apiUrl);
    expect(sent.request.model).toBe(baseArgs.model);
    expect(sent.request.format).toEqual(buildChallengeJsonSchema({
      batchId: 1,
      batchTarget: 10
    }));
    expect(sent.request.format.properties.questions.minItems).toBe(10);
    expect(sent.request.format.properties.questions.maxItems).toBe(10);
    expect(sent.request.stream).toBe(false);
    expect(sent.request.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(sent.options.headers.Authorization).toBe('Bearer test-secret');
  });

  test('combines multiple provider chunks into the requested batch', async () => {
    const requests = [];
    const args = {
      ...baseArgs,
      batchTarget: 25,
      allocation: { a: 12, b: 13 },
      scenarioContext: [{ scenario_id: 'a' }, { scenario_id: 'b' }],
      retainedQuestions: [
        { scenario_id: 'a', question: 'retained a' },
        { scenario_id: 'b', question: 'retained b' }
      ]
    };

    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({
              batch_id: 1,
              questions: makeContractAllocatedQuestions(
                prompt.scenario_allocation,
                `chunk-${requests.length}`
              )
            })
          }
        })
      };
    };

    const result = await runScenarioChallengeWorker({ ...args, fetchImpl });

    expect(result.generated.questions).toHaveLength(25);
    expect(requests).toHaveLength(3);
    expect(requests.map((request) =>
      request.format.properties.questions.minItems
    )).toEqual([10, 10, 5]);
    expect(requests.map((request) =>
      JSON.parse(request.messages[1].content).scenario_allocation
    )).toEqual([
      { a: 10 },
      { a: 2, b: 8 },
      { b: 5 }
    ]);
  });

  test('retries a chunk that violates draft governance before final batch validation', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      const questions = makeContractAllocatedQuestions(
        prompt.scenario_allocation,
        requests.length === 1 ? 'bad-governance' : 'corrected-governance'
      );

      if (requests.length === 1) {
        questions[0].assessment_eligible = true;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({ batch_id: 1, questions })
          }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(warnSpy.mock.calls[0][0]).toContain('violates draft governance');
    warnSpy.mockRestore();
  });

  test('retries a chunk whose scenario counts do not match the requested allocation', async () => {
    const requests = [];
    const args = {
      ...baseArgs,
      batchTarget: 10,
      allocation: { a: 2, b: 8 },
      scenarioContext: [{ scenario_id: 'a' }, { scenario_id: 'b' }]
    };

    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      const questions = requests.length === 1
        ? makeContractQuestions(10, 'a', 'misallocated')
        : makeContractAllocatedQuestions(prompt.scenario_allocation, 'corrected');

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({ batch_id: 1, questions })
          }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...args, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(warnSpy.mock.calls[0][0])
      .toContain('reason=Model response scenario allocation did not match the requested chunk.');
    warnSpy.mockRestore();
  });

  test('carries earlier generated questions into later same-scenario avoidance context', async () => {
    const requests = [];
    const args = {
      ...baseArgs,
      batchTarget: 25,
      allocation: { a: 12, b: 13 },
      scenarioContext: [{ scenario_id: 'a' }, { scenario_id: 'b' }],
      retainedQuestions: [
        { scenario_id: 'a', question: 'retained a' },
        { scenario_id: 'b', question: 'retained b' }
      ]
    };

    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({
              batch_id: 1,
              questions: makeContractAllocatedQuestions(
                prompt.scenario_allocation,
                `generated-${requests.length}`
              )
            })
          }
        })
      };
    };

    await runScenarioChallengeWorker({ ...args, fetchImpl });

    const secondPrompt = JSON.parse(requests[1].messages[1].content);
    expect(secondPrompt.retained_questions.some(
      (row) => row.scenario_id === 'a' && row.question.startsWith('generated-1 diagnostic a')
    )).toBe(true);

    const thirdPrompt = JSON.parse(requests[2].messages[1].content);
    expect(thirdPrompt.scenario_allocation).toEqual({ b: 5 });
    expect(thirdPrompt.retained_questions.some(
      (row) => row.scenario_id === 'a' && row.question.startsWith('generated-1 diagnostic a')
    )).toBe(true);
    expect(secondPrompt.retained_questions).toContainEqual(
      expect.objectContaining({ scenario_id: 'a', question: 'retained a' })
    );
  });

  test('retries a chunk with normalized-equal stems inside the same response', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      const questions = makeContractAllocatedQuestions(
        prompt.scenario_allocation,
        requests.length === 1 ? 'same-chunk' : 'retry-unique'
      );

      if (requests.length === 1) {
        questions[0].question = 'Inspect the starter circuit before replacing components';
        questions[1].question = '  INSPECT   THE STARTER CIRCUIT BEFORE REPLACING COMPONENTS  ';
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({ batch_id: 1, questions })
          }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(warnSpy.mock.calls[0][0])
      .toContain('reason=Model response contained an invalid or duplicate question stem.');
    warnSpy.mockRestore();
  });

  test('retries a later chunk that repeats a stem from an earlier chunk', async () => {
    const requests = [];
    const repeatedStem = 'A repeated diagnostic stem with enough length';
    const args = {
      ...baseArgs,
      batchTarget: 20,
      allocation: { a: 10, b: 10 },
      scenarioContext: [{ scenario_id: 'a' }, { scenario_id: 'b' }]
    };

    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      let questions = makeContractAllocatedQuestions(
        prompt.scenario_allocation,
        `request-${requests.length}`
      );

      if (requests.length === 1) {
        questions[0].question = repeatedStem;
      } else if (requests.length === 2) {
        questions[0].question = repeatedStem;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: {
            content: JSON.stringify({ batch_id: 1, questions })
          }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...args, fetchImpl });

    expect(result.generated.questions).toHaveLength(20);
    expect(requests).toHaveLength(3);
    expect(warnSpy.mock.calls.some(([message]) =>
      message.includes('reason=Model response contained an invalid or duplicate question stem.')
    )).toBe(true);
    warnSpy.mockRestore();
  });

  test('uses the validation reason to recover on a third attempt', async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      const request = JSON.parse(options.body);
      requests.push(request);
      const prompt = JSON.parse(request.messages[1].content);
      let questions;

      if (requests.length === 1) {
        questions = makeContractAllocatedQuestions(prompt.scenario_allocation, 'duplicate-options');
        questions[0].options.B = questions[0].options.A;
      } else if (requests.length === 2) {
        questions = makeContractAllocatedQuestions(prompt.scenario_allocation, 'wrong-count').slice(0, 9);
      } else {
        questions = makeContractAllocatedQuestions(prompt.scenario_allocation, 'corrected');
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: { content: JSON.stringify({ batch_id: 1, questions }) }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(3);
    expect(requests[1].messages[2].content).toContain('repeats answer option text');
    expect(requests[2].messages[2].content).toContain('question count did not match');
    warnSpy.mockRestore();
  });

  test('retries one malformed chunk response with a stricter JSON-only instruction', async () => {
    const requests = [];
    const responses = [
      'I will provide the questions next.',
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(10) })
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

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.map((m) => m.role)).toEqual(['system', 'user', 'user']);
    expect(requests[1].messages[2].content).toContain('previous response did not satisfy the required output contract');
    expect(requests[1].messages[2].content).toContain('Validation failure:');
    expect(requests[1].messages[2].content).not.toContain('I will provide the questions next.');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('chunk 1/1'));
    expect(warnSpy.mock.calls[0][0]).not.toContain('I will provide the questions next.');
    warnSpy.mockRestore();
  });

  test('retries a valid JSON object with the wrong chunk count', async () => {
    const requests = [];
    const responses = [
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(9) }),
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(10) })
    ];
    const fetchImpl = async (url, options) => {
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: { content: responses.shift() }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(warnSpy.mock.calls[0][0])
      .toContain('reason=Model response question count did not match the requested chunk.');
    warnSpy.mockRestore();
  });

  test('retries fenced or prose-wrapped JSON instead of accepting permissive extraction', async () => {
    const requests = [];
    const responses = [
      '```json\\n{"batch_id":1,"questions":[]}\\n```',
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(10) })
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

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('starts_object=false');
    expect(warnSpy.mock.calls[0][0]).toContain('ends_object=false');
    warnSpy.mockRestore();
  });

  test('fails closed after three malformed responses without logging response content', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        message: { content: 'sensitive malformed provider content' }
      })
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runScenarioChallengeWorker({ ...baseArgs, fetchImpl }))
      .rejects.toThrow('Ollama Cloud returned malformed message content for chunk 1/1 after 3 attempts');

    expect(warnSpy).toHaveBeenCalledTimes(3);
    for (const [message] of warnSpy.mock.calls) {
      expect(message).not.toContain('sensitive malformed provider content');
      expect(message).toContain('chars=');
    }
    warnSpy.mockRestore();
  });

  test('uses a third attempt when two contract responses are invalid', async () => {
    const requests = [];
    const responses = [
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(9) }),
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(9) }),
      JSON.stringify({ batch_id: 1, questions: makeContractQuestions(10) })
    ];
    const fetchImpl = async (url, options) => {
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          message: { content: responses.shift() }
        })
      };
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runScenarioChallengeWorker({ ...baseArgs, fetchImpl });

    expect(result.generated.questions).toHaveLength(10);
    expect(requests).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0][0]).toContain('attempt 1/3');
    expect(warnSpy.mock.calls[1][0]).toContain('attempt 2/3');
    warnSpy.mockRestore();
  });

  test('rejects allocation totals that do not match the requested batch target', async () => {
    await expect(runScenarioChallengeWorker({
      ...baseArgs,
      batchTarget: 11,
      allocation: { 'no-crank': 10 },
      fetchImpl: jest.fn()
    })).rejects.toThrow('Allocation total 10 does not match batch target 11.');
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

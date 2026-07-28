const AgentProcess = require('../../../src/ai/kernel/agent-process');

describe('AgentProcess', () => {
  test('completes when the task returns done true', async () => {
    const process = new AgentProcess({
      id: 'complete',
      task: async () => ({
        done: true,
        value: 42,
      }),
    });

    const result = await process.runNextStep();

    expect(result.value).toBe(42);
    expect(process.status).toBe('completed');
    expect(process.stepsUsed).toBe(1);
  });

  test('returns to ready when work is unfinished', async () => {
    const process = new AgentProcess({
      id: 'unfinished',
      task: async () => ({
        done: false,
      }),
    });

    await process.runNextStep();

    expect(process.status).toBe('ready');
    expect(process.stepsUsed).toBe(1);
  });

  test('pauses when quota is exhausted', async () => {
    const process = new AgentProcess({
      id: 'quota',
      quota: 0,
      task: async () => ({
        done: false,
      }),
    });

    const result = await process.runNextStep();

    expect(result.reason).toBe('quota_exceeded');
    expect(process.status).toBe('paused');
  });

  test('can resume with additional quota', async () => {
    const process = new AgentProcess({
      id: 'resume',
      quota: 0,
      task: async () => ({
        done: true,
      }),
    });

    await process.runNextStep();

    expect(
      process.resume({
        additionalQuota: 1,
      })
    ).toBe(true);

    await process.runNextStep();

    expect(process.status).toBe('completed');
  });

  test('records task failures', async () => {
    const error = new Error('failure');

    const process = new AgentProcess({
      id: 'failed',
      task: async () => {
        throw error;
      },
    });

    await expect(process.runNextStep()).rejects.toThrow('failure');

    expect(process.status).toBe('failed');
    expect(process.error).toBe(error);
  });
});

const SchedulerKernel = require('../../ai-os/kernel/scheduler');
const AgentProcess = require('../../ai-os/kernel/process');

describe('SchedulerKernel', () => {
  test('runs higher priority processes first', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 1 });
    const executionOrder = [];

    const low = new AgentProcess({
      id: 'low',
      name: 'Low Priority',
      priority: 1,
      quota: 10,
      task: async () => {
        executionOrder.push('low');
        return { done: true };
      },
    });

    const high = new AgentProcess({
      id: 'high',
      name: 'High Priority',
      priority: 10,
      quota: 10,
      task: async () => {
        executionOrder.push('high');
        return { done: true };
      },
    });

    scheduler.enqueue(low);
    scheduler.enqueue(high);

    await scheduler.tick();

    expect(executionOrder).toEqual(['high']);
    expect(scheduler.completed[0].id).toBe('high');
  });

  test('moves completed process to completed queue', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 1 });

    const process = new AgentProcess({
      id: 'done',
      priority: 1,
      task: async () => ({ done: true }),
    });

    scheduler.enqueue(process);

    await scheduler.tick();

    expect(scheduler.completed).toHaveLength(1);
    expect(scheduler.completed[0].id).toBe('done');
    expect(scheduler.readyQueue).toHaveLength(0);
  });

  test('requeues unfinished process', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 1 });

    const process = new AgentProcess({
      id: 'worker',
      priority: 1,
      quota: 10,
      task: async () => ({ done: false }),
    });

    scheduler.enqueue(process);

    await scheduler.tick();

    expect(scheduler.completed).toHaveLength(0);
    expect(scheduler.readyQueue).toHaveLength(1);
    expect(scheduler.readyQueue[0].id).toBe('worker');
  });

  test('moves failed process to failed queue', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 1 });

    const process = new AgentProcess({
      id: 'bad',
      priority: 1,
      task: async () => {
        throw new Error('boom');
      },
    });

    scheduler.enqueue(process);

    await scheduler.tick();

    expect(scheduler.failed).toHaveLength(1);
    expect(scheduler.failed[0].id).toBe('bad');
    expect(scheduler.failed[0].error.message).toBe('boom');
  });

  test('moves over-quota process to paused queue', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 1 });

    const process = new AgentProcess({
      id: 'quota',
      priority: 1,
      quota: 0,
      task: async () => ({ done: false }),
    });

    scheduler.enqueue(process);

    await scheduler.tick();

    expect(scheduler.paused).toHaveLength(1);
    expect(scheduler.paused[0].id).toBe('quota');
    expect(scheduler.paused[0].status).toBe('paused');
  });

  test('throws backpressure error when ready queue is full', () => {
    const scheduler = new SchedulerKernel({
      maxConcurrent: 1,
      maxQueueDepth: 1,
    });

    const first = new AgentProcess({
      id: 'first',
      task: async () => ({ done: false }),
    });

    const second = new AgentProcess({
      id: 'second',
      task: async () => ({ done: false }),
    });

    scheduler.enqueue(first);

    expect(() => scheduler.enqueue(second)).toThrow(/Backpressure/);
  });

  test('respects maxConcurrent limit', async () => {
    const scheduler = new SchedulerKernel({ maxConcurrent: 2 });
    const started = [];

    const makeProcess = (id) =>
      new AgentProcess({
        id,
        priority: 1,
        task: async () => {
          started.push(id);
          return { done: true };
        },
      });

    scheduler.enqueue(makeProcess('one'));
    scheduler.enqueue(makeProcess('two'));
    scheduler.enqueue(makeProcess('three'));

    await scheduler.tick();

    expect(started).toHaveLength(2);
    expect(scheduler.completed).toHaveLength(2);
    expect(scheduler.readyQueue).toHaveLength(1);
  });
});

/**
 * SchedulerKernel manages schedulable AI processes.
 *
 * Responsibilities:
 * - priority ordering
 * - bounded concurrency
 * - ready queue backpressure
 * - process lifecycle routing
 * - paused-process resumption
 * - runtime event publication
 */
class SchedulerKernel {
  constructor({
    maxConcurrent = 1,
    maxQueueDepth = 100,
    eventBus = null,
    policyEngine = null,
  } = {}) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error('maxConcurrent must be an integer of at least 1');
    }

    if (!Number.isInteger(maxQueueDepth) || maxQueueDepth < 1) {
      throw new Error('maxQueueDepth must be an integer of at least 1');
    }

    if (
      policyEngine !== null &&
      typeof policyEngine.evaluate !== 'function'
    ) {
      throw new Error('policyEngine must provide an evaluate function');
    }

    this.maxConcurrent = maxConcurrent;
    this.maxQueueDepth = maxQueueDepth;
    this.eventBus = eventBus;
    this.policyEngine = policyEngine;

    this.readyQueue = [];
    this.running = new Map();
    this.completed = [];
    this.failed = [];
    this.paused = [];
  }

  enqueue(process) {
    if (!process || !process.id || typeof process.runNextStep !== 'function') {
      throw new Error('enqueue requires a valid schedulable process');
    }

    if (
      this.readyQueue.some((item) => item.id === process.id) ||
      this.running.has(process.id)
    ) {
      throw new Error(`Process ${process.id} is already scheduled`);
    }

    if (this.readyQueue.length >= this.maxQueueDepth) {
      throw new Error('Backpressure: ready queue is full');
    }

    if (process.status === 'paused') {
      process.status = 'ready';
    }

    if (process.status !== 'ready') {
      throw new Error(
        `Process ${process.id} cannot be enqueued from status ${process.status}`
      );
    }

    this.readyQueue.push(process);
    this.sortReadyQueue();

    this.publish('process.enqueued', {
      process: process.getStatusSummary
        ? process.getStatusSummary()
        : { id: process.id, status: process.status },
    });

    return process;
  }

  sortReadyQueue() {
    this.readyQueue.sort((a, b) => {
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }

  async tick(context = {}) {
    const jobs = [];

    while (
      this.running.size < this.maxConcurrent &&
      this.readyQueue.length > 0
    ) {
      const process = this.readyQueue.shift();

      if (!process) {
        continue;
      }

      if (process.status === 'completed' || process.status === 'failed') {
        continue;
      }

      this.running.set(process.id, process);

      const job = this.runProcess(process, context).finally(() => {
        this.running.delete(process.id);
      });

      jobs.push(job);
    }

    await Promise.all(jobs);

    return this.getStats();
  }

  async drain(context = {}, { maxTicks = 1000 } = {}) {
    if (!Number.isInteger(maxTicks) || maxTicks < 1) {
      throw new Error('maxTicks must be an integer of at least 1');
    }

    let ticks = 0;

    while (this.readyQueue.length > 0 || this.running.size > 0) {
      if (ticks >= maxTicks) {
        throw new Error(
          `Scheduler drain exceeded the maximum of ${maxTicks} ticks`
        );
      }

      await this.tick(context);
      ticks += 1;
    }

    return {
      ticks,
      ...this.getStats(),
    };
  }

  async runProcess(process, context = {}) {
    try {
      const policyDecision = await this.evaluatePolicy(process, context);

      if (!policyDecision.allowed) {
        process.status = 'paused';
        process.metadata = {
          ...(process.metadata || {}),
          policyDecision,
        };

        if (!this.paused.some((item) => item.id === process.id)) {
          this.paused.push(process);
        }

        this.publish('process.denied', {
          process: this.summarize(process),
          decision: policyDecision,
        });

        return {
          denied: true,
          decision: policyDecision,
        };
      }

      this.publish('process.started', {
        process: this.summarize(process),
      });

      const result = await process.runNextStep(context);

      if (process.status === 'completed') {
        this.completed.push(process);

        this.publish('process.completed', {
          process: this.summarize(process),
          result,
        });

        return;
      }

      if (process.status === 'paused') {
        this.paused.push(process);

        this.publish('process.paused', {
          process: this.summarize(process),
          result,
        });

        return;
      }

      if (process.status === 'ready') {
        // A process must leave the running collection before it can be
        // re-enqueued. The outer tick cleanup remains idempotent.
        this.running.delete(process.id);

        this.publish('process.requeued', {
          process: this.summarize(process),
          result,
        });

        this.enqueue(process);
      }
    } catch (error) {
      process.status = 'failed';
      process.error = error;

      if (!this.failed.some((item) => item.id === process.id)) {
        this.failed.push(process);
      }

      this.publish('process.failed', {
        process: this.summarize(process),
        error: {
          name: error.name,
          message: error.message,
        },
      });
    }
  }

  async evaluatePolicy(process, context = {}) {
    if (
      !this.policyEngine ||
      typeof this.policyEngine.evaluate !== 'function'
    ) {
      return {
        allowed: true,
        reason: 'No policy engine configured',
        deniedBy: null,
        evaluations: [],
      };
    }

    return this.policyEngine.evaluate({
      ...context,
      process,
      processId: process.id,
      agentId: process.agentId,
      capability: process.capability,
      scheduler: this,
    });
  }

  resume(processId, { additionalQuota = 0 } = {}) {
    const index = this.paused.findIndex((process) => process.id === processId);

    if (index === -1) {
      return null;
    }

    const [process] = this.paused.splice(index, 1);

    if (typeof process.resume === 'function') {
      process.resume({ additionalQuota });
    } else {
      process.status = 'ready';
    }

    this.enqueue(process);

    this.publish('process.resumed', {
      process: this.summarize(process),
    });

    return process;
  }

  getProcess(processId) {
    return (
      this.running.get(processId) ||
      this.readyQueue.find((process) => process.id === processId) ||
      this.completed.find((process) => process.id === processId) ||
      this.failed.find((process) => process.id === processId) ||
      this.paused.find((process) => process.id === processId) ||
      null
    );
  }

  getStats() {
    return {
      maxConcurrent: this.maxConcurrent,
      maxQueueDepth: this.maxQueueDepth,
      ready: this.readyQueue.length,
      running: this.running.size,
      completed: this.completed.length,
      failed: this.failed.length,
      paused: this.paused.length,
    };
  }

  reset() {
    this.readyQueue = [];
    this.running.clear();
    this.completed = [];
    this.failed = [];
    this.paused = [];

    this.publish('scheduler.reset', {
      stats: this.getStats(),
    });
  }

  summarize(process) {
    return process && typeof process.getStatusSummary === 'function'
      ? process.getStatusSummary()
      : {
          id: process && process.id,
          status: process && process.status,
        };
  }

  publish(type, payload = {}) {
    if (!this.eventBus || typeof this.eventBus.publish !== 'function') {
      return;
    }

    this.eventBus.publish(type, payload);
  }
}

module.exports = SchedulerKernel;


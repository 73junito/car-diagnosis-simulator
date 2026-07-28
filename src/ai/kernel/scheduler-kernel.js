/**
 * SchedulerKernel manages AI OS process scheduling.
 *
 * Features:
 * - Priority scheduling
 * - Max concurrency
 * - Requeue unfinished work
 * - Completed / failed / paused lifecycle queues
 * - Queue backpressure
 */
class SchedulerKernel {
  constructor({ maxConcurrent = 1, maxQueueDepth = 100 } = {}) {
    if (maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1');
    }

    if (maxQueueDepth < 1) {
      throw new Error('maxQueueDepth must be at least 1');
    }

    this.maxConcurrent = maxConcurrent;
    this.maxQueueDepth = maxQueueDepth;

    this.readyQueue = [];
    this.running = new Map();
    this.completed = [];
    this.failed = [];
    this.paused = [];
  }

  enqueue(process) {
    if (!process || !process.id) {
      throw new Error('enqueue requires a valid process');
    }

    if (this.readyQueue.length >= this.maxQueueDepth) {
      throw new Error('Backpressure: ready queue is full');
    }

    process.status = process.status === 'paused' ? 'ready' : process.status;
    this.readyQueue.push(process);
    this.sortReadyQueue();

    return process;
  }

  sortReadyQueue() {
    this.readyQueue.sort((a, b) => {
      const priorityDelta = b.priority - a.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }

  async tick(context = {}) {
    const jobs = [];

    while (this.running.size < this.maxConcurrent && this.readyQueue.length > 0) {
      const process = this.readyQueue.shift();

      if (!process || process.status === 'completed' || process.status === 'failed') {
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

  async runProcess(process, context = {}) {
    try {
      await process.runNextStep(context);

      if (process.status === 'completed') {
        this.completed.push(process);
        return;
      }

      if (process.status === 'paused') {
        this.paused.push(process);
        return;
      }

      if (process.status === 'ready') {
        this.enqueue(process);
      }
    } catch (error) {
      process.status = 'failed';
      process.error = error;
      this.failed.push(process);
    }
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
  }
}

module.exports = SchedulerKernel;

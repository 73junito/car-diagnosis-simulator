/**
 * AgentProcess Class - Manages individual process lifecycle in AI OS Kernel
 */

/**
 * AgentProcess manages one schedulable AI OS process.
 */
class AgentProcess {
  constructor({
    id,
    name = id,
    priority = 1,
    quota = 10,
    timeSliceMs = 1000,
    task,
  }) {
    if (!id) {
      throw new Error('AgentProcess requires an id');
    }

    if (typeof task !== 'function') {
      throw new Error('AgentProcess requires a task function');
    }

    this.id = id;
    this.name = name;
    this.priority = priority;
    this.quota = quota;
    this.timeSliceMs = timeSliceMs;
    this.task = task;

    this.status = 'ready';
    this.stepsUsed = 0;
    this.error = null;
  }

  async runNextStep(context = {}) {
    if (this.stepsUsed >= this.quota) {
      this.status = 'paused';
      return {
        done: false,
        reason: 'quota_exceeded',
      };
    }

    try {
      const result = await this.task(context);

      this.stepsUsed += 1;

      if (result && result.done === true) {
        this.status = 'completed';
        return result;
      }

      this.status = 'ready';

      return {
        done: false,
      };
    } catch (error) {
      this.status = 'failed';
      this.error = error;
      throw error;
    }
  }

  isRunnable() {
    return this.status === 'ready' && this.stepsUsed < this.quota;
  }

  getStatusSummary() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      quota: this.quota,
      stepsUsed: this.stepsUsed,
      remainingQuota: Math.max(0, this.quota - this.stepsUsed),
      status: this.status,
      error: this.error ? this.error.message : null,
    };
  }
}

module.exports = AgentProcess;

/**
 * A schedulable unit of AI runtime work.
 *
 * AgentProcess owns the lifecycle of a single task:
 * ready -> running -> completed
 * ready -> running -> ready
 * ready -> paused
 * ready -> running -> failed
 */
class AgentProcess {
  constructor({
    id,
    name = id,
    agentId = null,
    capability = null,
    priority = 1,
    quota = 10,
    timeSliceMs = 1000,
    metadata = {},
    task,
  }) {
    if (!id || typeof id !== 'string') {
      throw new Error('AgentProcess requires a non-empty string id');
    }

    if (typeof task !== 'function') {
      throw new Error('AgentProcess requires a task function');
    }

    if (!Number.isFinite(priority)) {
      throw new Error('AgentProcess priority must be a finite number');
    }

    if (!Number.isInteger(quota) || quota < 0) {
      throw new Error('AgentProcess quota must be a non-negative integer');
    }

    if (!Number.isFinite(timeSliceMs) || timeSliceMs <= 0) {
      throw new Error('AgentProcess timeSliceMs must be greater than zero');
    }

    this.id = id;
    this.name = name || id;
    this.agentId = agentId;
    this.capability = capability;
    this.priority = priority;
    this.quota = quota;
    this.timeSliceMs = timeSliceMs;
    this.metadata = { ...metadata };
    this.task = task;

    this.status = 'ready';
    this.stepsUsed = 0;
    this.result = null;
    this.error = null;
    this.createdAt = new Date().toISOString();
    this.startedAt = null;
    this.finishedAt = null;
  }

  async runNextStep(context = {}) {
    if (this.status === 'completed') {
      return {
        done: true,
        result: this.result,
        reason: 'already_completed',
      };
    }

    if (this.status === 'failed') {
      throw this.error || new Error(`Process ${this.id} has already failed`);
    }

    if (this.stepsUsed >= this.quota) {
      this.status = 'paused';

      return {
        done: false,
        reason: 'quota_exceeded',
      };
    }

    this.status = 'running';
    this.startedAt = this.startedAt || new Date().toISOString();

    try {
      const result = await this.task(context, this);

      this.stepsUsed += 1;

      if (result && result.done === true) {
        this.status = 'completed';
        this.result = result;
        this.finishedAt = new Date().toISOString();

        return result;
      }

      this.status = 'ready';

      return {
        done: false,
        result: result || null,
      };
    } catch (error) {
      this.status = 'failed';
      this.error = error;
      this.finishedAt = new Date().toISOString();

      throw error;
    }
  }

  pause() {
    if (this.status === 'completed' || this.status === 'failed') {
      return false;
    }

    this.status = 'paused';
    return true;
  }

  resume({ additionalQuota = 0 } = {}) {
    if (this.status !== 'paused') {
      return false;
    }

    if (!Number.isInteger(additionalQuota) || additionalQuota < 0) {
      throw new Error('additionalQuota must be a non-negative integer');
    }

    this.quota += additionalQuota;
    this.status = 'ready';

    return true;
  }

  isRunnable() {
    return this.status === 'ready' && this.stepsUsed < this.quota;
  }

  getStatusSummary() {
    return {
      id: this.id,
      name: this.name,
      agentId: this.agentId,
      capability: this.capability,
      priority: this.priority,
      quota: this.quota,
      stepsUsed: this.stepsUsed,
      remainingQuota: Math.max(0, this.quota - this.stepsUsed),
      status: this.status,
      result: this.result,
      error: this.error ? this.error.message : null,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      metadata: { ...this.metadata },
    };
  }
}

module.exports = AgentProcess;

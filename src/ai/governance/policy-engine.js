/**
 * PolicyEngine evaluates runtime policies before work is executed.
 *
 * A policy is an object with:
 * - id: unique string identifier
 * - priority: optional numeric ordering value
 * - evaluate(context): synchronous or asynchronous decision function
 *
 * Policy decisions may return:
 * - true                       -> allow
 * - false                      -> deny
 * - { allowed, reason, data }  -> structured decision
 */
class PolicyEngine {
  constructor({ defaultDecision = 'allow', eventBus = null } = {}) {
    if (!['allow', 'deny'].includes(defaultDecision)) {
      throw new Error('defaultDecision must be either allow or deny');
    }

    this.defaultDecision = defaultDecision;
    this.eventBus = eventBus;
    this.policies = new Map();
  }

  register(policy) {
    if (!policy || typeof policy !== 'object') {
      throw new Error('PolicyEngine.register requires a policy object');
    }

    if (!policy.id || typeof policy.id !== 'string') {
      throw new Error('Policy requires a non-empty string id');
    }

    if (typeof policy.evaluate !== 'function') {
      throw new Error(`Policy ${policy.id} requires an evaluate function`);
    }

    if (this.policies.has(policy.id)) {
      throw new Error(`Policy ${policy.id} is already registered`);
    }

    const normalized = {
      id: policy.id,
      description: policy.description || '',
      priority: Number.isFinite(policy.priority) ? policy.priority : 0,
      enabled: policy.enabled !== false,
      evaluate: policy.evaluate,
      metadata: { ...(policy.metadata || {}) },
    };

    this.policies.set(normalized.id, normalized);

    this.publish('policy.registered', {
      policy: this.summarize(normalized),
    });

    return normalized;
  }

  unregister(policyId) {
    const policy = this.policies.get(policyId);

    if (!policy) {
      return false;
    }

    this.policies.delete(policyId);

    this.publish('policy.unregistered', {
      policy: this.summarize(policy),
    });

    return true;
  }

  enable(policyId) {
    return this.setEnabled(policyId, true);
  }

  disable(policyId) {
    return this.setEnabled(policyId, false);
  }

  setEnabled(policyId, enabled) {
    const policy = this.policies.get(policyId);

    if (!policy) {
      return false;
    }

    policy.enabled = Boolean(enabled);

    this.publish(
      policy.enabled ? 'policy.enabled' : 'policy.disabled',
      {
        policy: this.summarize(policy),
      }
    );

    return true;
  }

  get(policyId) {
    return this.policies.get(policyId) || null;
  }

  list() {
    return this.getOrderedPolicies().map((policy) =>
      this.summarize(policy)
    );
  }

  async evaluate(context = {}) {
    const activePolicies = this.getOrderedPolicies().filter(
      (policy) => policy.enabled
    );

    if (activePolicies.length === 0) {
      return this.createDefaultDecision();
    }

    const evaluations = [];

    for (const policy of activePolicies) {
      let rawDecision;

      try {
        rawDecision = await policy.evaluate(context);
      } catch (error) {
        const result = {
          policyId: policy.id,
          allowed: false,
          reason: `Policy evaluation failed: ${error.message}`,
          data: null,
          error: {
            name: error.name,
            message: error.message,
          },
        };

        evaluations.push(result);

        const decision = {
          allowed: false,
          reason: result.reason,
          deniedBy: policy.id,
          evaluations,
        };

        this.publish('policy.denied', {
          context: this.summarizeContext(context),
          decision,
        });

        return decision;
      }

      const result = this.normalizeDecision(policy, rawDecision);
      evaluations.push(result);

      if (!result.allowed) {
        const decision = {
          allowed: false,
          reason: result.reason || `Denied by policy ${policy.id}`,
          deniedBy: policy.id,
          evaluations,
        };

        this.publish('policy.denied', {
          context: this.summarizeContext(context),
          decision,
        });

        return decision;
      }
    }

    const decision = {
      allowed: true,
      reason: 'All active policies allowed execution',
      deniedBy: null,
      evaluations,
    };

    this.publish('policy.allowed', {
      context: this.summarizeContext(context),
      decision,
    });

    return decision;
  }

  getOrderedPolicies() {
    return Array.from(this.policies.values()).sort((a, b) => {
      const priorityDelta = b.priority - a.priority;

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return a.id.localeCompare(b.id);
    });
  }

  normalizeDecision(policy, decision) {
    if (decision === true) {
      return {
        policyId: policy.id,
        allowed: true,
        reason: null,
        data: null,
      };
    }

    if (decision === false) {
      return {
        policyId: policy.id,
        allowed: false,
        reason: `Denied by policy ${policy.id}`,
        data: null,
      };
    }

    if (decision && typeof decision === 'object') {
      return {
        policyId: policy.id,
        allowed: decision.allowed === true,
        reason: decision.reason || null,
        data: decision.data || null,
      };
    }

    throw new Error(
      `Policy ${policy.id} returned an invalid decision`
    );
  }

  createDefaultDecision() {
    const allowed = this.defaultDecision === 'allow';

    const decision = {
      allowed,
      reason: `No active policies; default decision is ${this.defaultDecision}`,
      deniedBy: allowed ? null : 'default',
      evaluations: [],
    };

    this.publish(
      allowed ? 'policy.allowed' : 'policy.denied',
      {
        context: {},
        decision,
      }
    );

    return decision;
  }

  summarize(policy) {
    return {
      id: policy.id,
      description: policy.description,
      priority: policy.priority,
      enabled: policy.enabled,
      metadata: { ...policy.metadata },
    };
  }

  summarizeContext(context) {
    return {
      processId:
        context.processId ||
        (context.process && context.process.id) ||
        null,
      agentId:
        context.agentId ||
        (context.process && context.process.agentId) ||
        null,
      capability:
        context.capability ||
        (context.process && context.process.capability) ||
        null,
    };
  }

  publish(type, payload = {}) {
    if (!this.eventBus || typeof this.eventBus.publish !== 'function') {
      return;
    }

    this.eventBus.publish(type, payload);
  }
}

module.exports = PolicyEngine;

'use strict';

class WorkflowStateMachine {
  constructor(definition) {
    if (!definition || typeof definition !== 'object') {
      throw new Error('WorkflowStateMachine requires a definition');
    }
    this.definition = definition;
    this.states = new Set(definition.states || []);
    this.transitions = Array.isArray(definition.transitions)
      ? definition.transitions.map((transition) => ({ ...transition }))
      : [];
  }

  getTransition(from, to) {
    return this.transitions.find(
      (transition) => transition.from === from && transition.to === to
    ) || null;
  }

  canTransition({ from, to, actor, explicitHumanApproval = false, runtimeVerified = false } = {}) {
    if (!this.states.has(from) || !this.states.has(to)) {
      return { allowed: false, reason: 'Unknown workflow state' };
    }

    const transition = this.getTransition(from, to);
    if (!transition) {
      return { allowed: false, reason: 'Transition is not defined' };
    }

    if (!transition.actors.includes(actor)) {
      return { allowed: false, reason: 'Actor is not authorized for transition' };
    }

    if (transition.requires_explicit_human_approval && !explicitHumanApproval) {
      return { allowed: false, reason: 'Explicit human approval is required' };
    }

    if (transition.requires_runtime_verification && !runtimeVerified) {
      return { allowed: false, reason: 'Runtime verification is required' };
    }

    return { allowed: true, reason: 'Transition allowed', transition: { ...transition } };
  }

  transition(request = {}) {
    const decision = this.canTransition(request);
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }
    return {
      from: request.from,
      to: request.to,
      actor: request.actor,
      explicitHumanApproval: request.explicitHumanApproval === true,
      runtimeVerified: request.runtimeVerified === true,
    };
  }
}

module.exports = WorkflowStateMachine;

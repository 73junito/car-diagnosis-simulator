'use strict';

const crypto = require('crypto');
const foundation = require('../../../data/architecture/agent-orchestration-foundation.json');
const finalApprovalContract = require('../../../data/architecture/agent-orchestration-native-final-content-approval.json');
const { assertGovernanceConstantsResolved } = require('./native-final-content-approval');
const WorkflowStateMachine = require('../governance/workflow-state-machine');
const AgentGovernanceCatalog = require('../governance/agent-governance-catalog');

class PersistentGovernanceRuntime {
  constructor({ coordinator, definition = foundation, stateMachine, catalog } = {}) {
    if (!coordinator) throw new Error('PersistentGovernanceRuntime requires coordinator');
    this.coordinator = coordinator;
    this.stateMachine = stateMachine || new WorkflowStateMachine(definition);
    this.catalog = catalog || new AgentGovernanceCatalog(definition);
  }

  async entries(runId) {
    return this.coordinator.store.loadEntries(runId);
  }

  async latest(runId) {
    const entries = await this.entries(runId);
    return entries.length ? entries[entries.length - 1] : null;
  }

  validateStep({ runId, agent, capability, from, to, handoffId = null, latest }) {
    if (!runId || !agent || !capability || !from || !to) throw new Error('Governed step is incomplete');
    if (!this.catalog.get(agent.id) || !this.catalog.can(agent.id, 'prepare')) throw new Error('Governed agent is not permitted');
    if (!this.catalog.provides(agent.id, capability)) throw new Error('Governed capability is not permitted');
    if (latest && latest.state !== from) throw new Error('Governed run state does not match latest ledger state');

    if (latest && latest.action === 'handoff-recorded') {
      const handoff = latest.metadata || {};
      if (!handoffId || handoff.handoffId !== handoffId || handoff.toAgentId !== agent.id || handoff.capability !== capability) {
        throw new Error('Governed handoff does not authorize this step');
      }
    } else if (handoffId) {
      throw new Error('Governed handoff record is not current');
    } else if (latest && latest.action === 'step-finished' && latest.actor !== agent.id) {
      throw new Error('Governed agent-to-agent handoff is required');
    }

    const decision = this.stateMachine.canTransition({ from, to, actor: agent.id });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);
    return decision;
  }

  async checkStep(step) {
    const latest = await this.latest(step.runId);
    if (!latest) {
      throw new Error('Persistent governed run requires prior governance state');
    }
    return this.validateStep({ ...step, latest });
  }

  async findByRequest(runId, action, requestId) {
    const entries = await this.entries(runId);
    return entries.find((entry) =>
      entry.action === action &&
      entry.metadata &&
      entry.metadata.requestId === requestId
    ) || null;
  }

  async appendAndCheckpoint(entry) {
    const appended = await this.coordinator.append(entry);
    await this.coordinator.recover(entry.runId);
    return appended;
  }

  async initializeDraft({ runId, actor = 'question-agent', provenanceId, questionId, createdAt, initializationEvidence }) {
    if (!runId || !provenanceId || !questionId || !createdAt) {
      throw new Error('Draft initialization record is incomplete');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'draft-initialized' &&
      entry.state === 'drafted' &&
      entry.metadata &&
      entry.metadata.provenanceId === provenanceId &&
      entry.metadata.questionId === questionId
    );
    if (existing) return existing;
    if (entries.length) {
      throw new Error('Draft initialization requires an empty governed run');
    }
    if (actor !== 'question-agent') {
      throw new Error('Draft initialization actor is not permitted');
    }
    if (!this.catalog.get(actor) || !this.catalog.can(actor, 'prepare')) {
      throw new Error('Draft initialization actor is not governed');
    }

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'draft-initialized',
      state: 'drafted',
      recordedAt: createdAt,
      metadata: {
        provenanceId,
        questionId,
        initializationEvidence: initializationEvidence || `question_provenance:${provenanceId}`,
        initialState: true,
        humanApproval: false,
      },
    });
  }

  async recordEvidenceMapping({ runId, actor = 'evidence-agent', provenanceId, questionId, citationCount, mappingEvidence }) {
    if (!runId || !provenanceId || !questionId || !Number.isInteger(citationCount) || citationCount < 1) {
      throw new Error('Evidence mapping record is incomplete');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'evidence-mapping-recorded' &&
      entry.state === 'evidence_mapped' &&
      entry.metadata &&
      entry.metadata.provenanceId === provenanceId &&
      entry.metadata.questionId === questionId
    );
    if (existing) return existing;

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest) {
      throw new Error('Evidence mapping requires an initialized governed run');
    }
    if (latest.action !== 'draft-initialized' || latest.state !== 'drafted') {
      throw new Error('Evidence mapping requires the drafted state');
    }
    if (actor !== 'evidence-agent') {
      throw new Error('Evidence mapping actor is not permitted');
    }
    if (!this.catalog.get(actor) || !this.catalog.can(actor, 'prepare')) {
      throw new Error('Evidence mapping actor is not governed');
    }

    const decision = this.stateMachine.canTransition({
      from: 'drafted',
      to: 'evidence_mapped',
      actor,
    });
    if (!decision.allowed) {
      throw new Error('Governed transition denied: ' + decision.reason);
    }

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'evidence-mapping-recorded',
      state: 'evidence_mapped',
      metadata: {
        provenanceId,
        questionId,
        citationCount,
        mappingEvidence: mappingEvidence || `question_citations:provenance:${provenanceId}`,
        humanApproval: false,
      },
    });
  }

  async recordRightsReview({
    runId,
    actor = 'rights-agent',
    provenanceId,
    questionId,
    sourceCount,
    rightsEvidenceHash,
    rightsEvidence,
  }) {
    if (
      !runId ||
      !provenanceId ||
      !questionId ||
      !Number.isInteger(sourceCount) ||
      sourceCount < 1 ||
      !/^[0-9a-f]{64}$/.test(rightsEvidenceHash || '') ||
      !Array.isArray(rightsEvidence) ||
      rightsEvidence.length !== sourceCount
    ) {
      throw new Error('Rights review record is incomplete');
    }

    const computedRightsEvidenceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(rightsEvidence))
      .digest('hex');
    if (computedRightsEvidenceHash !== rightsEvidenceHash) {
      throw new Error('Rights review evidence hash does not match the supplied evidence');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'rights-review-recorded' &&
      entry.state === 'rights_reviewed' &&
      entry.metadata?.provenanceId === provenanceId &&
      entry.metadata?.questionId === questionId
    );
    if (existing) {
      if (
        existing.metadata?.sourceCount !== sourceCount ||
        existing.metadata?.rightsEvidenceHash !== rightsEvidenceHash
      ) {
        throw new Error('Existing rights review evidence does not match current human-reviewed rights evidence');
      }
      return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest) throw new Error('Rights review requires an initialized governed run');
    if (latest.action !== 'evidence-mapping-recorded' || latest.state !== 'evidence_mapped') {
      throw new Error('Rights review requires the evidence_mapped state');
    }
    if (actor !== 'rights-agent') throw new Error('Rights review actor is not permitted');
    if (
      !this.catalog.get(actor) ||
      !this.catalog.can(actor, 'prepare') ||
      !this.catalog.provides(actor, 'rights-review')
    ) {
      throw new Error('Rights review actor is not governed');
    }

    const decision = this.stateMachine.canTransition({
      from: 'evidence_mapped',
      to: 'rights_reviewed',
      actor,
    });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'rights-review-recorded',
      state: 'rights_reviewed',
      metadata: {
        provenanceId,
        questionId,
        sourceCount,
        rightsEvidenceHash,
        rightsEvidence,
        existingHumanRightsReviewsBound: true,
        newHumanDecision: false,
        humanApproval: false,
      },
    });
  }

  async recordTechnicalReview({
    runId,
    actor = 'technical-review-agent',
    provenanceId,
    questionId,
    reviewEvidenceHash,
    reviewEvidence,
  }) {
    if (
      !runId ||
      !provenanceId ||
      !questionId ||
      !/^[0-9a-f]{64}$/.test(reviewEvidenceHash || '') ||
      !reviewEvidence ||
      reviewEvidence.decision !== 'pass'
    ) {
      throw new Error('Technical review record is incomplete');
    }

    const computedHash = crypto.createHash('sha256')
      .update(JSON.stringify(reviewEvidence))
      .digest('hex');
    if (computedHash !== reviewEvidenceHash) {
      throw new Error('Technical review evidence hash does not match supplied evidence');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'technical-review-recorded' &&
      entry.state === 'technically_reviewed' &&
      entry.metadata?.provenanceId === provenanceId &&
      entry.metadata?.questionId === questionId
    );
    if (existing) {
      if (existing.metadata?.reviewEvidenceHash !== reviewEvidenceHash) {
        throw new Error('Existing technical review evidence does not match current human review');
      }
      return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'rights-review-recorded' || latest.state !== 'rights_reviewed') {
      throw new Error('Technical review requires the rights_reviewed state');
    }
    if (actor !== 'technical-review-agent') throw new Error('Technical review actor is not permitted');
    if (
      !this.catalog.get(actor) ||
      !this.catalog.can(actor, 'prepare') ||
      !this.catalog.provides(actor, 'technical-review-preparation')
    ) {
      throw new Error('Technical review actor is not governed');
    }

    const decision = this.stateMachine.canTransition({
      from: 'rights_reviewed',
      to: 'technically_reviewed',
      actor,
    });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'technical-review-recorded',
      state: 'technically_reviewed',
      metadata: {
        provenanceId,
        questionId,
        reviewEvidenceHash,
        reviewerIdentity: reviewEvidence.reviewerId,
        reviewedAt: reviewEvidence.reviewedAt,
        payloadSha256: reviewEvidence.payloadSha256,
        humanTechnicalDecisionBound: true,
        agentSynthesizedDecision: false,
        humanApproval: false,
      },
    });
  }

  async recordCitationValidation({
    runId,
    actor = 'evidence-agent',
    provenanceId,
    questionId,
    citationCount,
    citationSetHash,
    validationEvidenceHash,
    validationEvidence,
  }) {
    if (
      !runId ||
      !provenanceId ||
      !questionId ||
      !Number.isInteger(citationCount) ||
      citationCount < 1 ||
      !/^[0-9a-f]{64}$/.test(citationSetHash || '') ||
      !/^[0-9a-f]{64}$/.test(validationEvidenceHash || '') ||
      !validationEvidence ||
      validationEvidence.result !== 'valid'
    ) {
      throw new Error('Citation validation record is incomplete');
    }

    const computedHash = crypto.createHash('sha256')
      .update(JSON.stringify(validationEvidence))
      .digest('hex');
    if (computedHash !== validationEvidenceHash) {
      throw new Error('Citation validation evidence hash does not match supplied evidence');
    }
    if (
      validationEvidence.citationCount !== citationCount ||
      validationEvidence.citationSetHash !== citationSetHash ||
      validationEvidence.sourceHashesVerified !== true ||
      validationEvidence.excerptsVerified !== true ||
      validationEvidence.urlsVerified !== true
    ) {
      throw new Error('Citation validation evidence is not fully valid');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'citation-validation-recorded' &&
      entry.state === 'citation_validated' &&
      entry.metadata?.provenanceId === provenanceId &&
      entry.metadata?.questionId === questionId
    );
    if (existing) {
      if (
        existing.metadata?.citationCount !== citationCount ||
        existing.metadata?.citationSetHash !== citationSetHash ||
        existing.metadata?.validationEvidenceHash !== validationEvidenceHash
      ) {
        throw new Error('Existing citation validation evidence does not match current validation');
      }
      return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'technical-review-recorded' || latest.state !== 'technically_reviewed') {
      throw new Error('Citation validation requires the technically_reviewed state');
    }
    if (actor !== 'evidence-agent') throw new Error('Citation validation actor is not permitted');
    if (
      !this.catalog.get(actor) ||
      !this.catalog.can(actor, 'prepare') ||
      !this.catalog.provides(actor, 'citation-validation')
    ) {
      throw new Error('Citation validation actor is not governed');
    }

    const decision = this.stateMachine.canTransition({
      from: 'technically_reviewed',
      to: 'citation_validated',
      actor,
    });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'citation-validation-recorded',
      state: 'citation_validated',
      metadata: {
        provenanceId,
        questionId,
        citationCount,
        citationSetHash,
        validationEvidenceHash,
        validatorVersion: validationEvidence.validatorVersion,
        validatedAt: validationEvidence.validatedAt,
        humanApproval: false,
      },
    });
  }


  async recordInstructionalReview({
    runId,
    actor = 'instructional-review-agent',
    provenanceId,
    questionId,
    reviewEvidenceHash,
    reviewEvidence,
  }) {
    if (
      !runId ||
      !provenanceId ||
      !questionId ||
      !/^[0-9a-f]{64}$/.test(reviewEvidenceHash || '') ||
      !reviewEvidence ||
      reviewEvidence.decision !== 'pass' ||
      !/^[0-9a-f]{64}$/.test(reviewEvidence.payloadSha256 || '') ||
      !/^[0-9a-f]{64}$/.test(reviewEvidence.citationSetHash || '') ||
      !/^[0-9a-f]{64}$/.test(reviewEvidence.citationValidationEvidenceHash || '')
    ) {
      throw new Error('Instructional review record is incomplete');
    }

    const computedHash = crypto.createHash('sha256')
      .update(JSON.stringify(reviewEvidence))
      .digest('hex');
    if (computedHash !== reviewEvidenceHash) {
      throw new Error('Instructional review evidence hash does not match supplied evidence');
    }
    if (
      reviewEvidence.reviewerId === reviewEvidence.technicalReviewerId ||
      reviewEvidence.reviewerRole !== 'instructional_reviewer'
    ) {
      throw new Error('Instructional review evidence does not preserve reviewer independence');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'instructional-review-recorded' &&
      entry.state === 'instructionally_reviewed' &&
      entry.metadata?.provenanceId === provenanceId &&
      entry.metadata?.questionId === questionId
    );
    if (existing) {
      if (
        existing.metadata?.reviewEvidenceHash !== reviewEvidenceHash ||
        existing.metadata?.payloadSha256 !== reviewEvidence.payloadSha256 ||
        existing.metadata?.citationSetHash !== reviewEvidence.citationSetHash ||
        existing.metadata?.citationValidationEvidenceHash !== reviewEvidence.citationValidationEvidenceHash
      ) {
        throw new Error('Existing instructional review evidence does not match current human review');
      }
      return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'citation-validation-recorded' || latest.state !== 'citation_validated') {
      throw new Error('Instructional review requires the citation_validated state');
    }
    if (
      latest.metadata?.citationSetHash !== reviewEvidence.citationSetHash ||
      latest.metadata?.validationEvidenceHash !== reviewEvidence.citationValidationEvidenceHash
    ) {
      throw new Error('Instructional review evidence is not bound to the current citation validation');
    }
    if (actor !== 'instructional-review-agent') throw new Error('Instructional review actor is not permitted');
    if (
      !this.catalog.get(actor) ||
      !this.catalog.can(actor, 'prepare') ||
      !this.catalog.provides(actor, 'instructional-review-preparation')
    ) {
      throw new Error('Instructional review actor is not governed');
    }

    const decision = this.stateMachine.canTransition({
      from: 'citation_validated',
      to: 'instructionally_reviewed',
      actor,
    });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'instructional-review-recorded',
      state: 'instructionally_reviewed',
      metadata: {
        provenanceId,
        questionId,
        reviewEvidenceHash,
        reviewerIdentity: reviewEvidence.reviewerId,
        technicalReviewerIdentity: reviewEvidence.technicalReviewerId,
        reviewedAt: reviewEvidence.reviewedAt,
        payloadSha256: reviewEvidence.payloadSha256,
        citationSetHash: reviewEvidence.citationSetHash,
        citationValidationEvidenceHash: reviewEvidence.citationValidationEvidenceHash,
        humanInstructionalDecisionBound: true,
        agentSynthesizedDecision: false,
        humanApproval: false,
      },
    });
  }

  async recordFinalContentApproval({
    runId,
    actor = 'human',
    provenanceId,
    questionId,
    approvalEvidenceHash,
    approvalEvidence,
    contract = finalApprovalContract,
  }) {
    assertGovernanceConstantsResolved(contract);

    if (
      !runId ||
      !provenanceId ||
      !questionId ||
      !/^[0-9a-f]{64}$/.test(approvalEvidenceHash || '') ||
      !approvalEvidence ||
      approvalEvidence.decision !== 'approve' ||
      !/^[0-9a-f]{64}$/.test(approvalEvidence.payloadSha256 || '') ||
      !/^[0-9a-f]{64}$/.test(approvalEvidence.citationSetHash || '') ||
      !/^[0-9a-f]{64}$/.test(approvalEvidence.citationValidationEvidenceHash || '')
    ) {
      throw new Error('Final content approval record is incomplete');
    }

    const computedHash = crypto.createHash('sha256')
      .update(JSON.stringify(approvalEvidence))
      .digest('hex');
    if (computedHash !== approvalEvidenceHash) {
      throw new Error('Final content approval evidence hash does not match supplied evidence');
    }
    if (
      approvalEvidence.reviewerId === approvalEvidence.technicalReviewerId ||
      approvalEvidence.reviewerId === approvalEvidence.instructionalReviewerId
    ) {
      throw new Error('Final content approver must be independent from the technical and instructional reviewers');
    }

    const entries = await this.entries(runId);
    const existing = entries.find((entry) =>
      entry.action === 'final-content-approval-recorded' &&
      entry.state === 'final_content_approved' &&
      entry.metadata?.provenanceId === provenanceId &&
      entry.metadata?.questionId === questionId
    );
    if (existing) {
      if (existing.metadata?.approvalEvidenceHash !== approvalEvidenceHash) {
        throw new Error('Existing final content approval evidence does not match the current human decision');
      }
      return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'instructional-review-recorded' || latest.state !== 'instructionally_reviewed') {
      throw new Error('Final content approval requires the instructionally_reviewed state');
    }
    if (
      latest.metadata?.provenanceId !== provenanceId ||
      latest.metadata?.questionId !== questionId ||
      latest.metadata?.payloadSha256 !== approvalEvidence.payloadSha256 ||
      latest.metadata?.citationSetHash !== approvalEvidence.citationSetHash ||
      latest.metadata?.citationValidationEvidenceHash !== approvalEvidence.citationValidationEvidenceHash
    ) {
      throw new Error('Final content approval evidence is not bound to the current instructional review');
    }
    if (actor !== 'human') throw new Error('Final content approval actor must be the human approver');

    const decision = this.stateMachine.canTransition({
      from: 'instructionally_reviewed',
      to: 'final_content_approved',
      actor,
      explicitHumanApproval: true,
    });
    if (!decision.allowed) throw new Error('Governed transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor,
      action: 'final-content-approval-recorded',
      state: 'final_content_approved',
      metadata: {
        provenanceId,
        questionId,
        approvalEvidenceHash,
        approverIdentity: approvalEvidence.reviewerId,
        reviewedAt: approvalEvidence.reviewedAt,
        checklistVersion: approvalEvidence.checklistVersion,
        payloadSha256: approvalEvidence.payloadSha256,
        citationSetHash: approvalEvidence.citationSetHash,
        citationValidationEvidenceHash: approvalEvidence.citationValidationEvidenceHash,
        humanFinalApprovalBound: true,
        agentSynthesizedDecision: false,
        humanApproval: true,
      },
    });
  }

  async recordStart({ runId, agentId, capability, from, to, requestId }) {
    const existing = await this.findByRequest(runId, 'step-started', requestId);
    if (existing) return existing;
    return this.appendAndCheckpoint({
      runId,
      actor: agentId,
      action: 'step-started',
      state: from,
      metadata: { capability, from, to, requestId },
    });
  }

  async recordFinish({ runId, agentId, capability, from, to, requestId }) {
    const existing = await this.findByRequest(runId, 'step-finished', requestId);
    if (existing) return existing;
    return this.appendAndCheckpoint({
      runId,
      actor: agentId,
      action: 'step-finished',
      state: to,
      metadata: { capability, from, to, requestId },
    });
  }

  async recordHandoff({ runId, fromAgentId, toAgentId, capability, state, handoffId = null }) {
    const entries = await this.entries(runId);
    if (handoffId) {
      const existing = entries.find((entry) =>
        entry.action === 'handoff-recorded' &&
        entry.metadata &&
        entry.metadata.handoffId === handoffId
      );
      if (existing) return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (!latest || latest.action !== 'step-finished' || latest.actor !== fromAgentId || latest.state !== state) {
      throw new Error('Handoff must follow the completed source-agent step');
    }
    if (!this.catalog.get(toAgentId)) throw new Error('Handoff target agent is not governed');
    if (!this.catalog.provides(toAgentId, capability)) throw new Error('Handoff target capability is not governed');

    const id = handoffId || (typeof crypto.randomUUID === 'function'
      ? `handoff-${crypto.randomUUID()}`
      : `handoff-${Date.now()}`);

    return this.appendAndCheckpoint({
      runId,
      actor: fromAgentId,
      action: 'handoff-recorded',
      state,
      metadata: { handoffId: id, fromAgentId, toAgentId, capability },
    });
  }

  async recordHumanTransition({ runId, from, to, reviewerIdentity, reviewedAt, runtimeVerified = false, approvalEvidence = null }) {
    if (!runId || !reviewerIdentity || !reviewedAt) throw new Error('Human approval record is incomplete');

    const entries = await this.entries(runId);
    if (approvalEvidence) {
      const existing = entries.find((entry) =>
        entry.action === 'human-approval-recorded' &&
        entry.metadata &&
        entry.metadata.approvalEvidence === approvalEvidence
      );
      if (existing) return existing;
    }

    const latest = entries.length ? entries[entries.length - 1] : null;
    if (latest && latest.state !== from) throw new Error('Human approval state does not match latest ledger state');

    const decision = this.stateMachine.canTransition({
      from,
      to,
      actor: 'human',
      explicitHumanApproval: true,
      runtimeVerified,
    });
    if (!decision.allowed) throw new Error('Human transition denied: ' + decision.reason);

    return this.appendAndCheckpoint({
      runId,
      actor: 'human',
      action: 'human-approval-recorded',
      state: to,
      metadata: { from, to, reviewerIdentity, reviewedAt, runtimeVerified: runtimeVerified === true, approvalEvidence },
    });
  }

  async recoverRun(runId) {
    return this.coordinator.recover(runId);
  }

  async getRun(runId) {
    return this.entries(runId);
  }
}

module.exports = PersistentGovernanceRuntime;

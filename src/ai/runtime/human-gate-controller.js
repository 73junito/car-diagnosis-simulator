'use strict';

class HumanGateController {
  constructor({ governanceRuntime } = {}) {
    if (!governanceRuntime) {
      throw new Error('HumanGateController requires a governanceRuntime');
    }

    this.governanceRuntime = governanceRuntime;
  }

  recordApproval({
    runId,
    from,
    to,
    reviewerIdentity,
    reviewedAt,
    approvalEvidence,
    runtimeVerified = false,
  }) {
    if (!approvalEvidence) {
      throw new Error('Human approval requires approvalEvidence');
    }

    return this.governanceRuntime.recordHumanTransition({
      runId,
      from,
      to,
      reviewerIdentity,
      reviewedAt,
      approvalEvidence,
      runtimeVerified,
    });
  }
}

module.exports = HumanGateController;

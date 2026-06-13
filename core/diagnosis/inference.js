/**
 * Decay a flap count given the number of days since last occurrence.
 * @param {number} oldCount - previous flap count
 * @param {number} daysSinceLast - days elapsed since last occurrence
 * @param {number} decayDays - number of days per decay step
 * @param {number} decayAmount - amount to subtract per decay step
 * @returns {number} new flap count (not negative)
 */
function decayFlapCount(oldCount, daysSinceLast, decayDays = 14, decayAmount = 1) {
  if (!Number.isFinite(oldCount) || oldCount <= 0) return 0;
  if (!Number.isFinite(daysSinceLast) || daysSinceLast <= 0) return oldCount;
  const steps = Math.floor(daysSinceLast / decayDays);
  const decayed = oldCount - steps * decayAmount;
  return Math.max(0, Math.floor(decayed));
}

/**
 * Decide whether to reopen an issue based on flap count and thresholds.
 * @param {object} opts
 * @param {number} opts.flapCount
 * @param {number} [opts.minOccurrences=1]
 * @param {number} [opts.runsSinceClose=0]
 * @param {number} [opts.backoffRuns=0]
 * @returns {boolean}
 */
function shouldReopen({ flapCount, minOccurrences = 1, runsSinceClose = 0, backoffRuns = 0 } = {}) {
  if (!Number.isFinite(flapCount) || flapCount <= 0) return false;
  if (flapCount < minOccurrences) return false;
  if (Number.isFinite(backoffRuns) && runsSinceClose < backoffRuns) return false;
  return true;
}

function applyReopenMetadata(body, newFlapCount) {
  const next = Object.assign({}, body || {});
  next.flap_count = newFlapCount;
  next.reopened = true;
  next.reopened_at = new Date().toISOString();
  return next;
}

module.exports = {
  decayFlapCount,
  shouldReopen,
  applyReopenMetadata
};

/**
 * Evaluate signals and produce a score and decision.
 * @param {Array} signals
 * @param {object} context { flapCount, runsSinceClose, daysSinceLast, thresholds }
 */
function evaluateSignals(signals = [], context = {}) {
  const flapCount = Number.isFinite(context.flapCount) ? context.flapCount : 0;
  const runsSinceClose = Number.isFinite(context.runsSinceClose) ? context.runsSinceClose : 0;
  const daysSinceLast = Number.isFinite(context.daysSinceLast) ? context.daysSinceLast : 0;

  let raw = 0;
  const reasons = [];

  if (!Array.isArray(signals) || signals.length === 0) {
    const finalScore = 0;
    const should = shouldReopen({ flapCount, runsSinceClose, minOccurrences: (context.thresholds && context.thresholds.minOccurrences) || 1, backoffRuns: (context.thresholds && context.thresholds.backoffRuns) || 0 });
    return { score: finalScore, shouldReopen: should, reasons, updatedFlapCount: flapCount };
  }

  for (const s of signals) {
    // base signal match
    raw += 0.5;
    // repeated symptom
    if (flapCount > 0) raw += 0.2;
    // graph-confirmed cause
    if (s && Array.isArray(s.likelyCauses) && s.likelyCauses.length > 0) raw += 0.2;
  }

  // average per signal to keep scale reasonable
  raw = raw / signals.length;

  // apply decay penalty based on flap count (older flaps decay reduce influence)
  const decayed = decayFlapCount(flapCount, daysSinceLast, (context.thresholds && context.thresholds.decayDays) || 14, (context.thresholds && context.thresholds.decayAmount) || 1);
  const penalty = Math.min(0.5, decayed * 0.05);

  let score = Math.max(0, Math.min(1, raw - penalty));

  // reasons
  if (score >= 0.7) reasons.push('high frequency regression signal');
  if (signals.some(s => s && Array.isArray(s.likelyCauses) && s.likelyCauses.length > 0)) reasons.push('matches known unstable subsystem');

  const updatedFlapCount = (score >= 0.5) ? (flapCount + 1) : flapCount;

  const should = shouldReopen({ flapCount: updatedFlapCount, runsSinceClose, minOccurrences: (context.thresholds && context.thresholds.minOccurrences) || 1, backoffRuns: (context.thresholds && context.thresholds.backoffRuns) || 0 });

  return {
    score,
    shouldReopen: should,
    reasons,
    updatedFlapCount
  };
}

module.exports.evaluateSignals = evaluateSignals;

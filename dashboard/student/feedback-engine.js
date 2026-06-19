function buildFeedback(result = {}) {
  if (result.correct) return "Good diagnostic choice. Continue to verify with evidence.";
  return "Review the symptoms, test results, and next best diagnostic step.";
}
module.exports = { buildFeedback };

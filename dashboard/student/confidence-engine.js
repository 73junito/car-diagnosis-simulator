function calculateConfidence(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return 0;
  const correct = steps.filter(s => s.correct === true).length;
  return Number((correct / steps.length).toFixed(3));
}
module.exports = { calculateConfidence };

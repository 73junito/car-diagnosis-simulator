const FAULT_ALIASES = Object.freeze({
  spark: 'spark_plugs',
  sparkplug: 'spark_plugs',
  sparkplugs: 'spark_plugs',
  plug: 'spark_plugs',
  plugs: 'spark_plugs'
});

function normalizeToken(value) {
  const token = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!token) return '';

  return FAULT_ALIASES[token] || token;
}

function isFaultMatch(choice, fault) {
  const choiceNorm = normalizeToken(choice);

  if (!choiceNorm || fault === undefined || fault === null) {
    return false;
  }

  const faultValues = Array.isArray(fault) ? fault : [fault];

  return faultValues.some((candidate) => {
    const faultNorm = normalizeToken(candidate);

    if (!faultNorm) return false;
    if (faultNorm === choiceNorm) return true;

    const faultParts = faultNorm.split('_').filter(Boolean);

    if (faultParts.includes(choiceNorm)) {
      return true;
    }

    if (choiceNorm.includes('_')) {
      const choiceParts = choiceNorm.split('_').filter(Boolean);
      return choiceParts.every((part) => faultParts.includes(part));
    }

    return false;
  });
}

function formatToolOutput(
  systemLabel,
  testName,
  value,
  interpretation,
  conclusion
) {
  return [
    `[SYSTEM: ${systemLabel}]`,
    `Test: ${testName}`,
    `Result: ${value}`,
    `Interpretation: ${interpretation}`,
    `Conclusion: ${conclusion}`
  ].join('\n');
}

module.exports = {
  normalizeToken,
  isFaultMatch,
  formatToolOutput
};

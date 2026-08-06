function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const safe = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[safe];
}

function summarizeLatencyMs(latenciesMs) {
  const clean = (Array.isArray(latenciesMs) ? latenciesMs : []).filter(v => Number.isFinite(v) && v >= 0);
  if (clean.length === 0) {
    return { p50Ms: 0, p95Ms: 0, maxMs: 0 };
  }

  return {
    p50Ms: Number(percentile(clean, 50).toFixed(3)),
    p95Ms: Number(percentile(clean, 95).toFixed(3)),
    maxMs: Number(Math.max(...clean).toFixed(3))
  };
}

module.exports = {
  percentile,
  summarizeLatencyMs
};

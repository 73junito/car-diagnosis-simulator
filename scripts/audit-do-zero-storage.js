'use strict';
// Phase 4C: offline, read-only classification of DO namespaces.
// Inputs are existing audit artifacts and OPTIONAL metrics snapshots; absent
// metrics are UNKNOWN, never interpreted as zero. Does not call Cloudflare.
const fs = require('node:fs');
const path = require('node:path');

const PROTECTED = new Set([
  'autolearnpro-app', 'autolearnpro-app-staging', 'autolearnpro-exam',
  'autolearnpro-public', 'car-diagnosis-simulator',
  'car-diagnosis-simulator-staging'
]);
const ROOT = 'autolearnpro-app_';

function fail(message) { throw new Error(message); }
function classify(namespace, metric) {
  if (!namespace || typeof namespace.name !== 'string' || !/^[a-f0-9]{32}$/i.test(namespace.id || '')) fail('Invalid inventory namespace record');
  const protectedNamespace = PROTECTED.has(namespace.name) ||
    namespace.script !== 'autolearnpro-app' ||
    !namespace.name.startsWith(ROOT) ||
    namespace.name === 'autolearnpro-app_TorqueMindRateLimitCounter';
  const storageBytes = metric && Number.isSafeInteger(metric.storage_bytes) && metric.storage_bytes >= 0 ? metric.storage_bytes : null;
  const requests = metric && Number.isSafeInteger(metric.requests) && metric.requests >= 0 ? metric.requests : null;
  const dataPresent = metric && typeof metric.has_stored_data === 'boolean' ? metric.has_stored_data : null;
  const activePreview = metric && typeof metric.active_preview === 'boolean' ? metric.active_preview : null;
  const observedZero = storageBytes === 0;
  const noRecentRequests = requests === 0;
  // NO deletion eligibility: identity, bindings and lifetime aren't verified by snapshots.
  const category = protectedNamespace ? 'protected' :
    (observedZero && noRecentRequests && dataPresent === false && activePreview === false
      ? 'potential_review_only' : 'unknown');
  return {
    name: namespace.name, script: namespace.script, category,
    protected: protectedNamespace, storage_bytes: storageBytes, requests,
    has_stored_data: dataPresent, active_preview: activePreview,
    review_reason: category === 'potential_review_only' ?
      'Multiple inactivity signals; ownership, bindings, lifecycle and rollback still unverified' :
      (protectedNamespace ? 'Protected Worker or base namespace' : 'Incomplete or conflicting inactivity evidence'),
    deletion_authorized: false
  };
}
function analyze(inventoryArtifact, metricsArtifact) {
  const inventory = inventoryArtifact?.inventory || inventoryArtifact;
  if (!inventory || inventory.pagination?.complete !== true ||
      inventory.pagination?.verification !== 'declared_total_count_exact' ||
      !Array.isArray(inventory.namespaces) ||
      inventory.namespaces.length !== inventory.total_namespaces) fail('Incomplete or invalid inventory: refusing classification');
  const metrics = metricsArtifact?.namespaces || [];
  if (!Array.isArray(metrics)) fail('Metrics must be a namespaces array');
  const byName = new Map();
  for (const item of metrics) {
    if (!item || typeof item.name !== 'string' || byName.has(item.name)) fail('Malformed or duplicate metrics name');
    byName.set(item.name, item);
  }
  const seen = new Set();
  const rows = inventory.namespaces.map(ns => {
    if (seen.has(ns.id)) fail('Duplicate namespace identifier');
    seen.add(ns.id);
    return classify(ns, byName.get(ns.name));
  });
  const counts = Object.fromEntries(['protected', 'potential_review_only', 'unknown'].map(k => [k, rows.filter(r => r.category === k).length]));
  const summary = {
    read_only: true, deletion_authorized: false,
    inventory_total: rows.length, metrics_supplied: metricsArtifact != null,
    observed_zero_storage: rows.filter(r => r.storage_bytes === 0).length,
    unknown_storage: rows.filter(r => r.storage_bytes === null).length,
    observed_zero_requests: rows.filter(r => r.requests === 0).length,
    unknown_requests: rows.filter(r => r.requests === null).length,
    categories: counts,
    warning: '0 B and 0 requests do not prove that a namespace is unused; never delete from this report.'
  };
  return { summary, rows };
}
function main() {
  const [, , inventoryPath, metricsPath, outputDir] = process.argv;
  if (!inventoryPath || !outputDir) fail('Usage: node scripts/audit-do-zero-storage.js INVENTORY.json -|METRICS.json OUTPUT_DIR');
  const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  const metrics = metricsPath && metricsPath !== '-' ? read(metricsPath) : null;
  const result = analyze(read(inventoryPath), metrics);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'do-zero-storage-summary.json'), JSON.stringify(result, null, 2) + '\n');
  const s = result.summary;
  fs.writeFileSync(path.join(outputDir, 'do-zero-storage-report.md'), [
    '# Durable Object zero-storage assessment (read-only)',
    '', '| Metric | Count |', '|---|---:|',
    ...Object.entries({ total_namespaces:s.inventory_total, zero_storage_observed:s.observed_zero_storage, storage_unknown:s.unknown_storage, zero_requests_observed:s.observed_zero_requests, requests_unknown:s.unknown_requests, protected:s.categories.protected, potential_review_only:s.categories.potential_review_only, unknown:s.categories.unknown }).map(([k,v]) => '| '+k+' | '+v+' |'),
    '', '**No namespaces are approved for deletion.**', '',
    s.warning, '', 'Metrics must be supplied separately from authoritative observations; missing values remain null.',
    '' ].join('\n'));
  console.log(JSON.stringify(s));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error('[do-zero-storage] ' + error.message); process.exitCode = 1; }
}
module.exports = { analyze, classify, PROTECTED };

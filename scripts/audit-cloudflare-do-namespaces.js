'use strict';
// Read-only Cloudflare Durable Object namespace inventory and reconciliation.
//
// GET-only by construction: the default request implementation uses
// https.get exclusively and never passes a `method` option, so POST, PUT,
// PATCH, and DELETE cannot be issued. Unit tests must not import https;
// inject a fake `request` function instead (see tests/cloudflare-do-namespace-audit.spec.js).
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = 'https://api.cloudflare.com/client/v4';
const NAMESPACE_PATH = account => `/accounts/${account}/workers/durable_objects/namespaces`;
const DEFAULT_PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 100;
const MAX_RESPONSE_BYTES = 5000000;
const TIMEOUT_MS = 15000;

class NamespaceAuditError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'NamespaceAuditError';
    this.code = code;
    this.details = details || {};
  }
}

function defaultRequest(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'autolearnpro-do-namespace-audit',
          Accept: 'application/json'
        }
      },
      res => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
          if (raw.length > MAX_RESPONSE_BYTES) req.destroy(new Error('Response too large'));
        });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
          resolve({ status: res.statusCode, json, rawProvided: Boolean(raw) });
        });
      }
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Durable Object namespace API timeout')));
    req.on('error', reject);
  });
}

function classifyHttpFailure(status, json) {
  const errorCodes = Array.isArray(json && json.errors) ? json.errors.map(e => e && e.code) : [];
  if (status === 401 || errorCodes.includes(9103)) {
    return new NamespaceAuditError(
      'Cloudflare authentication failed (HTTP 401). Verify CLOUDFLARE_API_TOKEN.',
      'auth_failed',
      { status, errorCodes }
    );
  }
  if (status === 403 || errorCodes.includes(9109)) {
    return new NamespaceAuditError(
      'Cloudflare permission denied (HTTP 403). The token requires read permission for ' +
        'GET /accounts/{account_id}/workers/durable_objects/namespaces ' +
        '(Durable Object namespace read scope).',
      'permission_denied',
      { status, errorCodes }
    );
  }
  if (status === 429) {
    return new NamespaceAuditError(
      'Cloudflare rate limit exceeded (HTTP 429). Aborting without retrying to preserve fail-closed behavior.',
      'rate_limited',
      { status, errorCodes }
    );
  }
  return new NamespaceAuditError(
    `Unexpected Cloudflare response (HTTP ${status}).`,
    'http_error',
    { status, errorCodes }
  );
}

function validateNamespaceRecord(item, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new NamespaceAuditError(
      `Namespace record at index ${index} is not an object.`,
      'schema_mismatch',
      { index }
    );
  }
  if (typeof item.id !== 'string' || !item.id) {
    throw new NamespaceAuditError(
      `Namespace record at index ${index} is missing a non-empty string id.`,
      'schema_mismatch',
      { index }
    );
  }
  if (typeof item.name !== 'string') {
    throw new NamespaceAuditError(
      `Namespace record at index ${index} (id ${item.id}) is missing a string name.`,
      'schema_mismatch',
      { index, id: item.id }
    );
  }
  // Preserve every field exactly as returned; do not drop unknown metadata.
  return { ...item };
}

async function collectNamespaces(options) {
  const {
    account,
    token,
    request = defaultRequest,
    perPage = DEFAULT_PER_PAGE,
    maxPages = DEFAULT_MAX_PAGES,
    now = () => new Date()
  } = options || {};

  if (!account || typeof account !== 'string') {
    throw new NamespaceAuditError('CLOUDFLARE_ACCOUNT_ID is required.', 'config_missing');
  }
  if (!token || typeof token !== 'string') {
    throw new NamespaceAuditError('CLOUDFLARE_API_TOKEN is required.', 'config_missing');
  }
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 5000) {
    throw new NamespaceAuditError('perPage must be an integer between 1 and 5000.', 'config_invalid');
  }
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw new NamespaceAuditError('maxPages must be a positive integer.', 'config_invalid');
  }

  const collectedAt = now().toISOString();
  const base = `${API_BASE}${NAMESPACE_PATH(account)}`;
  const namespaces = [];
  const seenIds = new Set();
  const pagesReceived = [];
  let declaredTotalCount = null;
  let declaredTotalPages = null;
  let complete = false;

  for (let page = 1; page <= maxPages && !complete; page += 1) {
    const url = `${base}?page=${page}&per_page=${perPage}`;
    let response;
    try {
      response = await request(url, token);
    } catch (err) {
      throw new NamespaceAuditError(
        `Request for namespace page ${page} failed: ${err.message}`,
        'request_failed',
        { page }
      );
    }
    const status = response && response.status;
    const json = response && response.json;
    if (!Number.isInteger(status) || status !== 200) {
      throw classifyHttpFailure(status, json);
    }
    if (!json || json.success !== true || !Array.isArray(json.result)) {
      throw new NamespaceAuditError(
        `Namespace page ${page} did not return a successful array result.`,
        'api_failure',
        { page }
      );
    }

    for (const item of json.result) {
      const record = validateNamespaceRecord(item, namespaces.length);
      if (seenIds.has(record.id)) {
        throw new NamespaceAuditError(
          `Duplicate namespace id "${record.id}" encountered while paginating. ` +
            'Pagination responses are inconsistent; inventory is not trustworthy.',
          'duplicate_namespace_id',
          { page, id: record.id }
        );
      }
      seenIds.add(record.id);
      namespaces.push(record);
    }

    const info = json.result_info || null;
    pagesReceived.push(page);
    if (info) {
      if (Number.isInteger(info.total_count)) declaredTotalCount = info.total_count;
      if (Number.isInteger(info.total_pages)) declaredTotalPages = info.total_pages;
      if (Number.isInteger(info.page) && info.page !== page) {
        throw new NamespaceAuditError(
          `Namespace page ${page} echoed page ${info.page}; pagination responses are inconsistent.`,
          'pagination_incomplete',
          { requestedPage: page, echoedPage: info.page }
        );
      }
      if (Number.isInteger(info.count) && info.count !== json.result.length) {
        throw new NamespaceAuditError(
          `Namespace page ${page} reported count ${info.count} but returned ${json.result.length} records.`,
          'pagination_incomplete',
          { page, reportedCount: info.count, receivedCount: json.result.length }
        );
      }
      if (Number.isInteger(declaredTotalPages) && page >= declaredTotalPages) complete = true;
    } else if (json.result.length < perPage) {
      complete = true;
    }
  }

  if (!complete) {
    throw new NamespaceAuditError(
      `Pagination did not reach a verified end within ${maxPages} pages. ` +
        'Refusing to claim inventory completeness.',
      'pagination_incomplete',
      { pagesReceived: pagesReceived.length, declaredTotalPages, collected: namespaces.length }
    );
  }
  if (declaredTotalCount !== null && namespaces.length !== declaredTotalCount) {
    throw new NamespaceAuditError(
      `Collected ${namespaces.length} namespaces but the API declared total_count ${declaredTotalCount}.`,
      'pagination_incomplete',
      { collected: namespaces.length, declaredTotalCount }
    );
  }

  return {
    collected_at_utc: collectedAt,
    endpoint: base,
    method: 'GET',
    read_only: true,
    pagination: {
      complete: true,
      per_page: perPage,
      pages_received: pagesReceived.length,
      total_pages_declared: declaredTotalPages,
      total_count_declared: declaredTotalCount
    },
    total_namespaces: namespaces.length,
    namespaces
  };
}

// Correlate the namespace inventory with the historical preview manifest.
// Correlation uses exact identifier equality only; similar names are never
// treated as evidence of ownership. All unmatched records stay unknown.
function reconcileNamespaces(inventory, manifest) {
  if (!inventory || !Array.isArray(inventory.namespaces)) {
    throw new NamespaceAuditError('Inventory namespaces array is required.', 'schema_mismatch');
  }
  const rows = manifest && Array.isArray(manifest.rows) ? manifest.rows : null;
  const manifestAvailable = Boolean(rows);
  const livePreviewIds = new Set();
  const absentPreviewIds = new Set();
  if (rows) {
    for (const row of rows) {
      if (!row || typeof row.builds_preview_id !== 'string' || !row.builds_preview_id) continue;
      if (row.live_status === 'present_by_name_lookup') livePreviewIds.add(row.builds_preview_id);
      else if (row.live_status === 'absent') absentPreviewIds.add(row.builds_preview_id);
    }
  }

  const knownWorkerScripts = new Set(['autolearnpro-app', 'autolearnpro-exam']);
  const exactMatchesLive = [];
  const exactMatchesAbsent = [];
  const workerOwnedNotPreviewAttributable = [];
  const unknown = [];

  for (const ns of inventory.namespaces) {
    if (livePreviewIds.has(ns.id)) exactMatchesLive.push(ns.id);
    else if (absentPreviewIds.has(ns.id)) exactMatchesAbsent.push(ns.id);
    else if (typeof ns.script === 'string' && knownWorkerScripts.has(ns.script)) {
      workerOwnedNotPreviewAttributable.push({ id: ns.id, script: ns.script });
    } else unknown.push({ id: ns.id, name: ns.name, script: ns.script ?? null });
  }

  const liveUnmatched = manifestAvailable ? livePreviewIds.size - exactMatchesLive.length : null;
  const absentUnmatched = manifestAvailable ? absentPreviewIds.size - exactMatchesAbsent.length : null;

  return {
    manifest_available: manifestAvailable,
    exact_identifier_matches: {
      live_previews: exactMatchesLive.length,
      absent_previews: exactMatchesAbsent.length,
      note:
        'A match means the Builds preview_id string is byte-identical to the namespace id. ' +
        'Identifier equality is supporting evidence, not proof of namespace ownership.'
    },
    worker_owned_not_preview_attributable: {
      count: workerOwnedNotPreviewAttributable.length,
      note:
        'Namespaces whose script field names an AutoLearnPro Worker. Associated with the Worker ' +
        'but not attributable to a specific preview record.'
    },
    unmatched_preview_records: {
      live_previews_without_namespace_match: liveUnmatched,
      absent_previews_without_namespace_match: absentUnmatched
    },
    unknown_or_unrelated_namespaces: {
      count: unknown.length,
      note: 'Preserved without guessed ownership.',
      records: unknown
    },
    correlation_limitations: [
      'The Durable Object namespace list API does not expose a preview id, build id, or branch field.',
      'Namespace id equality with a Builds preview_id is the only verified correlation channel available.',
      'Namespaces with similar but non-identical names are classified unknown, never matched by similarity.',
      'Without the preview manifest file, no preview-to-namespace correlation is claimed.'
    ]
  };
}

function metricRow(metric, result) {
  return `| ${metric} | ${result} |`;
}

function buildReconciliationReport(inventory, reconciliation) {
  const capNote = 'unknown (no verified quota endpoint queried in this read-only run)';
  const manifestNote = 'unknown (preview manifest unavailable)';
  const lines = [
    '# Cloudflare Durable Object Namespace Reconciliation',
    '',
    'This report is generated by a read-only inventory process. No Cloudflare resource was',
    'created, modified, or deleted. Namespace counts come from fully paginated responses of',
    '`GET /accounts/{account_id}/workers/durable_objects/namespaces`.',
    '',
    '| Metric | Result |',
    '| -------------------------------------------- | --------------------------------------------- |',
    metricRow('Inventory collection timestamp', inventory.collected_at_utc),
    metricRow('Pagination complete', String(inventory.pagination.complete)),
    metricRow('Total namespaces', String(inventory.total_namespaces)),
    metricRow(
      'Confirmed preview-owned namespaces',
      reconciliation.manifest_available
        ? `${reconciliation.exact_identifier_matches.live_previews + reconciliation.exact_identifier_matches.absent_previews} by exact identifier match (evidence, not proof)`
        : manifestNote
    ),
    metricRow(
      'Namespaces associated with live previews',
      reconciliation.manifest_available
        ? String(reconciliation.exact_identifier_matches.live_previews)
        : manifestNote
    ),
    metricRow(
      'Namespaces associated with absent records',
      reconciliation.manifest_available
        ? String(reconciliation.exact_identifier_matches.absent_previews)
        : manifestNote
    ),
    metricRow(
      'Unknown or unrelated namespaces',
      String(reconciliation.unknown_or_unrelated_namespaces.count)
    ),
    metricRow('Current capacity limit', capNote),
    metricRow(
      'Remaining capacity',
      'not computed (limit is not verified; a historical incident recorded error 10067 near the plan-level ceiling, which is not a verified quota reading)'
    ),
    metricRow('Deletion candidates', 'none authorized'),
    '',
    '## Uncertainties',
    '',
    '- The namespace list API does not expose preview ownership. The absent preview records',
    '  remain unresolved unless byte-identical identifier matches are found, and even then the',
    '  match is supporting evidence rather than proof.',
    '- The historical 494/500 figure is an incident measurement, not a live reading; no capacity',
    '  limit is asserted here.',
    '- Namespaces not matching any preview identifier are preserved as unknown and are not',
    '  attributed to any Worker by name similarity.',
    ''
  ];
  if (!reconciliation.manifest_available) {
    lines.push(
      '- The preview manifest was not provided to this run, so no preview-to-namespace',
      '  correlation was performed. Re-run with PREVIEW_MANIFEST_PATH pointing to the',
      '  eligibility manifest to correlate.',
      ''
    );
  }
  return lines.join('\n');
}

async function run() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new NamespaceAuditError('Cloudflare credentials missing', 'config_missing');

  const inventory = await collectNamespaces({ account, token });

  let manifest = null;
  const manifestPath = process.env.PREVIEW_MANIFEST_PATH || 'cloudflare-preview-eligibility-manifest.json';
  if (manifestPath && fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  const reconciliation = reconcileNamespaces(inventory, manifest);
  const report = buildReconciliationReport(inventory, reconciliation);

  const outDir = process.env.GITHUB_WORKSPACE || process.cwd();
  fs.writeFileSync(
    path.join(outDir, 'cloudflare-do-namespace-inventory.json'),
    JSON.stringify({ inventory, reconciliation }, null, 2) + '\n'
  );
  fs.writeFileSync(path.join(outDir, 'cloudflare-do-namespace-reconciliation.md'), report + '\n');

  console.log(
    JSON.stringify(
      {
        readOnly: true,
        collected_at_utc: inventory.collected_at_utc,
        pagination_complete: inventory.pagination.complete,
        total_namespaces: inventory.total_namespaces,
        manifest_available: reconciliation.manifest_available,
        exact_matches_live: reconciliation.exact_identifier_matches.live_previews,
        exact_matches_absent: reconciliation.exact_identifier_matches.absent_previews,
        unknown_namespaces: reconciliation.unknown_or_unrelated_namespaces.count
      },
      null,
      2
    )
  );

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('Read-only Durable Object namespace audit failed:', err.message);
    if (err instanceof NamespaceAuditError) console.error('code:', err.code);
    process.exitCode = 1;
  });
}

module.exports.collectNamespaces = collectNamespaces;
module.exports.reconcileNamespaces = reconcileNamespaces;
module.exports.buildReconciliationReport = buildReconciliationReport;
module.exports.NamespaceAuditError = NamespaceAuditError;
module.exports.classifyHttpFailure = classifyHttpFailure;
module.exports.validateNamespaceRecord = validateNamespaceRecord;




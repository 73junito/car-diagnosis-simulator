'use strict';
// Read-only Cloudflare Durable Object namespace inventory and reconciliation.
//
// GET-only by construction: the default request implementation uses
// https.get exclusively and never passes a `method` option, so POST, PUT,
// PATCH, and DELETE cannot be issued. Unit tests must not import https;
// inject a fake `request` function instead (see tests/cloudflare-do-namespace-audit.spec.js).
//
// Pagination follows the documented contract of
// GET /accounts/{account_id}/workers/durable_objects/namespaces
// (page: minimum 1; per_page: 1..1000; result_info optional, and each of its
// fields individually optional). Completeness is claimed only when declared
// metadata proves it:
//   - declared_total_pages: every declared page is retrieved, then the unique
//     namespace count is reconciled against declared total_count when present.
//   - declared_total_count: pages are retrieved until exactly the declared
//     number of unique namespaces has been collected.
// A short or empty page is never treated as proof of the end of the inventory.
// Fail-closed codes: metadata_missing, pagination_inconsistent,
// parameter_mismatch, pagination_incomplete, duplicate_namespace_id,
// schema_mismatch, manifest_invalid, api_failure, request_failed, http_error,
// auth_failed, permission_denied, rate_limited, config_missing, config_invalid.
//
// Probe mode (DO_NAMESPACE_AUDIT_PROBE=true with optional
// DO_NAMESPACE_AUDIT_PROBE_PAGES, default 3) retrieves a bounded number of
// pages, prints aggregate-only diagnostics, writes no artifacts, and never
// claims completeness.
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = 'https://api.cloudflare.com/client/v4';
const NAMESPACE_PATH = account => `/accounts/${account}/workers/durable_objects/namespaces`;
// Documented limits for GET /accounts/{account_id}/workers/durable_objects/namespaces
// (Cloudflare API reference, retrieved 2026-10-16):
//   page    : optional number, minimum 1
//   per_page: optional number, minimum 1, maximum 1000
// 1000 is the documented maximum page size, so it is the default: with the
// unchanged maxPages safety ceiling of 100 the collector can verify inventories
// of up to 100,000 namespaces in at most 100 GET requests. The 5 MB response
// cap still bounds every page; 1000 namespace records are far below it.
const DEFAULT_PER_PAGE = 1000;
const MAX_SUPPORTED_PER_PAGE = 1000;
const DEFAULT_MAX_PAGES = 100;
// Hard safety boundary for any page walk, including probes. Kept at the
// historical value on purpose: raising it is a reviewed change, never a
// reflexive response to pagination failure.
const MAX_SUPPORTED_PAGES = 100;
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
    probePages = null,
    onDiagnostic = null,
    now = () => new Date()
  } = options || {};

  if (!account || typeof account !== 'string') {
    throw new NamespaceAuditError('CLOUDFLARE_ACCOUNT_ID is required.', 'config_missing');
  }
  if (!token || typeof token !== 'string') {
    throw new NamespaceAuditError('CLOUDFLARE_API_TOKEN is required.', 'config_missing');
  }
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > MAX_SUPPORTED_PER_PAGE) {
    throw new NamespaceAuditError(
      `perPage must be an integer between 1 and ${MAX_SUPPORTED_PER_PAGE} (the documented API maximum).`,
      'config_invalid'
    );
  }
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > MAX_SUPPORTED_PAGES) {
    throw new NamespaceAuditError(
      `maxPages must be an integer between 1 and ${MAX_SUPPORTED_PAGES} (safety boundary).`,
      'config_invalid'
    );
  }
  if (
    probePages !== null &&
    (!Number.isSafeInteger(probePages) || probePages < 1 || probePages > MAX_SUPPORTED_PAGES)
  ) {
    throw new NamespaceAuditError(
      `probePages must be an integer between 1 and ${MAX_SUPPORTED_PAGES}.`,
      'config_invalid'
    );
  }

  // A probe bounds the number of pages directly; a full audit uses maxPages.
  const pageLimit = probePages !== null ? probePages : maxPages;

  const collectedAt = now().toISOString();
  const base = `${API_BASE}${NAMESPACE_PATH(account)}`;
  const namespaces = [];
  const seenIds = new Set();
  const pagesReceived = [];
  const diagnostics = [];
  let declaredTotalCount = null;
  let declaredTotalPages = null;
  // Termination mode: 'none' (no usable metadata yet), 'total_pages', or
  // 'total_count'. Mode is established from declared result_info only.
  let metadataMode = 'none';
  let complete = false;
  let verification = null;

  const emit = entry => {
    diagnostics.push(entry);
    if (typeof onDiagnostic === 'function') onDiagnostic(entry);
  };

  for (let page = 1; page <= pageLimit && !complete; page += 1) {
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
        // Identifier deliberately redacted from message and details: error
        // output is diagnostics, and diagnostics carry aggregates only.
        throw new NamespaceAuditError(
          `Duplicate namespace id encountered on page ${page} while paginating ` +
            '(identifier redacted). Pagination responses are inconsistent; inventory is not trustworthy.',
          'duplicate_namespace_id',
          { page }
        );
      }
      seenIds.add(record.id);
      namespaces.push(record);
    }

    const info = json.result_info || null;
    pagesReceived.push(page);
    if (info) {
      if (Number.isInteger(info.page) && info.page !== page) {
        throw new NamespaceAuditError(
          `Namespace page ${page} echoed page ${info.page}; pagination responses are inconsistent.`,
          'pagination_inconsistent',
          { requested_page: page, returned_page: info.page }
        );
      }
      if (Number.isInteger(info.count) && info.count !== json.result.length) {
        throw new NamespaceAuditError(
          `Namespace page ${page} reported count ${info.count} but returned ${json.result.length} records.`,
          'pagination_inconsistent',
          { page, reported_count: info.count, returned_count: json.result.length }
        );
      }
      if (Number.isInteger(info.per_page) && info.per_page !== perPage) {
        throw new NamespaceAuditError(
          `Namespace page ${page} was served per_page ${info.per_page} but ${perPage} was requested; ` +
            'the API did not honor the requested pagination parameter.',
          'parameter_mismatch',
          { page, requested_per_page: perPage, returned_per_page: info.per_page }
        );
      }
      if (Number.isInteger(info.total_count)) {
        if (declaredTotalCount === null) declaredTotalCount = info.total_count;
        else if (declaredTotalCount !== info.total_count) {
          throw new NamespaceAuditError(
            `Namespace page ${page} declared total_count ${info.total_count}, changing from ${declaredTotalCount}.`,
            'pagination_inconsistent',
            { page, previous_total_count: declaredTotalCount, new_total_count: info.total_count }
          );
        }
      }
      if (Number.isInteger(info.total_pages)) {
        if (declaredTotalPages === null) declaredTotalPages = info.total_pages;
        else if (declaredTotalPages !== info.total_pages) {
          throw new NamespaceAuditError(
            `Namespace page ${page} declared total_pages ${info.total_pages}, changing from ${declaredTotalPages}.`,
            'pagination_inconsistent',
            { page, previous_total_pages: declaredTotalPages, new_total_pages: info.total_pages }
          );
        }
      }
      if (metadataMode === 'none') {
        if (Number.isInteger(declaredTotalPages)) metadataMode = 'total_pages';
        else if (Number.isInteger(declaredTotalCount)) metadataMode = 'total_count';
      }

      emit({
        requested_page: page,
        returned_page: Number.isInteger(info.page) ? info.page : null,
        requested_per_page: perPage,
        returned_per_page: Number.isInteger(info.per_page) ? info.per_page : null,
        returned_count: json.result.length,
        declared_total_count: declaredTotalCount,
        declared_total_pages: declaredTotalPages,
        pagination_mode: metadataMode,
        result_info_present: true,
        // Type names only (never values of identifiers): reveal schema drift
        // such as stringified integers without echoing record contents.
        total_pages_type: info.total_pages === undefined ? 'undefined' : typeof info.total_pages,
        total_count_type: info.total_count === undefined ? 'undefined' : typeof info.total_count
      });

      if (metadataMode === 'total_pages' && Number.isInteger(declaredTotalPages)) {
        if (declaredTotalPages === 0 && json.result.length > 0) {
          throw new NamespaceAuditError(
            `Namespace page ${page} returned records but the API declared total_pages 0.`,
            'pagination_inconsistent',
            { page, returned_count: json.result.length, declared_total_pages: declaredTotalPages }
          );
        }
        if (page < declaredTotalPages && json.result.length < perPage) {
          throw new NamespaceAuditError(
            `Namespace page ${page} of ${declaredTotalPages} returned ${json.result.length} records, fewer than per_page ${perPage}; ` +
              'pagination ended early or the API clamped the requested page size.',
            'pagination_inconsistent',
            {
              page,
              returned_count: json.result.length,
              declared_total_pages: declaredTotalPages,
              per_page: perPage
            }
          );
        }
        if (page >= declaredTotalPages) complete = true;
      }
      if (metadataMode === 'total_count' && !complete) {
        if (namespaces.length === declaredTotalCount) {
          complete = true;
        } else if (namespaces.length > declaredTotalCount) {
          throw new NamespaceAuditError(
            `Collected ${namespaces.length} namespaces by page ${page} but the API declared total_count ${declaredTotalCount}.`,
            'pagination_inconsistent',
            { page, collected: namespaces.length, declared_total_count: declaredTotalCount }
          );
        } else if (json.result.length === 0) {
          throw new NamespaceAuditError(
            `Namespace page ${page} returned no records but the API declared total_count ${declaredTotalCount} ` +
              `(${namespaces.length} collected so far); pagination ended early.`,
            'pagination_inconsistent',
            { page, collected: namespaces.length, declared_total_count: declaredTotalCount }
          );
        } else if (json.result.length < perPage) {
          // Pages are full until the one that lands exactly on the declared
          // total. A short page while the total is still unreached means the
          // API clamped the page size or the data changed mid-walk; either
          // way the sequence cannot be trusted as complete.
          throw new NamespaceAuditError(
            `Namespace page ${page} returned ${json.result.length} records, fewer than per_page ${perPage}, ` +
              `before the declared total_count ${declaredTotalCount} was reached ` +
              `(${namespaces.length} collected so far); pagination ended early.`,
            'pagination_inconsistent',
            {
              page,
              returned_count: json.result.length,
              per_page: perPage,
              collected: namespaces.length,
              declared_total_count: declaredTotalCount
            }
          );
        }
      }
    } else {
      emit({
        requested_page: page,
        returned_page: null,
        requested_per_page: perPage,
        returned_per_page: null,
        returned_count: json.result.length,
        declared_total_count: null,
        declared_total_pages: null,
        pagination_mode: 'none',
        result_info_present: false,
        total_pages_type: 'absent',
        total_count_type: 'absent'
      });
    }

    if (metadataMode === 'none' && probePages === null) {
      // Full audits require documented pagination metadata. result_info is
      // optional in the Cloudflare schema, and its total_pages/total_count
      // fields are individually optional; when none arrive as usable integers
      // there is no verifiable termination condition, and a short page is not
      // a documented one for this endpoint. Bounded probes tolerate the gap so
      // the actual response shape can be observed, but they never claim
      // completeness either.
      throw new NamespaceAuditError(
        `Namespace page ${page} did not provide usable pagination metadata ` +
          '(result_info with integer total_pages or total_count is required). ' +
          'Completeness cannot be verified from record counts alone.',
        'metadata_missing',
        { page, pages_received: pagesReceived.length, diagnostics }
      );
    }
  }

  if (!complete && probePages !== null) {
    // Bounded diagnostic probe: report exactly what was observed and stop.
    // complete stays false by construction; this result is not an inventory.
    return {
      collected_at_utc: collectedAt,
      endpoint: base,
      method: 'GET',
      read_only: true,
      probe_bounded: true,
      pagination: {
        complete: false,
        per_page: perPage,
        pages_received: pagesReceived.length,
        total_pages_declared: declaredTotalPages,
        total_count_declared: declaredTotalCount,
        pagination_mode: metadataMode,
        verification: null,
        diagnostics
      },
      total_namespaces: namespaces.length,
      namespaces
    };
  }

  if (!complete) {
    throw new NamespaceAuditError(
      `Pagination did not reach a verified end within ${pageLimit} pages ` +
        `(declared_total_pages: ${declaredTotalPages}, declared_total_count: ${declaredTotalCount}, ` +
        `collected: ${namespaces.length}). Refusing to claim inventory completeness.`,
      'pagination_incomplete',
      {
        pages_received: pagesReceived.length,
        declared_total_pages: declaredTotalPages,
        declared_total_count: declaredTotalCount,
        pagination_mode: metadataMode,
        collected: namespaces.length,
        diagnostics
      }
    );
  }
  if (declaredTotalCount !== null && namespaces.length !== declaredTotalCount) {
    throw new NamespaceAuditError(
      `Collected ${namespaces.length} namespaces but the API declared total_count ${declaredTotalCount}.`,
      'pagination_incomplete',
      { collected: namespaces.length, declared_total_count: declaredTotalCount, diagnostics }
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
      total_count_declared: declaredTotalCount,
      pagination_mode: metadataMode,
      verification:
        metadataMode === 'total_count'
          ? 'declared_total_count_exact'
          : declaredTotalCount !== null
            ? 'declared_total_pages_and_total_count_reconciled'
            : 'declared_total_pages',
      diagnostics
    },
    total_namespaces: namespaces.length,
    namespaces
  };
}

// Preview eligibility manifest validation (Phase 3D).
// The manifest is produced by scripts/audit-live-cloudflare-previews.js and
// published as the `cloudflare-preview-eligibility-manifest` artifact of the
// Cloudflare Live Preview Audit workflow. This audit consumes it read-only via
// PREVIEW_MANIFEST_PATH. Validation is fail-closed: a present-but-malformed
// manifest throws NamespaceAuditError with code 'manifest_invalid' (sanitized
// aggregates only) instead of silently yielding zero matches. A missing file
// is NOT an error: it yields manifest_available=false with an explicit
// manifest_status so "no manifest" can never be misread as "zero matches".
function validatePreviewManifest(manifest, sourceRunId) {
  const source_run_id =
    typeof sourceRunId === 'string' && sourceRunId ? sourceRunId : null;
  if (manifest === null || manifest === undefined) {
    return {
      available: false,
      rows: null,
      invalid_rows_skipped: 0,
      status: {
        state: 'missing',
        reason:
          'Preview eligibility manifest was not supplied to this run, so no ' +
          'preview-to-namespace correlation was performed. This is not zero matches.',
        source_run_id
      }
    };
  }
  if (typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new NamespaceAuditError(
      'Preview manifest must be a JSON object with a rows array.',
      'manifest_invalid',
      { source_run_id }
    );
  }
  if (!Array.isArray(manifest.rows)) {
    throw new NamespaceAuditError(
      'Preview manifest schema mismatch: manifest.rows array is required.',
      'manifest_invalid',
      { source_run_id }
    );
  }
  if (manifest.rows.length === 0) {
    throw new NamespaceAuditError(
      'Preview manifest contains no rows; correlation cannot proceed.',
      'manifest_invalid',
      { source_run_id, rows: 0 }
    );
  }
  if (typeof manifest.created_at !== 'string' || Number.isNaN(Date.parse(manifest.created_at))) {
    throw new NamespaceAuditError(
      'Preview manifest provenance mismatch: created_at must be an ISO timestamp string.',
      'manifest_invalid',
      { source_run_id }
    );
  }
  if (typeof manifest.worker !== 'string' || !manifest.worker) {
    throw new NamespaceAuditError(
      'Preview manifest provenance mismatch: worker must be a non-empty string.',
      'manifest_invalid',
      { source_run_id }
    );
  }
  if ('readOnly' in manifest && manifest.readOnly !== true) {
    throw new NamespaceAuditError(
      'Preview manifest provenance mismatch: readOnly must be true.',
      'manifest_invalid',
      { source_run_id }
    );
  }
  if ('complete' in manifest && manifest.complete !== true) {
    throw new NamespaceAuditError(
      'Preview manifest reports an incomplete scan; correlation cannot proceed.',
      'manifest_invalid',
      { source_run_id, complete: manifest.complete }
    );
  }
  let invalidRowsSkipped = 0;
  for (const row of manifest.rows) {
    if (!row || typeof row.builds_preview_id !== 'string' || !row.builds_preview_id) {
      invalidRowsSkipped += 1;
    }
  }
  if (invalidRowsSkipped >= manifest.rows.length) {
    throw new NamespaceAuditError(
      'Preview manifest contains no usable preview identifier rows.',
      'manifest_invalid',
      { source_run_id, rows: manifest.rows.length, invalid_rows_skipped: invalidRowsSkipped }
    );
  }
  return {
    available: true,
    rows: manifest.rows,
    invalid_rows_skipped: invalidRowsSkipped,
    status: {
      state: 'available',
      reason: null,
      source_run_id,
      created_at: manifest.created_at,
      worker: manifest.worker,
      scanned: typeof manifest.scanned === 'number' ? manifest.scanned : manifest.rows.length,
      complete: 'complete' in manifest ? manifest.complete : null,
      invalid_rows_skipped: invalidRowsSkipped
    }
  };
}

// Correlate the namespace inventory with the historical preview manifest.
// Correlation uses exact identifier equality only; similar names are never
// treated as evidence of ownership. All unmatched records stay unknown.
// Identifier equality is supporting evidence, NOT proof of ownership: the
// Builds preview_id and the Durable Object namespace id come from different
// systems and may use different identifier types, so even a byte-identical
// match cannot confirm ownership on its own.
function reconcileNamespaces(inventory, manifest, options) {
  if (!inventory || !Array.isArray(inventory.namespaces)) {
    throw new NamespaceAuditError('Inventory namespaces array is required.', 'schema_mismatch');
  }
  const manifestSourceRunId =
    (options && typeof options.sourceRunId === 'string' && options.sourceRunId) ||
    process.env.PREVIEW_MANIFEST_RUN_ID ||
    null;
  const validated = validatePreviewManifest(manifest, manifestSourceRunId);
  const rows = validated.rows;
  const manifestAvailable = validated.available;
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
    manifest_status: validated.status,
    manifest_invalid_rows_skipped: validated.invalid_rows_skipped,
    exact_identifier_matches: {
      live_previews: exactMatchesLive.length,
      absent_previews: exactMatchesAbsent.length,
      note:
        'A match means the Builds preview_id string is byte-identical to the namespace id. ' +
        'Identifier equality is supporting evidence, not proof of namespace ownership: the two ' +
        'systems may use different identifier types.'
    },
    // Explicit three-tier classification: confirmed identifier matches are
    // evidence (never proof), Worker-associated namespaces are supporting
    // context only, and everything else stays unresolved.
    correlation_tiers: {
      confirmed_identifier_matches: exactMatchesLive.length + exactMatchesAbsent.length,
      supporting_context: workerOwnedNotPreviewAttributable.length,
      unresolved: unknown.length + (manifestAvailable ? liveUnmatched + absentUnmatched : 0),
      note:
        'confirmed = byte-identical identifier matches (evidence, not proof); ' +
        'supporting = Worker-associated but not attributable to a specific preview record; ' +
        'unresolved = unknown namespaces plus preview records without a namespace match.'
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
  const manifestNote = reconciliation.manifest_status
    ? `unknown (${reconciliation.manifest_status.reason})`
    : 'unknown (preview manifest unavailable)';
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
        ? `${reconciliation.exact_identifier_matches.live_previews + reconciliation.exact_identifier_matches.absent_previews} by exact identifier match (evidence, not proof of ownership)`
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
    metricRow(
      'Correlation tiers (confirmed / supporting / unresolved)',
      reconciliation.manifest_available
        ? `${reconciliation.correlation_tiers.confirmed_identifier_matches} / ` +
          `${reconciliation.correlation_tiers.supporting_context} / ` +
          `${reconciliation.correlation_tiers.unresolved}`
        : manifestNote
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
    const reason = reconciliation.manifest_status
      ? reconciliation.manifest_status.reason
      : 'The preview manifest was not provided to this run.';
    const sourceRun = reconciliation.manifest_status && reconciliation.manifest_status.source_run_id
      ? ` Manifest source run: ${reconciliation.manifest_status.source_run_id}.`
      : '';
    lines.push(
      `- ${reason}${sourceRun} Re-run with PREVIEW_MANIFEST_PATH pointing to the`,
      '  eligibility manifest, or dispatch with the manifest_run_id input, to correlate.',
      ''
    );
  } else if (reconciliation.manifest_status && reconciliation.manifest_status.source_run_id) {
    lines.push(
      `- Preview manifest provenance: produced ${reconciliation.manifest_status.created_at} ` +
        `for worker ${reconciliation.manifest_status.worker} ` +
        `(source run ${reconciliation.manifest_status.source_run_id}; ` +
        `scanned ${reconciliation.manifest_status.scanned}).`,
      ''
    );
  }
  return lines.join('\n');
}

function parseProbePages() {
  if (process.env.DO_NAMESPACE_AUDIT_PROBE !== 'true') return null;
  const raw = process.env.DO_NAMESPACE_AUDIT_PROBE_PAGES;
  if (raw === undefined || raw === '') return 3;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_SUPPORTED_PAGES) {
    throw new NamespaceAuditError(
      `DO_NAMESPACE_AUDIT_PROBE_PAGES must be an integer between 1 and ${MAX_SUPPORTED_PAGES}.`,
      'config_invalid'
    );
  }
  return parsed;
}

// Aggregate-only pagination logger. Entries are built exclusively by
// collectNamespaces' emit() whitelist and never contain identifiers,
// credentials, or record contents.
function logPaginationDiagnostic(entry) {
  console.error('[do-namespace-audit] pagination ' + JSON.stringify(entry));
}

async function run() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) throw new NamespaceAuditError('Cloudflare credentials missing', 'config_missing');

  const probePages = parseProbePages();
  const inventory = await collectNamespaces({
    account,
    token,
    probePages,
    onDiagnostic: logPaginationDiagnostic
  });

  if (probePages !== null) {
    // Probe runs report observed pagination shape only. No artifacts are
    // written and no reconciliation is performed. complete is always false:
    // a probe is a diagnostic run, never an audit, even when its bounded
    // walk happened to observe a verifiable end within the bound.
    console.log(
      JSON.stringify(
        {
          probe: true,
          complete: false,
          observed_termination: inventory.pagination.verification,
          note:
            'Bounded read-only pagination probe. This is not an inventory; no artifacts were ' +
            'written and no completeness claim is made.',
          pages_requested: probePages,
          pages_received: inventory.pagination.pages_received,
          pagination_mode: inventory.pagination.pagination_mode,
          declared_total_count: inventory.pagination.total_count_declared,
          declared_total_pages: inventory.pagination.total_pages_declared,
          collected_records: inventory.total_namespaces,
          diagnostics: inventory.pagination.diagnostics
        },
        null,
        2
      )
    );
    return;
  }

  let manifest = null;
  let manifestLoadError = null;
  const manifestPath = process.env.PREVIEW_MANIFEST_PATH || 'cloudflare-preview-eligibility-manifest.json';
  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      manifestLoadError = err instanceof Error ? err.message : String(err);
    }
  }
  if (manifestLoadError !== null) {
    throw new NamespaceAuditError(
      'Preview manifest could not be parsed; correlation cannot proceed.',
      'manifest_invalid',
      {
        source_run_id: process.env.PREVIEW_MANIFEST_RUN_ID || null,
        parse_error: manifestLoadError.slice(0, 200)
      }
    );
  }
  const reconciliation = reconcileNamespaces(inventory, manifest, {
    sourceRunId: process.env.PREVIEW_MANIFEST_RUN_ID || null
  });
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
        pagination_mode: inventory.pagination.pagination_mode,
        pagination_verification: inventory.pagination.verification,
        total_namespaces: inventory.total_namespaces,
        manifest_available: reconciliation.manifest_available,
        // Explicitly null (not 0) when no usable manifest was supplied, so a
        // missing manifest can never be misread as "zero matches".
        exact_matches_live: reconciliation.manifest_available
          ? reconciliation.exact_identifier_matches.live_previews
          : null,
        exact_matches_absent: reconciliation.manifest_available
          ? reconciliation.exact_identifier_matches.absent_previews
          : null,
        manifest_status: reconciliation.manifest_status,
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
    if (err instanceof NamespaceAuditError) {
      console.error('code:', err.code);
      // Sanitized aggregates only: NamespaceAuditError details are constructed
      // from whitelisted fields (pages, counts, declared totals, diagnostics).
      if (err.details && Object.keys(err.details).length > 0) {
        console.error('details:', JSON.stringify(err.details));
      }
    }
    process.exitCode = 1;
  });
}

module.exports.collectNamespaces = collectNamespaces;
module.exports.reconcileNamespaces = reconcileNamespaces;
module.exports.buildReconciliationReport = buildReconciliationReport;
module.exports.validatePreviewManifest = validatePreviewManifest;
module.exports.NamespaceAuditError = NamespaceAuditError;
module.exports.classifyHttpFailure = classifyHttpFailure;
module.exports.validateNamespaceRecord = validateNamespaceRecord;




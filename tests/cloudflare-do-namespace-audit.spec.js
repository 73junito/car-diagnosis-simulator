'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  collectNamespaces,
  reconcileNamespaces,
  buildReconciliationReport,
  verifyManifestSourceRun,
  MANIFEST_SOURCE_WORKFLOW_PATH
} = require('../scripts/audit-cloudflare-do-namespaces');

const ACCOUNT = 'test-account';
const TOKEN = 'test-token-value';
const fixedNow = () => new Date('2026-10-20T12:00:00Z');

function pageResponse(records, info) {
  return { status: 200, json: { success: true, errors: [], messages: [], result: records, ...(info ? { result_info: info } : {}) } };
}

function recorder(pages) {
  const calls = [];
  const request = async url => {
    calls.push(url);
    const match = /[?&]page=(\d+)/.exec(url);
    const pageNumber = match ? Number(match[1]) : 1;
    const answer = pages[pageNumber];
    if (!answer) throw new Error(`unexpected page request ${pageNumber}`);
    if (typeof answer === 'function') return answer();
    return answer;
  };
  return { request, calls };
}

test('successful single-page inventory is complete and read-only', async () => {
  const records = [
    { id: 'ns-1', name: 'alpha', script: 'autolearnpro-app', class: 'Session' },
    { id: 'ns-2', name: 'beta', script: null, class: 'Counter' }
  ];
  const { request, calls } = recorder({ 1: pageResponse(records, { page: 1, count: 2, total_count: 2, total_pages: 1, per_page: 1000 }) });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.pagination.pages_received).toBe(1);
  expect(inventory.total_namespaces).toBe(2);
  expect(inventory.method).toBe('GET');
  expect(inventory.read_only).toBe(true);
  expect(inventory.collected_at_utc).toBe('2026-10-20T12:00:00.000Z');
  expect(inventory.endpoint).toContain('/accounts/test-account/workers/durable_objects/namespaces');
  expect(calls).toHaveLength(1);
  expect(JSON.stringify(inventory)).not.toContain(TOKEN);
});

test('multiple pages are fully retrieved before completeness is claimed', async () => {
  const { request, calls } = recorder({
    1: pageResponse(
      [{ id: 'ns-1', name: 'a', script: 's', class: 'C' }, { id: 'ns-2', name: 'b', script: 's', class: 'C' }],
      { page: 1, count: 2, total_count: 3, total_pages: 2, per_page: 2 }
    ),
    2: pageResponse([{ id: 'ns-3', name: 'c', script: 's', class: 'C' }], { page: 2, count: 1, total_count: 3, total_pages: 2, per_page: 2 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 2, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.pagination.pages_received).toBe(2);
  expect(inventory.total_namespaces).toBe(3);
  expect(inventory.namespaces.map(n => n.id)).toEqual(['ns-1', 'ns-2', 'ns-3']);
  expect(calls).toHaveLength(2);
});

test('authentication failure fails closed', async () => {
  const { request } = recorder({ 1: { status: 401, json: { success: false, errors: [{ code: 10000, message: 'Authentication error' }] } } });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow })).rejects.toMatchObject({ code: 'auth_failed' });
});

test('permission-denied response reports the required read scope', async () => {
  const { request } = recorder({ 1: { status: 403, json: { success: false, errors: [{ code: 9109, message: 'Forbidden' }] } } });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow })).rejects.toMatchObject({ code: 'permission_denied' });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow }).catch(e => e);
  expect(error.message).toContain('durable_objects/namespaces');
});

test('rate limiting fails closed without retry', async () => {
  const { request, calls } = recorder({ 1: { status: 429, json: { success: false, errors: [{ code: 10000, message: 'Rate limit' }] } } });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow })).rejects.toMatchObject({ code: 'rate_limited' });
  expect(calls).toHaveLength(1);
});

test('duplicate namespace ids fail closed instead of deduplicating', async () => {
  const { request } = recorder({
    1: pageResponse([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }], { page: 1, count: 1, total_count: 3, total_pages: 2, per_page: 1 }),
    2: pageResponse([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }], { page: 2, count: 1, total_count: 3, total_pages: 2, per_page: 1 })
  });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow })).rejects.toMatchObject({ code: 'duplicate_namespace_id' });
});

test('missing or malformed metadata fails closed', async () => {
  const missingId = recorder({ 1: pageResponse([{ name: 'no-id', script: 's', class: 'C' }], { page: 1, count: 1, total_count: 1, total_pages: 1 }) });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request: missingId.request, now: fixedNow })).rejects.toMatchObject({ code: 'schema_mismatch' });

  const missingName = recorder({ 1: pageResponse([{ id: 'ns-1', script: 's', class: 'C' }], { page: 1, count: 1, total_count: 1, total_pages: 1 }) });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request: missingName.request, now: fixedNow })).rejects.toMatchObject({ code: 'schema_mismatch' });

  const notAnObject = recorder({ 1: pageResponse(['ns-1'], { page: 1, count: 1, total_count: 1, total_pages: 1 }) });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request: notAnObject.request, now: fixedNow })).rejects.toMatchObject({ code: 'schema_mismatch' });
});

test('unknown metadata fields are preserved, not dropped', async () => {
  const { request } = recorder({ 1: pageResponse([{ id: 'ns-1', name: 'a', script: 's', class: 'C', created_at: '2026-01-01T00:00:00Z', custom_field: 42 }], { page: 1, count: 1, total_count: 1, total_pages: 1 }) });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow });
  expect(inventory.namespaces[0].created_at).toBe('2026-01-01T00:00:00Z');
  expect(inventory.namespaces[0].custom_field).toBe(42);
});

test('partial pagination fails closed and never claims completeness', async () => {
  const failing = recorder({
    1: pageResponse([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }], { page: 1, count: 1, total_count: 3, total_pages: 2, per_page: 1 }),
    2: () => { throw new Error('socket reset'); }
  });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request: failing.request, perPage: 1, now: fixedNow })).rejects.toMatchObject({ code: 'request_failed' });

  const truncated = recorder({
    1: pageResponse([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }], { page: 1, count: 1, total_count: 5, total_pages: 3, per_page: 1 }),
    2: pageResponse([{ id: 'ns-2', name: 'b', script: 's', class: 'C' }], { page: 2, count: 1, total_count: 5, total_pages: 3, per_page: 1 }),
    3: pageResponse([], { page: 3, count: 0, total_count: 5, total_pages: 3, per_page: 1 })
  });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request: truncated.request, perPage: 1, now: fixedNow })).rejects.toMatchObject({ code: 'pagination_incomplete' });
});

function inventoryOf(records) {
  return {
    collected_at_utc: '2026-10-20T12:00:00.000Z',
    endpoint: 'https://api.cloudflare.com/client/v4/accounts/test-account/workers/durable_objects/namespaces',
    method: 'GET',
    read_only: true,
    pagination: { complete: true, per_page: 100, pages_received: 1, total_pages_declared: 1, total_count_declared: records.length },
    total_namespaces: records.length,
    namespaces: records
  };
}

function validManifest(rows) {
  return {
    created_at: '2026-10-20T12:00:00.000Z',
    worker: 'autolearnpro-app',
    readOnly: true,
    complete: true,
    scanned: rows.length,
    rows
  };
}

test('reconciliation validates the manifest schema fail-closed', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  expect(() => reconcileNamespaces(inventory, { rows: [] })).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
  expect(() => reconcileNamespaces(inventory, { rows: 'nope' })).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
  expect(() =>
    reconcileNamespaces(inventory, { rows: [{ builds_preview_id: 'pv-x', live_status: 'absent' }] })
  ).toThrow(expect.objectContaining({ code: 'manifest_invalid' }));
});

test('malformed manifests never yield silent zero-matches', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const missingCreatedAt = {
    worker: 'autolearnpro-app',
    complete: true,
    scanned: 1,
    rows: [{ builds_preview_id: 'pv-x', live_status: 'absent' }]
  };
  expect(() => reconcileNamespaces(inventory, missingCreatedAt)).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
  const incompleteScan = {
    created_at: '2026-10-20T12:00:00.000Z',
    worker: 'autolearnpro-app',
    complete: false,
    scanned: 1,
    rows: [{ builds_preview_id: 'pv-x', live_status: 'absent' }]
  };
  expect(() => reconcileNamespaces(inventory, incompleteScan)).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
});

test('manifests with missing or mismatched scanned counts are rejected', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const rows = [{ builds_preview_id: 'pv-x', live_status: 'absent' }];
  const missingScanned = {
    created_at: '2026-10-20T12:00:00.000Z',
    worker: 'autolearnpro-app',
    complete: true,
    rows
  };
  expect(() => reconcileNamespaces(inventory, missingScanned)).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
  const mismatchedScanned = {
    created_at: '2026-10-20T12:00:00.000Z',
    worker: 'autolearnpro-app',
    complete: true,
    scanned: 2,
    rows
  };
  expect(() => reconcileNamespaces(inventory, mismatchedScanned)).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
  const missingComplete = {
    created_at: '2026-10-20T12:00:00.000Z',
    worker: 'autolearnpro-app',
    scanned: 1,
    rows
  };
  expect(() => reconcileNamespaces(inventory, missingComplete)).toThrow(
    expect.objectContaining({ code: 'manifest_invalid' })
  );
});

test('correlation tiers separate confirmed, supporting, and unresolved evidence', () => {
  const inventory = inventoryOf([
    { id: 'pv-live-1', name: 'x', script: 'autolearnpro-app', class: 'C' },
    { id: 'pv-abs-1', name: 'y', script: 'autolearnpro-app', class: 'C' },
    { id: 'ns-other', name: 'z', script: 'unrelated', class: 'C' }
  ]);
  const manifest = validManifest([
    { builds_preview_id: 'pv-live-1', live_status: 'present_by_name_lookup' },
    { builds_preview_id: 'pv-live-2', live_status: 'present_by_name_lookup' },
    { builds_preview_id: 'pv-abs-1', live_status: 'absent' },
    { builds_preview_id: 'pv-abs-2', live_status: 'absent' }
  ]);
  const result = reconcileNamespaces(inventory, manifest);
  expect(result.correlation_tiers.confirmed_identifier_matches).toBe(2);
  expect(result.correlation_tiers.supporting_context).toBe(0);
  expect(result.correlation_tiers.unresolved).toBe(3);
  const report = buildReconciliationReport(inventory, result);
  expect(report).toContain('Correlation tiers (confirmed / supporting / unresolved)');
  expect(report).toMatch(/evidence, not proof of ownership/);
});

test('mismatched preview and namespace counts stay separate and unmatched', () => {
  const inventory = inventoryOf([
    { id: 'pv-live-1', name: 'x', script: 'autolearnpro-app', class: 'C' },
    { id: 'pv-abs-1', name: 'y', script: 'autolearnpro-app', class: 'C' },
    { id: 'ns-other', name: 'z', script: 'unrelated', class: 'C' }
  ]);
  const manifest = validManifest([
    { builds_preview_id: 'pv-live-1', live_status: 'present_by_name_lookup' },
    { builds_preview_id: 'pv-live-2', live_status: 'present_by_name_lookup' },
    { builds_preview_id: 'pv-abs-1', live_status: 'absent' },
    { builds_preview_id: 'pv-abs-2', live_status: 'absent' }
  ]);
  const result = reconcileNamespaces(inventory, manifest);
  expect(result.exact_identifier_matches.live_previews).toBe(1);
  expect(result.exact_identifier_matches.absent_previews).toBe(1);
  expect(result.unmatched_preview_records.live_previews_without_namespace_match).toBe(1);
  expect(result.unmatched_preview_records.absent_previews_without_namespace_match).toBe(1);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(1);
});

test('worker-owned namespaces are reported but not attributed to previews', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'sessions', script: 'autolearnpro-app', class: 'Session' }]);
  const result = reconcileNamespaces(inventory, validManifest([{ builds_preview_id: 'pv-x', live_status: 'absent' }]));
  expect(result.worker_owned_not_preview_attributable.count).toBe(1);
  expect(result.exact_identifier_matches.absent_previews).toBe(0);
});

test('unknown namespace ownership is preserved, never guessed', () => {
  const inventory = inventoryOf([
    { id: 'ns-1', name: 'preview-something-similar', script: 'someone-else', class: 'C' },
    { id: 'ns-2', name: 'unrelated', script: 'another-worker', class: 'C' }
  ]);
  const manifest = validManifest([{ builds_preview_id: 'preview-abc', live_status: 'absent' }]);
  const result = reconcileNamespaces(inventory, manifest);
  expect(result.exact_identifier_matches.absent_previews).toBe(0);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(2);
  expect(result.unknown_or_unrelated_namespaces.records.map(r => r.id)).toEqual(['ns-1', 'ns-2']);
});

test('without a manifest no preview-to-namespace correlation is claimed', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const result = reconcileNamespaces(inventory, null);
  expect(result.manifest_available).toBe(false);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(1);
  // A missing manifest is explicit, never silent zero-matches.
  expect(result.manifest_status.state).toBe('missing');
  expect(result.manifest_status.reason).toMatch(/not zero matches/);
  expect(result.unmatched_preview_records.live_previews_without_namespace_match).toBeNull();
  const report = buildReconciliationReport(inventory, result);
  expect(report).toMatch(/not zero matches/);
  expect(report).toMatch(/manifest_run_id/);
  expect(report).toContain('Deletion candidates');
  expect(report).toContain('none authorized');
});

test('manifest status carries provenance when a manifest run id is supplied', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const missing = reconcileNamespaces(inventory, null, { sourceRunId: '12345' });
  expect(missing.manifest_status.source_run_id).toBe('12345');
  const found = reconcileNamespaces(
    inventory,
    validManifest([{ builds_preview_id: 'ns-1', live_status: 'absent' }]),
    { sourceRunId: '12345' }
  );
  expect(found.manifest_status).toMatchObject({ state: 'available', source_run_id: '12345', worker: 'autolearnpro-app' });
  expect(found.correlation_tiers.confirmed_identifier_matches).toBe(1);
  const report = buildReconciliationReport(inventory, found);
  expect(report).toMatch(/source run 12345/);
});

function sourceRun(overrides) {
  return {
    head_repository: { full_name: '73junito/car-diagnosis-simulator' },
    path: MANIFEST_SOURCE_WORKFLOW_PATH,
    conclusion: 'success',
    ...(overrides || {})
  };
}

test('manifest source runs are verified structurally, never by formatted output', () => {
  const good = verifyManifestSourceRun(sourceRun(), '73junito/car-diagnosis-simulator');
  expect(good).toMatchObject({ ok: true, reason: null });

  expect(verifyManifestSourceRun(null, '73junito/car-diagnosis-simulator')).toMatchObject({ ok: false });
  expect(verifyManifestSourceRun([], '73junito/car-diagnosis-simulator')).toMatchObject({ ok: false });

  const wrongRepo = verifyManifestSourceRun(
    sourceRun({ head_repository: { full_name: 'someone-else/fork' } }),
    '73junito/car-diagnosis-simulator'
  );
  expect(wrongRepo).toMatchObject({ ok: false, reason: 'wrong_repository' });

  const missingRepo = verifyManifestSourceRun(
    sourceRun({ head_repository: null }),
    '73junito/car-diagnosis-simulator'
  );
  expect(missingRepo).toMatchObject({ ok: false, reason: 'wrong_repository' });

  const wrongWorkflow = verifyManifestSourceRun(
    sourceRun({ path: '.github/workflows/cloudflare-do-namespace-audit.yml' }),
    '73junito/car-diagnosis-simulator'
  );
  expect(wrongWorkflow).toMatchObject({ ok: false, reason: 'wrong_workflow' });

  const failedRun = verifyManifestSourceRun(
    sourceRun({ conclusion: 'failure' }),
    '73junito/car-diagnosis-simulator'
  );
  expect(failedRun).toMatchObject({ ok: false, reason: 'run_not_successful' });

  const inProgressRun = verifyManifestSourceRun(
    sourceRun({ conclusion: null }),
    '73junito/car-diagnosis-simulator'
  );
  expect(inProgressRun).toMatchObject({ ok: false, reason: 'run_not_successful' });
});

test('report labels capacity as unknown and never fabricates remaining capacity', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const report = buildReconciliationReport(inventory, reconcileNamespaces(inventory, null));
  expect(report).toContain('Current capacity limit | unknown');
  expect(report).toContain('not computed');
  expect(report).toContain('2026-10-20T12:00:00.000Z');
});

test('the audit script issues no destructive HTTP methods', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'audit-cloudflare-do-namespaces.js'), 'utf8');
  expect(source).toContain('https.get(');
  // No request method option may be set to anything other than GET.
  const methodAssignments = source.match(/method\s*:\s*['"`][A-Za-z]+['"`]/g) || [];
  expect(methodAssignments.every(m => m.includes("'GET'"))).toBe(true);
  // No generic request/send/fetch entry points that could carry other verbs.
  expect(source).not.toMatch(/https\.request\s*\(/);
  expect(source).not.toMatch(/\bfetch\s*\(/);
  expect(source).not.toMatch(/XMLHttpRequest/);
  expect(source).not.toMatch(/\.send\s*\(/);
  // Only the read-only endpoint path is constructed.
  expect(source).toContain('/workers/durable_objects/namespaces');
  expect(source).not.toMatch(/durable_objects\/namespaces\/[^`]*`.*(DELETE|PUT|PATCH)/);
});

// ---------------------------------------------------------------------------
// Phase 3A: pagination correctness and fail-closed regression coverage.
// All network behavior remains mocked through the injected request function.
// ---------------------------------------------------------------------------

const DIAGNOSTIC_KEYS = [
  'requested_page',
  'returned_page',
  'requested_per_page',
  'returned_per_page',
  'returned_count',
  'declared_total_count',
  'declared_total_pages',
  'pagination_mode',
  'result_info_present',
  'total_pages_type',
  'total_count_type'
];

function rec(id) {
  return { id, name: `n-${id}`, script: 's', class: 'C' };
}

test('missing result_info fails closed immediately in audit mode', async () => {
  const { request, calls } = recorder({ 1: pageResponse([rec('ns-1')]) });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'metadata_missing' });
  // Fail fast: no further pages are requested once completeness is impossible.
  expect(calls).toHaveLength(1);
});

test('result_info without total_pages or total_count fails closed', async () => {
  const { request } = recorder({ 1: pageResponse([rec('ns-1')], { page: 1, count: 1, per_page: 1000 }) });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow })).rejects.toMatchObject({
    code: 'metadata_missing'
  });
});

test('declared total_count without total_pages completes only at the exact declared count', async () => {
  const { request, calls } = recorder({
    1: pageResponse([rec('ns-1'), rec('ns-2')], { page: 1, count: 2, total_count: 3, per_page: 2 }),
    2: pageResponse([rec('ns-3')], { page: 2, count: 1, total_count: 3, per_page: 2 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 2, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.pagination.pagination_mode).toBe('total_count');
  expect(inventory.pagination.verification).toBe('declared_total_count_exact');
  expect(inventory.total_namespaces).toBe(3);
  expect(calls).toHaveLength(2);
});

test('total_count mode refuses an early end even on a short page', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 5, per_page: 2 })
  });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 2, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'pagination_inconsistent' });
  expect(error.message).toContain('fewer than per_page');
});

test('a changing total_count across pages fails closed', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    2: pageResponse([rec('ns-2')], { page: 2, count: 1, total_count: 4, total_pages: 3, per_page: 1 })
  });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'pagination_inconsistent' });
  expect(error.message).toContain('changing from 3');
});

test('a changing total_pages across pages fails closed', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    2: pageResponse([rec('ns-2')], { page: 2, count: 1, total_count: 3, total_pages: 4, per_page: 1 })
  });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'pagination_inconsistent' });
  expect(error.message).toContain('changing from 3');
});

test('a repeated page echo fails closed', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    // The API repeats page 1's metadata when page 2 is requested.
    2: pageResponse([rec('ns-2')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 })
  });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow })).rejects.toMatchObject({
    code: 'pagination_inconsistent'
  });
});

test('an API that ignores the requested per_page fails closed as parameter_mismatch', async () => {
  // Cloudflare's documented default page size is 20; an echo of 20 while 1000
  // was requested means the parameter was ignored or clamped.
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 40, total_pages: 2, per_page: 20 })
  });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'parameter_mismatch' });
  expect(error.message).toContain('per_page');
});




test('an empty page before the declared end fails closed in total_pages mode', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    2: pageResponse([], { page: 2, count: 0, total_count: 3, total_pages: 3, per_page: 1 })
  });
  await expect(collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow })).rejects.toMatchObject({
    code: 'pagination_inconsistent'
  });
});

test('an empty terminal page is accepted only when declared totals reconcile', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1'), rec('ns-2')], { page: 1, count: 2, total_count: 2, total_pages: 2, per_page: 2 }),
    2: pageResponse([], { page: 2, count: 0, total_count: 2, total_pages: 2, per_page: 2 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 2, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.total_namespaces).toBe(2);
});

test('an empty result with declared zero totals completes as an empty inventory', async () => {
  const { request } = recorder({
    1: pageResponse([], { page: 1, count: 0, total_count: 0, total_pages: 1, per_page: 1000 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.total_namespaces).toBe(0);
  expect(inventory.namespaces).toEqual([]);
});

test('reaching the page ceiling fails closed and reports declared totals', async () => {
  const pages = {};
  for (let i = 1; i <= 100; i += 1) {
    pages[i] = pageResponse([rec(`ns-${i}`)], { page: i, count: 1, total_count: 150, total_pages: 150, per_page: 1 });
  }
  const { request } = recorder(pages);
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'pagination_incomplete' });
  expect(error.details.declared_total_pages).toBe(150);
  expect(error.details.pages_received).toBe(100);
  expect(error.details.collected).toBe(100);
});

test('page sizes and page ceilings outside documented bounds fail closed', async () => {
  const never = async () => {
    throw new Error('no request expected');
  };
  for (const perPage of [0, -1, 1001, 1.5, '10']) {
    await expect(
      collectNamespaces({ account: ACCOUNT, token: TOKEN, request: never, perPage, now: fixedNow })
    ).rejects.toMatchObject({ code: 'config_invalid' });
  }
  for (const maxPages of [0, 101, 2.5]) {
    await expect(
      collectNamespaces({ account: ACCOUNT, token: TOKEN, request: never, maxPages, now: fixedNow })
    ).rejects.toMatchObject({ code: 'config_invalid' });
  }
  for (const probePages of [0, 101, 2.5]) {
    await expect(
      collectNamespaces({ account: ACCOUNT, token: TOKEN, request: never, probePages, now: fixedNow })
    ).rejects.toMatchObject({ code: 'config_invalid' });
  }
});

test('a genuine multi-page inventory reconciles declared totals end to end', async () => {
  const { request, calls } = recorder({
    1: pageResponse([rec('ns-1'), rec('ns-2')], { page: 1, count: 2, total_count: 5, total_pages: 3, per_page: 2 }),
    2: pageResponse([rec('ns-3'), rec('ns-4')], { page: 2, count: 2, total_count: 5, total_pages: 3, per_page: 2 }),
    3: pageResponse([rec('ns-5')], { page: 3, count: 1, total_count: 5, total_pages: 3, per_page: 2 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 2, now: fixedNow });
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.pagination.verification).toBe('declared_total_pages_and_total_count_reconciled');
  expect(inventory.pagination.pages_received).toBe(3);
  expect(inventory.total_namespaces).toBe(5);
  expect(inventory.namespaces.map(n => n.id)).toEqual(['ns-1', 'ns-2', 'ns-3', 'ns-4', 'ns-5']);
  expect(calls).toHaveLength(3);
});

test('every collector request is a read-only GET against the namespace endpoint only', async () => {
  const { request, calls } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 1, total_pages: 1, per_page: 1 })
  });
  await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow });
  const endpointPattern = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/test-account\/workers\/durable_objects\/namespaces\?page=\d+&per_page=\d+$/;
  expect(calls.length).toBeGreaterThan(0);
  for (const url of calls) {
    expect(url).toMatch(endpointPattern);
  }
});


test('diagnostics carry only whitelisted aggregate keys and never identifiers', async () => {
  const seen = [];
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    2: pageResponse([rec('ns-2')], { page: 2, count: 1, total_count: 4, total_pages: 3, per_page: 1 })
  });
  const error = await collectNamespaces({
    account: ACCOUNT,
    token: TOKEN,
    request,
    perPage: 1,
    onDiagnostic: entry => seen.push(entry),
    now: fixedNow
  }).catch(e => e);
  expect(error).toMatchObject({ code: 'pagination_inconsistent' });
  expect(seen.length).toBeGreaterThan(0);
  for (const entry of seen) {
    expect(Object.keys(entry).every(key => DIAGNOSTIC_KEYS.includes(key))).toBe(true);
  }
  const serialized = JSON.stringify(seen) + JSON.stringify(error.details) + error.message;
  expect(serialized).not.toContain('ns-1');
  expect(serialized).not.toContain('ns-2');
  expect(serialized).not.toContain(TOKEN);
});

test('duplicate-namespace errors redact the identifier from message and details', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-unique-42')], { page: 1, count: 1, total_count: 3, total_pages: 3, per_page: 1 }),
    2: pageResponse([rec('ns-unique-42')], { page: 2, count: 1, total_count: 3, total_pages: 3, per_page: 1 })
  });
  const error = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, now: fixedNow }).catch(e => e);
  expect(error).toMatchObject({ code: 'duplicate_namespace_id' });
  expect(error.message).not.toContain('ns-unique-42');
  expect(JSON.stringify(error.details)).not.toContain('ns-unique-42');
});

test('probe mode stops at the bound without claiming completeness', async () => {
  const pages = {
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 500, total_pages: 500, per_page: 1 }),
    2: pageResponse([rec('ns-2')], { page: 2, count: 1, total_count: 500, total_pages: 500, per_page: 1 })
  };
  const { request, calls } = recorder(pages);
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, probePages: 2, now: fixedNow });
  expect(inventory.probe_bounded).toBe(true);
  expect(inventory.pagination.complete).toBe(false);
  expect(inventory.pagination.verification).toBe(null);
  expect(inventory.pagination.pages_received).toBe(2);
  expect(calls).toHaveLength(2);
});

test('probe mode tolerates missing metadata so the response shape can be observed', async () => {
  const pages = {
    1: pageResponse([rec('ns-1')]),
    2: pageResponse([rec('ns-2')])
  };
  const { request, calls } = recorder(pages);
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, probePages: 2, now: fixedNow });
  expect(inventory.probe_bounded).toBe(true);
  expect(inventory.pagination.complete).toBe(false);
  expect(inventory.pagination.pagination_mode).toBe('none');
  expect(inventory.pagination.diagnostics).toHaveLength(2);
  expect(inventory.pagination.diagnostics[0].result_info_present).toBe(false);
  expect(calls).toHaveLength(2);
});

test('a probe that observes a verifiable end reports it without marking an inventory complete by probe', async () => {
  const { request } = recorder({
    1: pageResponse([rec('ns-1')], { page: 1, count: 1, total_count: 1, total_pages: 1, per_page: 1 })
  });
  const inventory = await collectNamespaces({ account: ACCOUNT, token: TOKEN, request, perPage: 1, probePages: 3, now: fixedNow });
  // The library reports the observed state truthfully...
  expect(inventory.pagination.complete).toBe(true);
  expect(inventory.pagination.verification).toBe('declared_total_pages_and_total_count_reconciled');
  // ...but run() gates artifact writing on probe mode, never on this flag.
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'audit-cloudflare-do-namespaces.js'), 'utf8');
  const probeGateIndex = source.indexOf('if (probePages !== null)');
  const artifactWriteIndex = source.indexOf('cloudflare-do-namespace-inventory.json');
  expect(probeGateIndex).toBeGreaterThan(-1);
  expect(artifactWriteIndex).toBeGreaterThan(probeGateIndex);
});

test('the default page size honors the documented maximum of 1000', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'audit-cloudflare-do-namespaces.js'), 'utf8');
  expect(source).toContain('const DEFAULT_PER_PAGE = 1000;');
  expect(source).toContain('const MAX_SUPPORTED_PER_PAGE = 1000;');
  // The page ceiling is NOT silently raised: 100 remains the safety boundary.
  expect(source).toContain('const DEFAULT_MAX_PAGES = 100;');
  expect(source).toContain('const MAX_SUPPORTED_PAGES = 100;');
});


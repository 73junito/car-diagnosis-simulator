'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {
  collectNamespaces,
  reconcileNamespaces,
  buildReconciliationReport
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
  const { request, calls } = recorder({ 1: pageResponse(records, { page: 1, count: 2, total_count: 2, total_pages: 1, per_page: 100 }) });
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

test('unknown namespace ownership is preserved, never guessed', () => {
  const inventory = inventoryOf([
    { id: 'ns-1', name: 'preview-something-similar', script: 'someone-else', class: 'C' },
    { id: 'ns-2', name: 'unrelated', script: 'another-worker', class: 'C' }
  ]);
  const result = reconcileNamespaces(inventory, { rows: [{ builds_preview_id: 'preview-abc', live_status: 'absent' }] });
  expect(result.exact_identifier_matches.absent_previews).toBe(0);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(2);
  expect(result.unknown_or_unrelated_namespaces.records.map(r => r.id)).toEqual(['ns-1', 'ns-2']);
});

test('mismatched preview and namespace counts stay separate and unmatched', () => {
  const inventory = inventoryOf([
    { id: 'pv-live-1', name: 'x', script: 'autolearnpro-app', class: 'C' },
    { id: 'pv-abs-1', name: 'y', script: 'autolearnpro-app', class: 'C' },
    { id: 'ns-other', name: 'z', script: 'unrelated', class: 'C' }
  ]);
  const manifest = {
    rows: [
      { builds_preview_id: 'pv-live-1', live_status: 'present_by_name_lookup' },
      { builds_preview_id: 'pv-live-2', live_status: 'present_by_name_lookup' },
      { builds_preview_id: 'pv-abs-1', live_status: 'absent' },
      { builds_preview_id: 'pv-abs-2', live_status: 'absent' }
    ]
  };
  const result = reconcileNamespaces(inventory, manifest);
  expect(result.exact_identifier_matches.live_previews).toBe(1);
  expect(result.exact_identifier_matches.absent_previews).toBe(1);
  expect(result.unmatched_preview_records.live_previews_without_namespace_match).toBe(1);
  expect(result.unmatched_preview_records.absent_previews_without_namespace_match).toBe(1);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(1);
});

test('worker-owned namespaces are reported but not attributed to previews', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'sessions', script: 'autolearnpro-app', class: 'Session' }]);
  const result = reconcileNamespaces(inventory, { rows: [{ builds_preview_id: 'pv-x', live_status: 'absent' }] });
  expect(result.worker_owned_not_preview_attributable.count).toBe(1);
  expect(result.exact_identifier_matches.absent_previews).toBe(0);
});

test('without a manifest no preview-to-namespace correlation is claimed', () => {
  const inventory = inventoryOf([{ id: 'ns-1', name: 'a', script: 's', class: 'C' }]);
  const result = reconcileNamespaces(inventory, null);
  expect(result.manifest_available).toBe(false);
  expect(result.unknown_or_unrelated_namespaces.count).toBe(1);
  const report = buildReconciliationReport(inventory, result);
  expect(report).toContain('unknown (preview manifest unavailable)');
  expect(report).toContain('Deletion candidates');
  expect(report).toContain('none authorized');
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



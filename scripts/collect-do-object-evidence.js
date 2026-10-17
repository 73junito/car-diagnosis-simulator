'use strict';
// Phase 4D: read-only, bounded Cloudflare DO object-storage evidence.
// Never creates, writes, deletes, migrates, or invokes a DO instance.
const fs = require('node:fs');
const path = require('node:path');
const API_ROOT = 'https://api.cloudflare.com/client/v4';
const MAX_PAGES = 1000;
const validId = id => typeof id === 'string' && /^[0-9a-f]{32}$/i.test(id);
function assertInventory(payload) {
  const inv = payload?.inventory || payload;
  if (!inv || !Array.isArray(inv.namespaces) || inv.pagination?.complete !== true ||
      inv.pagination?.verification !== 'declared_total_count_exact' ||
      inv.total_namespaces !== inv.namespaces.length) throw new Error('Inventory is incomplete or invalid');
  const ids = new Set();
  for (const row of inv.namespaces) {
    if (!validId(row.id) || typeof row.name !== 'string' || ids.has(row.id)) throw new Error('Invalid or duplicate namespace');
    ids.add(row.id);
  }
  return inv;
}
function parseObjectsPage(body) {
  if (!body || body.success !== true || !Array.isArray(body.result) || !body.result_info || typeof body.result_info !== 'object') throw new Error('Malformed Cloudflare object list');
  const info = body.result_info;
  const cursor = info.cursor == null || info.cursor === '' ? null : info.cursor;
  if (cursor !== null && typeof cursor !== 'string') throw new Error('Malformed pagination cursor');
  for (const obj of body.result) {
    if (!obj || typeof obj.id !== 'string' || typeof obj.hasStoredData !== 'boolean') throw new Error('Incomplete object storage evidence');
  }
  return { objects: body.result, cursor };
}
async function inspectNamespace({account, token, namespace, fetchImpl = fetch}) {
  const seenCursors = new Set(), objectIds = new Set();
  let cursor = null, pages = 0, stored = 0, without = 0;
  while (pages < MAX_PAGES) {
    const url = new URL(API_ROOT + '/accounts/' + account + '/workers/durable_objects/namespaces/' + namespace.id + '/objects');
    url.searchParams.set('limit', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetchImpl(url.toString(), {method:'GET', headers:{Authorization:'Bearer ' + token, Accept:'application/json'}, signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Cloudflare request failed: HTTP ' + response.status);
    const page = parseObjectsPage(await response.json());
    pages += 1;
    for (const obj of page.objects) {
      if (objectIds.has(obj.id)) throw new Error('Duplicate Durable Object across pages');
      objectIds.add(obj.id);
      if (obj.hasStoredData) stored++; else without++;
    }
    if (!page.cursor) {
      return { name: namespace.name, has_stored_data: stored > 0, object_count: stored + without,
        objects_with_stored_data: stored, objects_without_stored_data: without,
        storage_bytes: null, requests: null, active_preview: null,
        object_enumeration_complete: true, pages };
    }
    if (seenCursors.has(page.cursor)) throw new Error('Repeated pagination cursor');
    seenCursors.add(page.cursor); cursor = page.cursor;
  }
  throw new Error('Object listing exceeded maximum pagination limit');
}
async function collect({ inventory, account, token, fetchImpl = fetch, maxNamespaces = 10 }) {
  if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Account and read token required');
  const inv = assertInventory(inventory);
  if (!Number.isSafeInteger(maxNamespaces) || maxNamespaces < 1 || maxNamespaces > inv.namespaces.length) throw new Error('Invalid namespace bound');
  const selected = inv.namespaces.slice(0,maxNamespaces), results = [], failures = [];
  for (const namespace of selected) {
    try { results.push(await inspectNamespace({account,token,namespace,fetchImpl})); }
    catch (error) { failures.push({name:namespace.name, reason: error.message.slice(0,140)}); }
  }
  return { read_only: true, deletion_authorized: false, source: 'Cloudflare DO namespace object-list GET',
    namespace_selection: 'inventory order (first N)', total_inventory_namespaces: inv.namespaces.length,
    namespaces_attempted: selected.length, namespaces_completed: results.length, namespaces_failed: failures.length,
    observed_at: new Date().toISOString(), namespaces: results, failures,
    warning:'has_stored_data summarizes fully enumerated objects, not storage bytes, traffic, bindings, preview ownership or deletion eligibility.' };
}
async function main() {
  const [, , inventoryPath, outputPath, maxArg] = process.argv;
  if (!inventoryPath || !outputPath) throw new Error('Usage: node scripts/collect-do-object-evidence.js INVENTORY.json OUTPUT.json [MAX_NAMESPACES]');
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const data = JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
  const result = await collect({inventory:data,account,token,maxNamespaces: maxArg ? Number(maxArg) : 10});
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({attempted:result.namespaces_attempted,completed:result.namespaces_completed,failed:result.namespaces_failed,stored_data_present:result.namespaces.filter(x=>x.has_stored_data).length}));
  if (result.namespaces_failed) process.exitCode=2;
}
if (require.main === module) main().catch(err=>{console.error('[do-evidence] '+err.message);process.exitCode=1});
module.exports = {assertInventory,parseObjectsPage,inspectNamespace,collect};

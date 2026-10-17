const { analyze } = require('../scripts/audit-do-zero-storage');
const ns = (name, id, script = 'autolearnpro-app') => ({name,id,script,use_sqlite:true});
const id = n => n.toString(16).padStart(32,'0');
const inventory = records => ({inventory:{namespaces:records,total_namespaces:records.length,pagination:{complete:true,verification:'declared_total_count_exact'}}});
const branch = ns('autolearnpro-app_feat-example_TorqueMindRateLimitCounter', id(1));
test('missing metrics remain unknown, never 0 B', () => {
  const r = analyze(inventory([branch]), null);
  expect(r.summary.unknown_storage).toBe(1);
  expect(r.summary.observed_zero_storage).toBe(0);
  expect(r.summary.categories.unknown).toBe(1);
});
test('zero storage alone never establishes review eligibility', () => {
  const r = analyze(inventory([branch]), {namespaces:[{name:branch.name,storage_bytes:0}]});
  expect(r.summary.categories.potential_review_only).toBe(0);
  expect(r.rows[0].deletion_authorized).toBe(false);
});
test('all inactivity signals still permit review only and never deletion', () => {
  const r = analyze(inventory([branch]), {namespaces:[{name:branch.name,storage_bytes:0,requests:0,has_stored_data:false,active_preview:false}]});
  expect(r.rows[0].category).toBe('potential_review_only');
  expect(r.rows[0].deletion_authorized).toBe(false);
});
test('protected namespace cannot become review candidate', () => {
  const base=ns('autolearnpro-app_TorqueMindRateLimitCounter',id(2));
  const r = analyze(inventory([base]), {namespaces:[{name:base.name,storage_bytes:0,requests:0,has_stored_data:false,active_preview:false}]});
  expect(r.rows[0].category).toBe('protected');
});
test('incomplete inventory, duplicates and bad metrics fail closed', () => {
  expect(() => analyze({inventory:{namespaces:[branch],total_namespaces:1,pagination:{complete:false}}},null)).toThrow();
  expect(() => analyze(inventory([branch,branch]),null)).toThrow(/Duplicate/);
  expect(() => analyze(inventory([branch]),{namespaces:[{name:branch.name},{name:branch.name}]})).toThrow(/duplicate/i);
});

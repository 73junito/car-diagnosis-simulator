'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { test } = require('node:test');
test('prepared grant remediation is scoped to public base tables and preserves RLS', () => {
 const sql=fs.readFileSync('scripts/sql/review-revoke-public-truncate.sql','utf8');
 assert.match(sql,/REVOKE TRUNCATE ON TABLE/);
 assert.match(sql,/FROM anon, authenticated/);
 assert.match(sql,/n.nspname='public'/);
 assert.match(sql,/c.relkind IN \('r','p'\)/);
 assert.doesNotMatch(sql,/DISABLE ROW LEVEL SECURITY|TRUNCATE TABLE|DROP TABLE|GRANT ALL/i);
 assert.match(sql,/-- DROP POLICY IF EXISTS assignments_read_authenticated/);
});

test('post-remediation checks report residual TRUNCATE and policy definitions', () => {
 const sql=fs.readFileSync('scripts/sql/verify-public-grants-remediation.sql','utf8');
 assert.match(sql,/has_table_privilege\('anon', c.oid, 'TRUNCATE'\)/);
 assert.match(sql,/has_table_privilege\('authenticated', c.oid, 'TRUNCATE'\)/);
 assert.match(sql,/FROM pg_policies/);
 assert.match(sql,/FROM information_schema.role_table_grants/);
 assert.doesNotMatch(sql,/\b(REVOKE|GRANT|ALTER|DROP|TRUNCATE TABLE|UPDATE|DELETE FROM)\b/i);
});

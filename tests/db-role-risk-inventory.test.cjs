'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('inventory SQL is read-only and flags RLS-bypassing privileges and broad SELECT',()=>{
 const sql=fs.readFileSync('scripts/sql/audit-exposed-role-risks.sql','utf8');
 for(const token of ['BROWSER_TRUNCATE','PUBLIC_TABLE_WITHOUT_RLS','BROAD_AUTHENTICATED_SELECT','pg_policies','has_table_privilege']) assert.ok(sql.includes(token),token);
 const withoutComments=sql.split('\n').filter(s=>!s.trimStart().startsWith('--')).join('\n');
 assert.doesNotMatch(withoutComments,/\b(?:GRANT|REVOKE|ALTER|UPDATE|INSERT|DELETE|DROP|TRUNCATE)\s+(?:TABLE|ON|FROM|INTO|POLICY|ROLE|SCHEMA|DATABASE)\b/i);
});

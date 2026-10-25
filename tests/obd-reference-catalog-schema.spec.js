'use strict';
const fs=require('fs'),path=require('path');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261018050000_create_obd_reference_catalog.sql'),'utf8');
const inventory=fs.readFileSync(path.join(__dirname,'../data/obd2/OBD-REFERENCE-SOURCE-INVENTORY.md'),'utf8');
test('OBD-I and OBD-II identities are separate and context-scoped',()=>{
 expect(migration).toContain("protocol_generation in ('OBD_I','OBD_II')");
 expect(migration).toContain('model_year_to,interpretation_key)');
 expect(migration).toContain('source_page integer');
 expect(migration).toContain('obd_year_range');
 expect(migration).toContain('unique nulls not distinct');
 expect(migration).toContain('obd_generic_scope');
});
test('sources, license review and unverified-by-default code records',()=>{
 expect(migration).toContain('obd_reference_sources');
 expect(migration).toContain("default 'review_pending'");
 expect(migration).toContain("default 'unverified'");
 expect(migration).toContain('obd_source_required_for_verified');
});
test('catalog access is fail-closed and does not seed speculative codes',()=>{
 expect(migration).toContain('enable row level security');
 expect(migration).toMatch(/revoke all on public\.obd_reference_codes from anon,authenticated/);
 expect(migration).not.toMatch(/insert into|truncate |drop table /i);
});
test('inventory identifies source restrictions and legacy sample only',()=>{
 expect(inventory).toMatch(/five illustrative/i);
 expect(inventory).toMatch(/rights|required|licensing/i);
 expect(inventory).toMatch(/OBD-I/);
});

test('verification is protected against direct SQL writes and source downgrade',()=>{
 expect(migration).toContain('obd_reference_require_approved_source');
 expect(migration).toContain('obd_reference_block_source_downgrade');
 expect(migration).toContain('obd_reference_code_source_gate');
 expect(migration).toContain('obd_reference_source_downgrade_gate');
});

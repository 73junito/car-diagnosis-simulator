#!/usr/bin/env node
/*
  Integration test for DB-level evidence approval gate enforcement.
  Runs against a disposable PostgreSQL and proves the trigger REJECTS illegal
  approval writes and ACCEPTS a fully reviewed one.

  Connects using PG env vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
*/
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');

function cfg(overrides = {}) {
  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5433', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
    ...overrides
  };
}

async function expectRejected(client, label, sql, expectFragment) {
  try {
    await client.query(sql);
  } catch (error) {
    if (!String(error.message).includes('evidence_gate_rejected')) {
      throw new Error(`${label}: expected evidence_gate_rejected, got "${error.message}"`);
    }
    if (expectFragment && !String(error.message).includes(expectFragment)) {
      throw new Error(`${label}: expected message containing "${expectFragment}", got "${error.message}"`);
    }
    console.log(`  [PASS] rejected ${label}`);
    return;
  }
  throw new Error(`${label}: statement SUCCEEDED but should have been rejected`);
}

async function run() {
  const admin = new Client(cfg());
  await admin.connect();

  const dbName = `evidence_gate_test_${process.pid}`;
  await admin.query(`drop database if exists ${dbName}`);
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const client = new Client(cfg({ database: dbName }));
  await client.connect();
  let failures = 0;

  try {
    // Supabase roles referenced by the bootstrap REVOKE statements. A vanilla
    // Postgres lacks them, so create no-op stand-ins before applying it.
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await client.query(
        `do $$ begin if not exists (select from pg_roles where rolname = '${role}') then create role ${role} nologin; end if; end $$;`
      );
    }
    console.log('[PASS] supabase roles present');
    // Apply the real bootstrap, then the gate migration, exactly as CI would.
    const bootstrap = fs.readFileSync(
      path.join(root, 'supabase', 'migrations', '20260817011638_bootstrap_foundation_schema.sql'),
      'utf8'
    );
    await client.query(bootstrap);

    const gate = fs.readFileSync(
      path.join(root, 'supabase', 'migrations', '20260926000000_enforce_evidence_approval_gates.sql'),
      'utf8'
    );
    await client.query(gate);
    console.log('[PASS] migrations applied');

    // Two distinct sources so cross-source approval can be tested.
    await client.query(
      `insert into public.approved_sources (id, title, storage_path, checksum, status)
       values ('src-a', 'Source A', '/tmp/a.pdf', 'sum-a', 'validated'),
              ('src-b', 'Source B', '/tmp/b.pdf', 'sum-b', 'validated')`
    );

    const insertChunk = (chunkId, sourceId) =>
      client.query(
        `insert into public.source_chunks
           (chunk_id, source_id, source_version, text_excerpt, token_count, text_hash, section)
         values ($1, $2, 1, 'excerpt text', 5, $3, 'sec')`,
        [chunkId, sourceId, `hash-${chunkId}`]
      );

    await insertChunk('chunk-a1', 'src-a');
    await insertChunk('chunk-a2', 'src-a');
    await insertChunk('chunk-b1', 'src-b');
    console.log('[PASS] fixtures inserted');

    const approveA1 =
      `update public.source_chunks set approved = true where chunk_id = 'chunk-a1'`;

    // --- Rejections -----------------------------------------------------
    // Ordering matters: the trigger checks the chunk decision before the
    // source gates, so each assertion isolates one control.
    // 1. No decision at all.
    await expectRejected(client, 'approval with no review decision',
      approveA1, 'no recorded review decision');

    // 2. A pending decision is not an approval.
    await client.query(
      `insert into public.evidence_chunk_decisions (chunk_id, source_id, decision)
       values ('chunk-a1', 'src-a', 'pending')`
    );
    await expectRejected(client, 'approval with a pending chunk decision',
      approveA1, "decision is 'pending'");

    // 3. A denied chunk cannot be approved.
    await client.query(
      `update public.evidence_chunk_decisions set decision='denied', reviewed_by=gen_random_uuid(),
              reviewed_at=now() where chunk_id = 'chunk-a1'`
    );
    await expectRejected(client, 'approval of a denied chunk',
      approveA1, "decision is 'denied'");

    // 4. Cross-source decision mismatch.
    await client.query(
      `update public.evidence_chunk_decisions set decision='approved', approved=true,
              reviewed_by=gen_random_uuid(), reviewed_at=now(), source_id='src-b'
        where chunk_id = 'chunk-a1'`
    );
    await expectRejected(client, 'approval with a cross-source decision',
      approveA1, 'different source');

    // From here the decision is approved, so the SOURCE GATE controls are reached.
    await client.query(
      `update public.evidence_chunk_decisions set source_id='src-a' where chunk_id = 'chunk-a1'`
    );

    // 5. No source gate state recorded at all.
    await expectRejected(client, 'approval with no source gate state',
      approveA1, 'no recorded evidence gate state');


    await client.query(
      `update public.evidence_chunk_decisions set source_id='src-a' where chunk_id = 'chunk-a1'`
    );
    // 6. Gate row exists but rights are not cleared.
    await client.query(`insert into public.evidence_source_gates (source_id) values ('src-a')`);
    await expectRejected(client, 'approval with rights_cleared=false',
      approveA1, 'rights_cleared=false');

    // 7. Rights cleared, technical review not done.
    await client.query(
      `update public.evidence_source_gates
          set rights_cleared = true, rights_verified_by = gen_random_uuid(), rights_verified_at = now()
        where source_id = 'src-a'`
    );
    await expectRejected(client, 'approval with technically_reviewed=false',
      approveA1, 'technically_reviewed=false');

    // 8. Technical review flagged, but no reviewer identity recorded.
    // The table CHECK constraint blocks the obvious write, so relax it for this
    // one assertion to prove the TRIGGER independently refuses the approval.
    await client.query(
      `alter table public.evidence_source_gates
         drop constraint evidence_source_gates_technical_reviewer_required`
    );
    await client.query(
      `update public.evidence_source_gates set technically_reviewed = true where source_id = 'src-a'`
    );
    await expectRejected(client, 'approval without technical reviewer identity',
      approveA1, 'technical reviewer identity');
    await client.query(
      `update public.evidence_source_gates set technically_reviewed = false where source_id = 'src-a'`
    );
    await client.query(
      `alter table public.evidence_source_gates
         add constraint evidence_source_gates_technical_reviewer_required
         check (technically_reviewed = false or (technically_reviewed_by is not null and technically_reviewed_at is not null))`
    );

    // 9. Source-level chunk_approved with no approved decision behind it.
    // NOTE: src-b has no gate row, so an UPDATE against it would match zero rows
    // and trivially "succeed" without ever firing the trigger. Give src-b a gate
    // row first so the assertion actually exercises the consistency trigger.
    await client.query(`insert into public.evidence_source_gates (source_id) values ('src-b')`);
    await expectRejected(client, 'source chunk_approved=true with no approved decision',
      `update public.evidence_source_gates set chunk_approved = true where source_id = 'src-b'`,
      'requires at least one approved chunk decision');

    // --- Acceptance -----------------------------------------------------
    // Complete the technical review with a recorded human reviewer identity
    // and timestamp, which is what the gate actually requires.
    await client.query(
      `update public.evidence_source_gates
          set technically_reviewed = true,
              technically_reviewed_by = gen_random_uuid(),
              technically_reviewed_at = now()
        where source_id = 'src-a'`
    );
    await client.query(
      `update public.source_chunks set approved = true, status = 'approved' where chunk_id = 'chunk-a1'`
    );
    const approved = await client.query(
      `select approved, status from public.source_chunks where chunk_id = 'chunk-a1'`
    );
    if (approved.rows[0].approved !== true || approved.rows[0].status !== 'approved') {
      throw new Error('fully reviewed approval should have been accepted');
    }
    console.log('[PASS] accepted a fully reviewed approval (all gates + reviewer identity)');

    // A second chunk of the same cleared source with no decision stays refused.
    await expectRejected(client, 'approval of a second undecided chunk on a cleared source',
      `update public.source_chunks set approved = true where chunk_id = 'chunk-a2'`,
      'no recorded review decision');

    // Non-approval writes must remain possible (no false blocking).
    await client.query(
      `update public.source_chunks set status = 'validated' where chunk_id = 'chunk-a2'`
    );
    console.log('[PASS] non-approval writes are not blocked');

    // The trigger must never populate or repair review state on its own.
    const gates = await client.query(
      `select rights_verified_by, technically_reviewed_by, rights_verified_at
         from public.evidence_source_gates where source_id = 'src-b'`
    );
    if (gates.rows[0].rights_verified_by !== null ||
        gates.rows[0].technically_reviewed_by !== null ||
        gates.rows[0].rights_verified_at !== null) {
      throw new Error('trigger must not infer or populate reviewer state');
    }
    console.log('[PASS] trigger did not infer or repair review state');
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${error.message}`);
  } finally {
    await client.end();
    const cleanup = new Client(cfg());
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${dbName} with (force)`);
    await cleanup.end();
  }

  if (failures > 0) process.exit(1);
  console.log('[PASS] DB-level evidence approval gate enforcement verified');
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exit(2);
});

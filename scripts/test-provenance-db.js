#!/usr/bin/env node
/*
  Integration test for provenance migration against a disposable PostgreSQL.
  Connects using PG env vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
*/
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function fail(msg, err) {
  console.error(msg);
  if (err) console.error(err && err.stack ? err.stack : err);
  process.exit(2);
}

async function run() {
  const cfg = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'testdb'
  };

  console.log('Connecting to Postgres', cfg.host, cfg.port, cfg.database, cfg.user);

  const superClient = new Client(cfg);
  await superClient.connect();

  try {
    // Create extension and minimal profiles table
    await superClient.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    await superClient.query("CREATE TABLE IF NOT EXISTS public.profiles (id uuid primary key, role text not null);");

    const adminId = '00000000-0000-0000-0000-0000000000a1';
    const reviewerId = '00000000-0000-0000-0000-0000000000r1'.replace('r','1');
    const regularId = '00000000-0000-0000-0000-0000000000u1'.replace('u','2');

    // Insert profiles
    await superClient.query("INSERT INTO public.profiles (id, role) VALUES ($1,'admin') ON CONFLICT DO NOTHING;", [adminId]);
    await superClient.query("INSERT INTO public.profiles (id, role) VALUES ($1,'technical_reviewer') ON CONFLICT DO NOTHING;", [reviewerId]);
    await superClient.query("INSERT INTO public.profiles (id, role) VALUES ($1,'user') ON CONFLICT DO NOTHING;", [regularId]);

    // Create DB role 'authenticated' and a login user 'app_user' used to exercise RLS
    await superClient.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END$$;");
    await superClient.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user LOGIN PASSWORD 'app_pass'; END IF; END$$;");
    await superClient.query("GRANT authenticated TO app_user;");

    // Apply migration
    const migSql = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'migrations', '20260805_approved_sources_large_chunks.sql'), 'utf8');
    console.log('Applying migration...');
    await superClient.query(migSql);

    // Load fixtures (initially draft)
    const fixturesSql = fs.readFileSync(path.resolve(__dirname, '..', 'db', 'fixtures', 'provenance_fixtures.sql'), 'utf8');
    console.log('Loading fixtures...');
    await superClient.query(fixturesSql);

    // Now open a client as app_user to test policy enforcement
    const appClient = new Client({ ...cfg, user: 'app_user', password: 'app_pass' });
    await appClient.connect();

    // Helper to run as a given profile id
    async function asProfile(client, profileId, fn) {
      await client.query(`SELECT set_config('auth.uid', $1, false)`, [profileId]);
      return fn();
    }

    // 1) Unauthorized user cannot update source status.
    // RLS may reject the operation by exposing zero matching rows.
    const unauthorizedUpdate = await asProfile(appClient, regularId, async () =>
      appClient.query(
        "UPDATE public.approved_sources SET status='source-linked' WHERE id='fixture-approved-source' RETURNING id"
      )
    );
    if (unauthorizedUpdate.rowCount !== 0) {
      fail('Unauthorized update unexpectedly modified a row');
    }
    console.log('Unauthorized update correctly blocked by RLS');

    // 2) Reviewer cannot jump draft -> approved directly.
    let invalidTransitionError;
    try {
      await asProfile(appClient, reviewerId, async () => {
        await appClient.query(
          "UPDATE public.approved_sources SET status='approved' WHERE id='fixture-approved-source'"
        );
      });
    } catch (err) {
      invalidTransitionError = err;
    }
    if (!invalidTransitionError) {
      fail('Invalid direct draft->approved update unexpectedly succeeded');
    }
    if (!invalidTransitionError.message.includes('Invalid transition to approved; must be validated first')) {
      fail('Direct approval failed for an unexpected reason', invalidTransitionError);
    }
    console.log('Invalid direct draft->approved update correctly failed');

    // 3) Valid stepwise transition: draft -> source-linked -> validated -> approved
    await asProfile(appClient, reviewerId, async () => {
      await appClient.query("UPDATE public.approved_sources SET status='source-linked' WHERE id='fixture-approved-source'");
      await appClient.query("UPDATE public.source_chunks SET status='source-linked' WHERE chunk_id='fixture-approved-chunk'");
      await appClient.query("UPDATE public.approved_sources SET status='validated' WHERE id='fixture-approved-source'");
      await appClient.query("UPDATE public.source_chunks SET status='validated' WHERE chunk_id='fixture-approved-chunk'");
      await appClient.query("UPDATE public.approved_sources SET status='approved' WHERE id='fixture-approved-source'");
      await appClient.query("UPDATE public.source_chunks SET status='approved', approved = true WHERE chunk_id='fixture-approved-chunk'");
    });
    console.log('Source/chunk approved via valid transitions');

    // 4) A question cannot be approved without both required citation roles.
    let missingCitationsError;
    try {
      await asProfile(appClient, reviewerId, async () => {
        const res = await appClient.query(
          "INSERT INTO public.question_provenance (question_id, provenance_version, status, validation_checklist) VALUES ('fixture-no-both-citations', 1, 'validated', jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', false, 'license_ok', true)) RETURNING id"
        );
        const qpId = res.rows[0].id;
        await appClient.query(
          "INSERT INTO public.question_citations (question_provenance_id, source_id, chunk_id, role) VALUES ($1, 'fixture-approved-source', 'fixture-approved-chunk', 'supports-answer')",
          [qpId]
        );
        await appClient.query(
          "UPDATE public.question_provenance SET validation_checklist = jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', true, 'license_ok', true) WHERE id = $1",
          [qpId]
        );
        await appClient.query(
          "UPDATE public.question_provenance SET status='approved' WHERE id = $1",
          [qpId]
        );
      });
    } catch (err) {
      missingCitationsError = err;
    }
    if (!missingCitationsError) {
      fail('Approval without both citation roles unexpectedly succeeded');
    }
    if (!missingCitationsError.message.includes('Cannot approve: missing required citations')) {
      fail('Question approval failed for an unexpected reason', missingCitationsError);
    }
    console.log('Approval without both citation roles correctly failed');

    // 5) Validate that direct draft -> approved is blocked for question_provenance
    // First, verify the fixture exists and is in draft state
    const fixtureCheck = await appClient.query(
      `SELECT id, status FROM public.question_provenance WHERE question_id = 'fixture-approved-question'`
    );
    if (fixtureCheck.rowCount !== 1) {
      fail(`Expected one provenance fixture; found ${fixtureCheck.rowCount}`);
    }
    if (fixtureCheck.rows[0].status !== 'draft') {
      fail(`Expected fixture status 'draft'; received '${fixtureCheck.rows[0].status}'`);
    }

    let directApprovalError;
    try {
      await asProfile(appClient, reviewerId, async () => {
        const result = await appClient.query(
          `UPDATE public.question_provenance SET status='approved' WHERE question_id='fixture-approved-question' RETURNING id`
        );
        if (result.rowCount !== 1) {
          throw new Error(`Expected update to affect one row; affected ${result.rowCount}`);
        }
      });
    } catch (err) {
      directApprovalError = err;
    }
    if (!directApprovalError) {
      fail('Invalid direct draft->approved on question_provenance unexpectedly succeeded');
    }
    if (!directApprovalError.message.includes('draft -> approved') && !directApprovalError.message.includes('must be validated first')) {
      fail('Question approval failed for an unexpected reason', directApprovalError);
    }
    console.log('✓ PASS: direct draft -> approved rejected');

    // 6) Approve proper question via enforced lifecycle: draft -> validated -> approved
    // CRITICAL: Use single checked-out client to keep transaction on same connection
    // Connection-scoped transactions are broken if different pools handle BEGIN/COMMIT
    const txnClient = new Client({ ...cfg, user: 'app_user', password: 'app_pass' });
    await txnClient.connect();

    try {
      await txnClient.query(`SELECT set_config('auth.uid', $1, false)`, [reviewerId]);

      await txnClient.query("BEGIN");

      try {
        // Set validation_checklist for fixture-approved-question
        await txnClient.query(
          "UPDATE public.question_provenance SET validation_checklist = jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', true, 'license_ok', true) WHERE question_id='fixture-approved-question'"
        );

        // Transition: draft -> validated
        const validated = await txnClient.query(
          "UPDATE public.question_provenance SET status='validated' WHERE question_id='fixture-approved-question' RETURNING status"
        );

        if (validated.rows[0]?.status !== 'validated') {
          throw new Error('Fixture did not transition to validated');
        }

        // Transition: validated -> approved
        const approved = await txnClient.query(
          "UPDATE public.question_provenance SET status='approved', approved_at = now() WHERE question_id='fixture-approved-question' RETURNING status, approved_at"
        );

        if (approved.rows[0]?.status !== 'approved') {
          throw new Error('Fixture did not transition to approved');
        }

        await txnClient.query("COMMIT");
      } catch (error) {
        await txnClient.query("ROLLBACK");
        throw error;
      }
    } finally {
      await txnClient.end();
    }
    console.log('✓ PASS: draft -> validated -> approved completed');

    // 7) provenance_audit permits reviewer inserts but blocks updates/deletes.
    const auditInsert = await asProfile(appClient, reviewerId, async () =>
      appClient.query(
        `INSERT INTO public.provenance_audit
           (entity_type, entity_id, action, performed_by, details)
         VALUES
           ('question_provenance', 'fixture-approved-question',
            'integration-test', $1, '{"fixture": true}'::jsonb)
         RETURNING audit_id`,
        [reviewerId]
      )
    );

    if (auditInsert.rowCount !== 1) {
      fail(`Expected one provenance_audit fixture; inserted ${auditInsert.rowCount}`);
    }

    const auditId = auditInsert.rows[0].audit_id;
    console.log('provenance_audit insert allowed for reviewer');

    const auditUpdate = await asProfile(appClient, reviewerId, async () =>
      appClient.query(
        "UPDATE public.provenance_audit SET details = details || jsonb_build_object('test', 'x') WHERE audit_id = $1 RETURNING audit_id",
        [auditId]
      )
    );
    if (auditUpdate.rowCount !== 0) {
      fail('provenance_audit update unexpectedly modified a row');
    }
    console.log('provenance_audit update correctly blocked by RLS');

    const auditDelete = await asProfile(appClient, reviewerId, async () =>
      appClient.query(
        "DELETE FROM public.provenance_audit WHERE audit_id = $1 RETURNING audit_id",
        [auditId]
      )
    );
    if (auditDelete.rowCount !== 0) {
      fail('provenance_audit delete unexpectedly removed a row');
    }
    console.log('provenance_audit delete correctly blocked by RLS');

    await appClient.end();
    await superClient.end();

    console.log('All integration checks completed successfully.');
    process.exit(0);

  } catch (err) {
    await superClient.end();
    fail('Integration test failed', err);
  }
}

run();

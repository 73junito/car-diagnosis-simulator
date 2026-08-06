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
      await client.query(`SET session auth.uid = $1`, [profileId]);
      return fn();
    }

    // 1) Unauthorized user cannot update source status
    try {
      await asProfile(appClient, regularId, async () => {
        await appClient.query("UPDATE public.approved_sources SET status='source-linked' WHERE id='fixture-approved-source'");
      });
      fail('Unauthorized update unexpectedly succeeded');
    } catch (err) {
      console.log('Unauthorized update correctly failed');
    }

    // 2) Reviewer cannot jump draft -> approved directly (should fail)
    try {
      await asProfile(appClient, reviewerId, async () => {
        await appClient.query("UPDATE public.approved_sources SET status='approved' WHERE id='fixture-approved-source'");
      });
      fail('Invalid direct draft->approved update unexpectedly succeeded');
    } catch (err) {
      console.log('Invalid direct draft->approved update correctly failed');
    }

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

    // 4) Try to approve a question without both citation roles -> should fail
    try {
      await asProfile(appClient, reviewerId, async () => {
        // create a provenance row for a new question
        const res = await appClient.query("INSERT INTO public.question_provenance (question_id, provenance_version, status, validation_checklist) VALUES ('fixture-no-both-citations', 1, 'validated', jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', false, 'license_ok', true)) RETURNING id");
        const qpId = res.rows[0].id;
        // insert only one citation role
        await appClient.query("INSERT INTO public.question_citations (question_provenance_id, source_id, chunk_id, role) VALUES ($1, 'fixture-approved-source', 'fixture-approved-chunk', 'supports-answer')", [qpId]);
        // attempt to approve
        await appClient.query("UPDATE public.question_provenance SET validation_checklist = jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', true, 'license_ok', true) WHERE id = $1", [qpId]);
        await appClient.query("UPDATE public.question_provenance SET status='approved' WHERE id = $1", [qpId]);
      });
      fail('Approval without both citation roles unexpectedly succeeded');
    } catch (err) {
      console.log('Approval without both citation roles correctly failed');
    }

    // 5) Approve a proper question: insert provenance for fixture-approved-question and citations exist from fixtures
    await asProfile(appClient, reviewerId, async () => {
      // Update the existing fixture-approved-question's validation_checklist to pass
      await appClient.query("UPDATE public.question_provenance SET validation_checklist = jsonb_build_object('answer_verified', true, 'explanation_verified', true, 'citation_matches_excerpt', true, 'license_ok', true) WHERE question_id='fixture-approved-question'");
      // Attempt to set approved - should succeed
      await appClient.query("UPDATE public.question_provenance SET status='approved', approved_at = now() WHERE question_id='fixture-approved-question'");
    });
    console.log('Approved fixture question successfully');

    // 6) provenance_audit update/delete should fail for reviewer/user (no policy)
    // try update as reviewer
    try {
      await asProfile(appClient, reviewerId, async () => {
        await appClient.query("UPDATE public.provenance_audit SET details = details || jsonb_build_object('test','x') WHERE true LIMIT 1");
      });
      fail('provenance_audit update unexpectedly succeeded');
    } catch (err) {
      console.log('provenance_audit update correctly failed');
    }

    try {
      await asProfile(appClient, reviewerId, async () => {
        await appClient.query("DELETE FROM public.provenance_audit WHERE true LIMIT 1");
      });
      fail('provenance_audit delete unexpectedly succeeded');
    } catch (err) {
      console.log('provenance_audit delete correctly failed');
    }

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

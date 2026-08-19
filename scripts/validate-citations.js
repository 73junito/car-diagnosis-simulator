#!/usr/bin/env node
/**
 * Deterministic Citation Validator
 *
 * Purpose: Generate evidence-backed citation_validations records by verifying:
 * 1. Source and chunk approval status
 * 2. Excerpt content matches (normalized comparison)
 * 3. SHA-256 hashes recompute correctly
 * 4. Source URLs are valid and match
 *
 * Usage:
 *   node scripts/validate-citations.js --scenario no-crank --dry-run
 *   node scripts/validate-citations.js --scenario no-crank
 *
 * Environment Variables:
 *   SUPABASE_URL - Database URL (required)
 *   SUPABASE_SERVICE_KEY - Service role key with write access (required)
 *   PORT - Optional, for logging
 */
const crypto = require('crypto');
// Parse CLI arguments
const args = process.argv.slice(2);
const scenarioArg = args.find(arg => arg.startsWith('--scenario=')) || args[args.indexOf('--scenario') + 1];
const dryRun = args.includes('--dry-run');
const scenario = scenarioArg?.replace('--scenario=', '') || 'no-crank';
if (!process.env.SUPABASE_URL) {
  console.error('❌ Error: Missing SUPABASE_URL environment variable');
  process.exit(1);
}
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!dryRun && !serviceKey) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_KEY or SUPABASE_KEY environment variable');
  console.error('   Required for writing validation records to database');
  console.error('   Set one of:');
  console.error('     $env:SUPABASE_SERVICE_KEY = "your-service-role-key"');
  console.error('     $env:SUPABASE_KEY = "your-service-role-key"');
  console.error('   Or use --dry-run to only query and validate without writing');
  process.exit(1);
}
const { createClient } = require('@supabase/supabase-js');
// Use service key for writing, or anon key for dry-run query-only
const clientKey = serviceKey || anonKey;
if (!clientKey) {
  console.error('❌ Error: Missing SUPABASE_ANON_KEY for read-only access');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  clientKey
);
const VALIDATOR_VERSION = 'citation-validator-1.0';
const VALIDATION_METHOD = 'deterministic-source-chunk-verification';
/**
 * Normalize text for comparison: trim, collapse whitespace, lowercase
 */
function normalize(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
/**
 * Compute SHA-256 hash of text
 */
function computeHash(text) {
  return crypto
    .createHash('sha256')
    .update(text.trim())
    .digest('hex');
}
/**
 * Enforce hard failures on database errors
 * Do not silently skip or continue on query failures
 */
function requireQuery(result, context) {
  if (result.error) {
    throw new Error(
      `${context}: ${result.error.code || 'UNKNOWN'} - ${result.error.message || JSON.stringify(result.error)}`
    );
  }
  if (result.data === undefined) {
    throw new Error(`${context}: No data returned from query`);
  }
  return result.data;
}
/**
 * Approved source hostnames for SSRF prevention
 * Only URLs from these approved hosts can be marked as valid
 */
const APPROVED_HOSTS = new Set([
  'nhtsa.gov',
  'static.nhtsa.gov',
  'fordservicecontent.com',
  'fluke.com'
]);
/**
 * Normalize and validate a URL as HTTPS from an approved host
 * Throws on any validation failure
 */
function normalizeUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:') {
    throw new Error('Canonical source URL must use HTTPS');
  }
  const hostname = parsed.hostname.toLowerCase();
  const approved = [...APPROVED_HOSTS].some(
    host => hostname === host || hostname.endsWith(`.${host}`)
  );
  if (!approved) {
    throw new Error(`Unapproved source hostname: ${hostname}`);
  }
  parsed.hash = '';
  return parsed.toString();
}
/**
 * Verify URL with real HTTP request
 * Records result with status code, redirect handling, and timestamp
 * Rejects redirects, non-2xx responses, and unapproved hosts
 */
async function verifyCanonicalUrl(canonicalUrl) {
  const requestedUrl = normalizeUrl(canonicalUrl);
  const response = await fetch(requestedUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      'User-Agent': 'AutoLearnPro-Citation-Validator/1.0'
    }
  });
  let redirectCount = 0;
  if (response.status >= 300 && response.status < 400) {
    redirectCount = 1;
    throw new Error('Redirect requires explicit approved-host validation');
  }
  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}`);
  }
  return {
    valid: true,
    canonical_url: requestedUrl,
    requested_url: requestedUrl,
    final_url: requestedUrl,
    hostname: new URL(requestedUrl).hostname,
    http_status: response.status,
    checked_at: new Date().toISOString(),
    redirect_count: redirectCount
  };
}
/**
 * Validate a single approved question
 */
async function validateQuestion(provenance) {
  const errors = [];
  const evidence = {
    citation_ids: [],
    chunk_ids: [],
    calculated_hashes: [],
    excerpts_comparison: []
  };
  let sourceHashesVerified = true;
  let excerptsVerified = true;
  let urlsVerified = true;
  try {
    // Load question citations
    const { data: citations, error: citError } = await supabase
      .from('question_citations')
      .select('*')
      .eq('question_provenance_id', provenance.id);
    const citationsList = requireQuery(
      { data: citations, error: citError },
      `Load citations for question ${provenance.question_id}`
    );
    if (!Array.isArray(citationsList) || citationsList.length === 0) {
      errors.push('No citations found for this question');
      return {
        question_id: provenance.question_id,
        result: 'invalid',
        source_hashes_verified: false,
        excerpts_verified: false,
        urls_verified: false,
        errors
      };
    }
    // Verify each citation
    for (const citation of citationsList) {
      // Load source
      const srcResult = await supabase
        .from('approved_sources')
        .select('*')
        .eq('id', citation.source_id)
        .single();
      let source;
      try {
        source = requireQuery(srcResult, `Load source ${citation.source_id} for citation ${citation.id}`);
      } catch (err) {
        errors.push(`Citation ${citation.id}: ${err.message}`);
        urlsVerified = false;
        excerptsVerified = false;
        sourceHashesVerified = false;
        continue;
      }
      if (source.status !== 'approved') {
        errors.push(`Citation ${citation.id}: Source status is '${source.status}', not 'approved'`);
        urlsVerified = false;
        excerptsVerified = false;
        sourceHashesVerified = false;
        continue;
      }
      // Load chunk
      const chunkResult = await supabase
        .from('source_chunks')
        .select('*')
        .eq('chunk_id', citation.chunk_id)
        .single();
      let chunk;
      try {
        chunk = requireQuery(chunkResult, `Load chunk ${citation.chunk_id} for citation ${citation.id}`);
      } catch (err) {
        errors.push(`Citation ${citation.id}: ${err.message}`);
        urlsVerified = false;
        excerptsVerified = false;
        sourceHashesVerified = false;
        continue;
      }
      if (chunk.status !== 'approved') {
        errors.push(`Citation ${citation.id}: Chunk status is '${chunk.status}', not 'approved'`);
        urlsVerified = false;
        excerptsVerified = false;
        sourceHashesVerified = false;
        continue;
      }
      // Record evidence - FIX: use chunk.chunk_id, not chunk.id
      evidence.citation_ids.push(citation.id);
      evidence.chunk_ids.push(chunk.chunk_id);
      // Verify excerpt content (excerpts_verified)
      const storedQuote = normalize(citation.quote);
      const approvedExcerpt = normalize(chunk.text_excerpt);
      const excerptMatches = storedQuote === approvedExcerpt;
      evidence.excerpts_comparison.push({
        chunk_id: chunk.id,
        stored_quote: citation.quote,
        approved_excerpt: chunk.text_excerpt,
        normalized_match: excerptMatches
      });
      if (!excerptMatches) {
        errors.push(
          `Citation ${citation.id}: Quote mismatch. ` +
          `Stored: "${storedQuote.substring(0, 50)}..." vs ` +
          `Approved: "${approvedExcerpt.substring(0, 50)}..."`
        );
        excerptsVerified = false;
      }
      // Verify hash (source_hashes_verified)
      const recomputedHash = computeHash(chunk.text_excerpt);
      const canonicalHash = chunk.text_hash;
      const hashMatches = recomputedHash === canonicalHash;
      evidence.calculated_hashes.push({
        chunk_id: chunk.id,
        canonical: canonicalHash,
        recomputed: recomputedHash,
        match: hashMatches
      });
      if (!hashMatches) {
        errors.push(
          `Citation ${citation.id}: Hash mismatch. ` +
          `Canonical: ${canonicalHash} vs ` +
          `Recomputed: ${recomputedHash}`
        );
        sourceHashesVerified = false;
      }
      // Verify URL (urls_verified)
      // storage_path is the authoritative HTTPS URL from approved_sources
      const sourceUrl = source.storage_path;
      if (!sourceUrl) {
        errors.push(
          `Citation ${citation.id}: Source missing storage_path URL`
        );
        urlsVerified = false;
      } else {
        try {
          const urlEvidence = await verifyCanonicalUrl(sourceUrl);
          const urlMatches = urlEvidence.valid === true;
          if (!urlMatches) {
            errors.push(
              `Citation ${citation.id}: URL verification failed`
            );
            urlsVerified = false;
          } else {
            // Record successful URL check with evidence
            if (!evidence.url_checks) {
              evidence.url_checks = [];
            }
            evidence.url_checks.push({
              citation_id: citation.id,
              canonical_url: urlEvidence.canonical_url,
              requested_url: urlEvidence.requested_url,
              final_url: urlEvidence.final_url,
              hostname: urlEvidence.hostname,
              http_status: urlEvidence.http_status,
              checked_at: urlEvidence.checked_at,
              redirect_count: urlEvidence.redirect_count
            });
          }
        } catch (error) {
          errors.push(
            `Citation ${citation.id}: URL verification error - ${error.message}`
          );
          urlsVerified = false;
        }
      }
    }
    // Determine overall result
    const result =
      sourceHashesVerified && excerptsVerified && urlsVerified ? 'valid' : 'invalid';

    // NOTE: evidence object is computed internally for audit trail context
    // but only migration-defined columns are upseried to citation_validations table
    // to prevent schema mismatch errors. Evidence is not persisted to database.

    return {
      question_provenance_id: provenance.id,
      validator_version: VALIDATOR_VERSION,
      validation_method: VALIDATION_METHOD,
      source_hashes_verified: sourceHashesVerified,
      excerpts_verified: excerptsVerified,
      urls_verified: urlsVerified,
      result,
      errors,
      validated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Unexpected error validating question:`, error);
    return {
      question_provenance_id: provenance.id,
      validator_version: VALIDATOR_VERSION,
      validation_method: VALIDATION_METHOD,
      result: 'invalid',
      source_hashes_verified: false,
      excerpts_verified: false,
      urls_verified: false,
      errors: [error.message],
      validated_at: new Date().toISOString()
    };
  }
}
/**
 * Main validator function
 */
async function main() {
  console.log(`\n📋 Citation Validator Starting`);
  console.log(`   Scenario: ${scenario}`);
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`   Validator Version: ${VALIDATOR_VERSION}\n`);
  try {
    // Load validated and approved questions for this scenario
    // Supports both initial validation (validated status) and revalidation of approved records
    // Validator runs against both, updating citation_validations for each run
    // Endpoint serves only where provenance.status = 'approved' AND citation_validations.result = 'valid'
    const provResult = await supabase
      .from('question_provenance')
      .select('*')
      .in('status', ['validated', 'approved'])
      .like('question_id', `${scenario}-%`);
    const provenanceRecords = requireQuery(
      provResult,
      `Load validated/approved questions for scenario '${scenario}'`
    );
    if (!Array.isArray(provenanceRecords) || provenanceRecords.length === 0) {
      console.error(`❌ No validated or approved questions found for scenario: ${scenario}`);
      process.exit(1);
    }
    console.log(`✓ Found ${provenanceRecords.length} validated/approved questions\n`);
    // Validate each question
    const results = [];
    let validCount = 0;
    let invalidCount = 0;
    for (const provenance of provenanceRecords) {
      const validation = await validateQuestion(provenance);
      results.push(validation);
      if (validation.result === 'valid') {
        validCount++;
        console.log(`✅ ${validation.question_id}: VALID`);
      } else {
        invalidCount++;
        console.log(`❌ ${validation.question_id}: INVALID`);
        if (validation.errors.length > 0) {
          validation.errors.forEach(err => console.log(`   └─ ${err}`));
        }
      }
    }
    console.log(`\n📊 Validation Summary`);
    console.log(`   Valid: ${validCount}/${provenanceRecords.length}`);
    console.log(`   Invalid: ${invalidCount}/${provenanceRecords.length}`);
    if (dryRun) {
      console.log(`\n⏸️  DRY RUN: No records written to database`);
      process.exit(validCount === provenanceRecords.length ? 0 : 1);
    }
    // Upsert validation records
    console.log(`\n💾 Writing validation records...`);
    for (const result of results) {
      const { error: upsertError } = await supabase
        .from('citation_validations')
        .upsert(result, {
          onConflict: 'question_provenance_id,validator_version'
        });
      if (upsertError) {
        console.error(`❌ Failed to upsert validation for ${result.question_id}:`, upsertError);
        process.exit(1);
      }
      console.log(`✓ Upserted: ${result.question_id}`);
    }
    console.log(`\n✅ Citation validation complete`);
    console.log(`   Records: ${results.length}`);
    console.log(`   Valid: ${validCount}`);
    console.log(`   Invalid: ${invalidCount}\n`);
    process.exit(validCount === provenanceRecords.length ? 0 : 1);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}
main();

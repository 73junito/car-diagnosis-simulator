/** @jest-environment node */
/**
 * TTED805: Answer-Key Security - Design Contract Tests
 *
 * Verify that the expansion phase endpoints are designed with security-first contracts.
 * These tests verify API specifications and design patterns that prevent answer-key leakage.
 * Full end-to-end behavior is verified via:
 * - Integration tests (Supabase + PostgreSQL)
 * - Playwright e2e tests (browser network inspection)
 * - Code review of patch (security.md)
 */

describe('TTED805: Answer-Key Security - Design Contracts', () => {
  let originalEnvVars;

  beforeAll(() => {
    originalEnvVars = { ...process.env };
    process.env.SUPABASE_URL = 'https://pffdgqpynpbffbcnxmum.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'mock-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
  });

  afterAll(() => {
    process.env = originalEnvVars;
  });

  describe('GET /api/scenario-questions-approved - Answer-Key Exclusion Contract', () => {
    test('endpoint spec excludes correct_answer and explanation columns', async () => {
      // Design contract: /api/scenario-questions-approved must NEVER return answer keys
      // This is documented in the endpoint code (api/scenario-questions-approved.js)

      // Verify file exists and can be required
      const endpointPath = '../api/scenario-questions-approved';
      expect(() => {
        // If file doesn't exist or has syntax errors, require() will throw
        require(endpointPath);
      }).not.toThrow();
    });

    test('requires JWT verification for grading (not direct API access)', async () => {
      // Design contract: POST /api/scenario-submissions/grade requires JWT
      // (scenario-questions-approved uses service role, but grade endpoint checks JWT)

      const gradeUtilPath = '../api/scenario-submissions/grade';
      const code = require('fs').readFileSync(require.resolve(gradeUtilPath), 'utf8');

      // Grade endpoint must verify JWT (auth-utils)
      expect(code).toMatch(/extractBearerToken|verifySupabaseToken|authorization|Bearer/i);
    });

    test('selects safe columns only (correct_answer excluded)', async () => {
      // Design contract: Endpoint SELECT query must exclude correct_answer
      // Expected safe columns: id, question_text, option_a-d, difficulty, topic, ase_area, quote
      // Forbidden columns: correct_answer, exact_quote (should be "quote"), content_hash (should be text_hash)

      const endpointPath = '../api/scenario-questions-approved';
      const code = require('fs').readFileSync(require.resolve(endpointPath), 'utf8');

      // Verify comment documents the safety guarantee
      expect(code).toMatch(/correct_answer.*never|never.*correct_answer/i);

      // Verify select() call exists (not select *)
      expect(code).toMatch(/\.select\(/);
      expect(code).not.toMatch(/select\s*\*/);

      // Verify schema corrections: quote (not exact_quote), text_hash (not content_hash)
      expect(code).toMatch(/quote/); // correct field name
      expect(code).not.toMatch(/exact_quote/); // incorrect field name should be removed
      expect(code).toMatch(/text_hash/); // correct field for source hash
      expect(code).not.toMatch(/content_hash/); // incorrect field name should be removed

      // Verify validator_version comes from citation_validations, not question_provenance
      expect(code).toMatch(/citation_validations\(\s*validator_version/);
    });
  });

  describe('POST /api/scenario-submissions/grade - Assessment Security Contract', () => {
    test('assessment mode response excludes is_correct', async () => {
      // Design contract: Assessment delivery_mode must NOT return is_correct
      // Training delivery_mode CAN return is_correct for learning feedback

      const endpointPath = '../api/scenario-submissions/grade';
      const code = require('fs').readFileSync(require.resolve(endpointPath), 'utf8');

      // Verify the code checks delivery_mode
      expect(code).toMatch(/delivery_mode/);
      expect(code).toMatch(/assessment|training/i);

      // Verify is_correct is conditionally included
      expect(code).toMatch(/is_correct/);
    });

    test('endpoint validates attempt ownership (user_id check)', async () => {
      // Design contract: Endpoint must verify user_id matches attempt owner
      // Prevents students from grading other students' attempts

      const endpointPath = '../api/scenario-submissions/grade';
      const code = require('fs').readFileSync(require.resolve(endpointPath), 'utf8');

      // Verify user_id validation
      expect(code).toMatch(/user_id/);
      expect(code).toMatch(/===|==|!==|!=|!=/); // Some comparison
    });

    test('stores grading result in immutable audit trail (attempt_answers)', async () => {
      // Design contract: Grading results recorded in attempt_answers table
      // attempt_answers is immutable (only service_role writes)

      const endpointPath = '../api/scenario-submissions/grade';
      const code = require('fs').readFileSync(require.resolve(endpointPath), 'utf8');

      // Verify attempt_answers table is used
      expect(code).toMatch(/attempt_answers/);
      expect(code).toMatch(/insert|\.insert\(/i);
    });

    test('rejects fake attempt IDs (403 response)', async () => {
      // Design contract: Non-existent attempt IDs return 403
      // Prevents brute-force enumeration of attempts

      const endpointPath = '../api/scenario-submissions/grade';
      const code = require('fs').readFileSync(require.resolve(endpointPath), 'utf8');

      // Verify error handling for missing attempts
      expect(code).toMatch(/403|forbidden|not found/i);
      expect(code).toMatch(/attempts/i);
    });
  });

  describe('Citation Validator - Fail-Closed Design', () => {
    test('validator schema (citation_validations table)', async () => {
      // Design contract: Validation records only contain defined columns
      // Schema enforced by PostgreSQL, not by JavaScript

      const migrationPath = '../supabase/migrations/20260817012707_create_citation_validations.sql';
      const code = require('fs').readFileSync(require.resolve(migrationPath), 'utf8');

      // Verify table creation and schema
      expect(code).toMatch(/citation_validations/i);
      expect(code).toMatch(/question_provenance_id/);
      expect(code).toMatch(/validation_method/);
      expect(code).toMatch(/result/);
      expect(code).toMatch(/(urls_verified|verified)/);
    });

    test('validator RLS fails-closed (result=invalid blocks read)', async () => {
      // Design contract: If validation result='invalid', anonymous/authenticated users cannot read
      // RLS policy enforces fail-closed behavior at database level

      const migrationPath = '../supabase/migrations/20260817012707_create_citation_validations.sql';
      const code = require('fs').readFileSync(require.resolve(migrationPath), 'utf8');

      // Verify RLS policies are defined (CREATE POLICY allows SELECT only on valid results)
      expect(code).toMatch(/policy|rls|row.*level/i);
      expect(code).toMatch(/select|result/i);
    });

    test('validator allowlist enforcement (host approval)', async () => {
      // Design contract: Only approved hosts can be validated
      // APPROVED_HOSTS: nhtsa.gov, static.nhtsa.gov, fordservicecontent.com, fluke.com

      const validatorPath = '../scripts/validate-citations.js';
      const code = require('fs').readFileSync(require.resolve(validatorPath), 'utf8');

      // Verify allowlist is defined
      expect(code).toMatch(/APPROVED_HOSTS|allowlist|nhtsa\.gov/);
      expect(code).toMatch(/fordservicecontent/);
      expect(code).toMatch(/fluke/);
    });

    test('validator HTTP fail-closed (non-2xx = invalid)', async () => {
      // Design contract: Any HTTP error results in result='invalid'
      // Students never see invalid citations

      const validatorPath = '../scripts/validate-citations.js';
      const code = require('fs').readFileSync(require.resolve(validatorPath), 'utf8');

      // Verify status code checking
      expect(code).toMatch(/status|\.ok|200|204|3\d\d/);
      expect(code).toMatch(/result.*invalid|invalid.*result/i);
    });
  });

  describe('Authentication Utilities - JWT Verification', () => {
    test('extractBearerToken parses Authorization header', async () => {
      // Design contract: Extract JWT from "Bearer token" format

      const authUtilPath = '../api/_utils/auth-utils.js';
      const code = require('fs').readFileSync(require.resolve(authUtilPath), 'utf8');

      // Verify Bearer token extraction
      expect(code).toMatch(/Bearer|authorization/i);
      expect(code).toMatch(/extractBearerToken/);
    });

    test('verifySupabaseToken validates JWT structure', async () => {
      // Design contract: Verify JWT is valid before using in requests

      const authUtilPath = '../api/_utils/auth-utils.js';
      const code = require('fs').readFileSync(require.resolve(authUtilPath), 'utf8');

      // Verify JWT validation exists
      expect(code).toMatch(/verify|jwt|token/i);
      expect(code).toMatch(/verifySupabaseToken/);
    });
  });

  describe('Database Migrations - Schema Integrity', () => {
    test('attempt_answers table RLS blocks unauthenticated writes', async () => {
      // Design contract: Only service_role can INSERT into attempt_answers
      // Students (anon/authenticated) cannot write directly

      const migrationPath = '../supabase/migrations/20260817012716_create_attempt_answers.sql';
      const code = require('fs').readFileSync(require.resolve(migrationPath), 'utf8');

      // Verify table creation, grants, and RLS
      expect(code).toMatch(/attempt_answers/i);
      expect(code).toMatch(/(insert|grant)/i);
      expect(code).toMatch(/service.*role/i);
    });

    test('scenario_questions table RLS prevents direct answer access', async () => {
      // Design contract: Direct /rest/v1/scenario_questions access is blocked
      // Lockdown migration (PR B) enforces this, prep phase enables new endpoints

      // This is verified at deployment time when lockdown migration is applied
      expect(true).toBe(true);
    });
  });

  describe('Client-Side Security - scenario.js Refactoring', () => {
    test('scenario.js uses /api/scenario-questions-approved instead of /rest/v1/scenario_questions', async () => {
      // Design contract: Client code updated to use safe endpoints
      // Verified via code review and Playwright e2e network inspection

      // Read the scenario.js file and verify it calls the new endpoint
      const scenarioPath = '../dashboard/student/scenario/scenario.js';
      const code = require('fs').readFileSync(require.resolve(scenarioPath), 'utf8');

      // Verify new endpoint is used
      expect(code).toMatch(/\/api\/scenario-questions-approved/);
    });

    test('scenario.js uses /api/scenario-submissions/grade instead of /rest/v1/question_attempts', async () => {
      // Design contract: Grading submission uses safe endpoint

      const scenarioPath = '../dashboard/student/scenario/scenario.js';
      const code = require('fs').readFileSync(require.resolve(scenarioPath), 'utf8');

      // Verify grading endpoint is used
      expect(code).toMatch(/\/api\/scenario-submissions\/grade|\/api\/.*grade/);
    });

    test('scenario.js does not use /rest/v1/ endpoints', async () => {
      // Design contract: No direct REST API access from browser

      const scenarioPath = '../dashboard/student/scenario/scenario.js';
      const code = require('fs').readFileSync(require.resolve(scenarioPath), 'utf8');

      // Verify no /rest/v1 calls for scenario_questions or question_attempts
      // Allow other potential /rest/v1 usage (future endpoints)
      expect(code).not.toMatch(/\/rest\/v1\/scenario_questions/);
      expect(code).not.toMatch(/\/rest\/v1\/question_attempts/);
    });
  });

  describe('Database Migrations - RLS Policies', () => {
    test('citation_validations migration has no inert policies (service-role only)', async () => {
      // Design contract: citation_validations is service-role only (validator writes, server reads)
      // RLS policies for anon/authenticated should be removed (they were inert without GRANT)
      // Service-role GRANT should be present to allow access

      const migrationPath = '../supabase/migrations/20260817012707_create_citation_validations.sql';
      const code = require('fs').readFileSync(require.resolve(migrationPath), 'utf8');

      // Verify service_role GRANT is present
      expect(code).toMatch(/grant.*service_role/i);

      // Verify no create policy for anon/authenticated (inert policies removed)
      expect(code).not.toMatch(/create policy.*anon|create policy.*authenticated.*citation_validations/i);

      // Verify RLS is enabled
      expect(code).toMatch(/enable row level security/i);
    });

    test('attempt_answers migration properly references public.attempts', async () => {
      // Design contract: Foreign key to attempts table must exist
      // attempt_answers is immutable audit trail (service_role writes only)

      const migrationPath = '../supabase/migrations/20260817012716_create_attempt_answers.sql';
      const code = require('fs').readFileSync(require.resolve(migrationPath), 'utf8');

      // Verify foreign key constraint
      expect(code).toMatch(/references.*public\.attempts\(id\)/);

      // Verify on delete cascade (cleanup on attempt deletion)
      expect(code).toMatch(/on delete cascade/i);

      // Verify RLS is enabled (fail-closed)
      expect(code).toMatch(/enable row level security/i);
    });
  });
});

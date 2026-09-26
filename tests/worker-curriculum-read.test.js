/** @jest-environment node */
/**
 * Curriculum read API (GET /api/curriculum) contract and behavior tests.
 *
 * The contract test drives the real worker route with Supabase rows mocked
 * from the static data/curriculum JSON, then validates the response with the
 * exact validator exported by scripts/verify-curriculum-api-contract.js.
 * This proves the API output is validated against the same contract as the
 * static source that /learning-path/ keeps using until this gate passes.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const { createClient } = require('@supabase/supabase-js');
const worker = require('../worker/index.js').default;
const {
  loadStaticContract,
  validateCurriculumApiContract
} = require('../scripts/verify-curriculum-api-contract.js');

const staticContract = loadStaticContract();
const SERVICE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key-do-not-leak'
};

function buildRows() {
  const pathways = [];
  const programs = [];
  for (const pathway of staticContract.pathways) {
    pathways.push({
      id: pathway.id,
      academic_level: pathway.academicLevel,
      status: pathway.status
    });
    programs.push({
      id: pathway.programId,
      pathway_id: pathway.id,
      academic_level: pathway.academicLevel,
      cip_code: pathway.cipCode,
      program_name: pathway.programName,
      cip_title: pathway.cipTitle,
      status: pathway.status
    });
  }

  const programByLevel = new Map(
    staticContract.pathways.map((pathway) => [pathway.academicLevel, pathway.programId])
  );

  const courses = staticContract.courses.map((course) => ({
    id: course.id,
    program_id: programByLevel.get(course.academicLevel),
    academic_level: course.academicLevel,
    cip_code: course.cipCode,
    title: course.title,
    status: course.status
  }));

  const competencies = staticContract.competencies.map((competency) => ({
    id: competency.id,
    course_id: competency.courseId,
    academic_level: competency.academicLevel,
    statement: competency.statement,
    status: competency.status
  }));

  const lessonPlans = [];
  const lessonSteps = [];
  for (const lessonPlan of staticContract.lessonPlans) {
    lessonPlans.push({
      id: lessonPlan.id,
      course_id: lessonPlan.courseId,
      competency_id: lessonPlan.competencyId,
      academic_level: lessonPlan.academicLevel,
      title: lessonPlan.title,
      status: lessonPlan.status
    });
    lessonPlan.sequence.forEach((stepText, index) => {
      lessonSteps.push({
        lesson_plan_id: lessonPlan.id,
        position: index + 1,
        step_text: stepText
      });
    });
  }

  const scenarioMappings = staticContract.scenarioMappings.map((mapping) => ({
    scenario_id: mapping.scenarioId,
    lesson_plan_id: mapping.lessonPlanId,
    competency_id: mapping.competencyId,
    course_id: mapping.courseId,
    academic_level: mapping.academicLevel,
    cip_code: mapping.cipCode,
    status: mapping.status
  }));

  return {
    curriculum_pathways: pathways,
    curriculum_programs: programs,
    curriculum_courses: courses,
    curriculum_competencies: competencies,
    curriculum_lesson_plans: lessonPlans,
    curriculum_lesson_steps: lessonSteps,
    scenario_curriculum_mappings: scenarioMappings
  };
}


const ROWS = buildRows();
const selectCalls = [];
let failTable = null;
let omitPrograms = false;

function installSupabaseMock() {
  createClient.mockImplementation(() => ({
    from(table) {
      return {
        select(columns) {
          selectCalls.push({ table, columns });
          return {
            order() {
              if (failTable === table) {
                return Promise.resolve({ data: null, error: { message: 'simulated failure' } });
              }
              if (table === 'curriculum_programs' && omitPrograms) {
                return Promise.resolve({ data: [], error: null });
              }
              return Promise.resolve({ data: ROWS[table], error: null });
            }
          };
        }
      };
    }
  }));
}

async function fetchCurriculum(env = SERVICE_ENV, init) {
  return worker.fetch(
    new Request('https://app.autolearnpro.com/api/curriculum', init),
    env,
    {}
  );
}

describe('GET /api/curriculum', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    failTable = null;
    omitPrograms = false;
    selectCalls.length = 0;
    createClient.mockReset();
    installSupabaseMock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns 200 with a payload that satisfies the static curriculum contract', async () => {
    const response = await fetchCurriculum();

    expect(response.status).toBe(200);
    const payload = await response.json();

    const errors = validateCurriculumApiContract(payload, staticContract);
    expect(errors).toEqual([]);

    expect(payload.pathways).toHaveLength(2);
    expect(payload.courses).toHaveLength(9);
    expect(payload.competencies).toHaveLength(9);
    expect(payload.lessonPlans).toHaveLength(9);
    expect(payload.scenarioMappings).toHaveLength(2);
  });

  test('never exposes the service-role key or database internals', async () => {
    const response = await fetchCurriculum();
    const body = await response.text();

    expect(body).not.toContain(SERVICE_ENV.SUPABASE_SERVICE_ROLE_KEY);
    expect(body).not.toContain('academic_level');
    expect(body).not.toContain('competency_area_id');
    expect(body).not.toContain('chunk_id');
  });

  test('rejects non-GET methods with 405', async () => {
    const response = await fetchCurriculum(SERVICE_ENV, { method: 'POST', body: '{}' });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed' });
  });

  test('fails closed with 500 when service configuration is missing', async () => {
    const response = await fetchCurriculum({});

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server configuration incomplete' });
    expect(createClient).not.toHaveBeenCalled();
  });

  test('fails closed with 500 when any curriculum query fails', async () => {
    failTable = 'curriculum_courses';
    const response = await fetchCurriculum();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server error' });
  });

  test('fails closed with 500 when a pathway has no program row', async () => {
    omitPrograms = true;
    const response = await fetchCurriculum();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server error' });
  });
});


describe('GET /api/curriculum CORS', () => {
  test('allows preflight from the production app origin', async () => {
    const response = await fetchCurriculum(SERVICE_ENV, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.autolearnpro.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://app.autolearnpro.com'
    );
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  test('does not allow arbitrary origins', async () => {
    const response = await fetchCurriculum(SERVICE_ENV, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.example',
        'Access-Control-Request-Method': 'GET'
      }
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe(
      'https://malicious.example'
    );
  });
});

describe('Curriculum read API design contracts', () => {
  const handlerPath = path.join(__dirname, '..', 'worker', 'routes', 'curriculum-read.js');
  const indexPath = path.join(__dirname, '..', 'worker', 'index.js');
  const handlerSource = fs.readFileSync(handlerPath, 'utf8');
  const indexSource = fs.readFileSync(indexPath, 'utf8');

  test('handler reads with explicit columns only (never all columns)', () => {
    expect(handlerSource).toMatch(/\.select\(/);
    expect(handlerSource).not.toMatch(/\.select\(\s*['"][^'"]*\*/);
    expect(handlerSource).not.toMatch(/select\s+\*/i);
  });

  test('handler is read-only (no writes or RPC calls)', () => {
    expect(handlerSource).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });

  test('handler authenticates with service role only', () => {
    expect(handlerSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(handlerSource).not.toMatch(/SUPABASE_ANON_KEY/);
  });

  test('all observed queries use explicit column lists', () => {
    expect(selectCalls.length).toBeGreaterThan(0);
    for (const call of selectCalls) {
      expect(call.columns).not.toContain('*');
      expect(call.columns).toMatch(/^[a-z_]+(, [a-z_]+)+$/);
    }
  });

  test('worker registers /api/curriculum with app-origin CORS', () => {
    expect(indexSource).toMatch(/app\.all\(\s*['"]\/api\/curriculum['"]/);
    expect(indexSource).toMatch(/app\.use\(\s*['"]\/api\/curriculum\/\*['"]/);
    expect(indexSource).toMatch(/origin:\s*['"]https:\/\/app\.autolearnpro\.com['"]/);
  });
});


describe('verify-curriculum-api-contract CLI', () => {
  const scriptPath = path.join(__dirname, '..', 'scripts', 'verify-curriculum-api-contract.js');
  let tmpFile;

  beforeAll(async () => {
    // Prior describes end with afterEach restoreAllMocks, which clears the
    // module mock implementation; reinstall it before generating the payload.
    createClient.mockReset();
    installSupabaseMock();
    failTable = null;
    omitPrograms = false;
    const response = await fetchCurriculum();
    if (!response.ok) {
      throw new Error(`fixture fetch failed: ${response.status} ${await response.text()}`);
    }
    const payload = await response.json();
    tmpFile = path.join(os.tmpdir(), `curriculum-api-response-${process.pid}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
  });

  afterAll(() => {
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  test('passes for a valid API response file', () => {
    const output = execFileSync(process.execPath, [scriptPath, '--file', tmpFile], {
      encoding: 'utf8'
    });

    expect(output).toContain('[PASS] Curriculum API contract verified');
    expect(output).toContain('2 pathways');
    expect(output).toContain('9 courses');
  });

  test('fails for a tampered API response file', () => {
    const payload = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    payload.pathways = payload.pathways.filter((pathway) => pathway.id !== 'graduate');
    const tamperedFile = path.join(os.tmpdir(), `curriculum-api-tampered-${process.pid}.json`);
    fs.writeFileSync(tamperedFile, JSON.stringify(payload));

    try {
      expect(() =>
        execFileSync(process.execPath, [scriptPath, '--file', tamperedFile], {
          encoding: 'utf8',
          stdio: 'pipe'
        })
      ).toThrow();
    } finally {
      fs.unlinkSync(tamperedFile);
    }
  });

  test('fails with usage guidance when no arguments are provided', () => {
    expect(() =>
      execFileSync(process.execPath, [scriptPath], { encoding: 'utf8', stdio: 'pipe' })
    ).toThrow();
  });
});

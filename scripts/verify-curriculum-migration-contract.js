'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pathways = readJson('data/curriculum/academic-pathways.json').pathways;
const undergraduateCourses = readJson('data/curriculum/undergraduate-courses.json').courses;
const graduateCourses = readJson('data/curriculum/graduate-courses.json').courses;
const competencies = readJson('data/curriculum/competencies.json').competencies;
const lessonPlans = readJson('data/curriculum/lesson-plans.json').lessonPlans;
const scenarioMappings = readJson('data/curriculum/scenario-mappings.json').scenarioMappings;

const migrationsDir = path.join(root, 'supabase', 'migrations');
const matches = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith('_add_curriculum_schema.sql'));

assert(matches.length === 1, `Expected one curriculum schema migration, found ${matches.length}`);

const migration = fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');

const requiredTables = [
  'curriculum_pathways',
  'curriculum_programs',
  'curriculum_courses',
  'curriculum_competencies',
  'curriculum_lesson_plans',
  'curriculum_lesson_steps',
  'curriculum_lesson_evidence',
  'scenario_curriculum_mappings'
];

for (const table of requiredTables) {
  assert(migration.includes(`public.${table}`), `Migration is missing table ${table}`);
  assert(
    migration.includes(`alter table public.${table} enable row level security;`),
    `Migration must enable RLS on ${table}`
  );
  assert(
    migration.includes(`revoke all on table public.${table} from public, anon, authenticated;`),
    `Migration must revoke browser access on ${table}`
  );
}

const ids = [
  ...pathways.map((item) => item.id),
  ...pathways.map((item) => item.programId),
  ...undergraduateCourses.map((item) => item.id),
  ...graduateCourses.map((item) => item.id),
  ...competencies.map((item) => item.id),
  ...lessonPlans.map((item) => item.id),
  ...scenarioMappings.map((item) => item.scenarioId)
];

for (const id of ids) {
  assert(migration.includes(`'${id}'`), `Migration seed is missing ${id}`);
}

for (const lesson of lessonPlans) {
  for (const step of lesson.sequence) {
    assert(migration.includes(`'${step.replace(/'/g, "''")}'`), `Migration is missing lesson step: ${step}`);
  }
}

assert(
  migration.includes("'automotive-engineering-technology','graduate','graduate','15.0803'") &&
  migration.includes("'project-planned','planned'"),
  'Graduate program must remain explicitly project-planned'
);
assert(
  migration.includes("'automotive-technology','undergraduate','undergraduate','47.0604'") &&
  migration.includes("'verified','active'"),
  'Undergraduate program must retain verified active classification metadata'
);
assert(
  migration.includes("references public.source_chunks(chunk_id)"),
  'Lesson evidence must reference existing source_chunks rather than duplicate source metadata'
);

console.log(
  `[PASS] Curriculum migration contract verified: ${pathways.length} pathways, ` +
  `${undergraduateCourses.length + graduateCourses.length} courses, ` +
  `${competencies.length} competencies, ${lessonPlans.length} lesson plans, ` +
  `${scenarioMappings.length} scenario mappings`
);

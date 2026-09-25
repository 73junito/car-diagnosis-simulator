const fs = require('fs');
const vm = require('vm');

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const pathways = readJson('data/curriculum/academic-pathways.json').pathways;
const undergraduateCourses = readJson('data/curriculum/undergraduate-courses.json').courses;
const graduateCourses = readJson('data/curriculum/graduate-courses.json').courses;
const competencies = readJson('data/curriculum/competencies.json').competencies;
const lessonPlans = readJson('data/curriculum/lesson-plans.json').lessonPlans;
const scenarioMappings = readJson('data/curriculum/scenario-mappings.json').scenarioMappings;
const programs = readJson('docs/standards/kbor/programs.json').programs;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pathwayByLevel = new Map(pathways.map((item) => [item.academicLevel, item]));
const programByLevel = new Map(programs.map((item) => [item.academicLevel, item]));
const courseById = new Map([...undergraduateCourses, ...graduateCourses].map((item) => [item.id, item]));
const competencyById = new Map(competencies.map((item) => [item.id, item]));
const lessonById = new Map(lessonPlans.map((item) => [item.id, item]));

assert(pathwayByLevel.get('undergraduate')?.cipCode === '47.0604', 'Undergraduate pathway must use CIP 47.0604');
assert(pathwayByLevel.get('graduate')?.cipCode === '15.0803', 'Graduate pathway must use CIP 15.0803');
assert(programByLevel.get('undergraduate')?.cipCode === '47.0604', 'Program registry undergraduate CIP mismatch');
assert(programByLevel.get('graduate')?.cipCode === '15.0803', 'Program registry graduate CIP mismatch');
for (const course of courseById.values()) {
  assert(competencies.some((item) => item.courseId === course.id), `Missing competency for course ${course.id}`);
  assert(lessonPlans.some((item) => item.courseId === course.id), `Missing lesson plan for course ${course.id}`);
}

for (const competency of competencies) {
  const course = courseById.get(competency.courseId);
  assert(course, `Missing course for competency ${competency.id}`);
  assert(course.academicLevel === competency.academicLevel, `Academic level mismatch for competency ${competency.id}`);
}

for (const lesson of lessonPlans) {
  const course = courseById.get(lesson.courseId);
  const competency = competencyById.get(lesson.competencyId);
  assert(course, `Missing course for lesson ${lesson.id}`);
  assert(competency, `Missing competency for lesson ${lesson.id}`);
  assert(course.academicLevel === lesson.academicLevel, `Course/lesson level mismatch for ${lesson.id}`);
  assert(competency.academicLevel === lesson.academicLevel, `Competency/lesson level mismatch for ${lesson.id}`);
}

for (const mapping of scenarioMappings) {
  const course = courseById.get(mapping.courseId);
  const competency = competencyById.get(mapping.competencyId);
  const lesson = lessonById.get(mapping.lessonPlanId);
  assert(course && competency && lesson, `Broken scenario mapping for ${mapping.scenarioId}`);
  assert(mapping.academicLevel === lesson.academicLevel, `Scenario/lesson level mismatch for ${mapping.scenarioId}`);
  assert(mapping.cipCode === pathwayByLevel.get(mapping.academicLevel)?.cipCode, `Scenario CIP mismatch for ${mapping.scenarioId}`);
}

const source = fs.readFileSync('data/scenario-curriculum.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const charging = sandbox.window.SCENARIO_CURRICULUM['charging-system'];
assert(charging.academicLevel === 'undergraduate', 'Charging-system scenario must declare undergraduate');
assert(charging.cipCode === '47.0604', 'Charging-system scenario must declare CIP 47.0604');

console.log(`[PASS] Academic pathway data contract verified: ${pathways.length} pathways, ${courseById.size} courses, ${competencies.length} competencies, ${lessonPlans.length} lesson plans, ${scenarioMappings.length} scenario mappings`);
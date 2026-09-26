"use strict";

const fs = require("fs");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const architecture = readJson("data/curriculum/program-architecture.json");
const lessons = readJson("data/curriculum/lesson-plans.json").lessonPlans;
const undergraduateCourses = readJson("data/curriculum/undergraduate-courses.json").courses;
const graduateCourses = readJson("data/curriculum/graduate-courses.json").courses;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function sumCredits(items) {
  return items.reduce((sum, item) => sum + item.credits, 0);
}

assert(architecture.schemaVersion === "1.0.0", "Unsupported program architecture schema");
assert(Array.isArray(architecture.programs) && architecture.programs.length === 2,
  "Program architecture must define exactly undergraduate and graduate programs");

const programByLevel = new Map(architecture.programs.map((program) => [program.academicLevel, program]));
const undergraduate = programByLevel.get("undergraduate");
const graduate = programByLevel.get("graduate");

assert(undergraduate, "Missing undergraduate program architecture");
assert(graduate, "Missing graduate program architecture");
assert(undergraduate.cipCode === "47.0604", "Undergraduate CIP must be 47.0604");
assert(undergraduate.totalCredits === 68, "Undergraduate A.A.S. must total exactly 68 proposed credits");
assert(graduate.cipCode === "15.0803", "Graduate CIP must be 15.0803");
assert(graduate.cipTitle === "Automotive Engineering Technology/Technician", "Graduate CIP title mismatch");
assert(graduate.totalCredits === 30, "Graduate program must total exactly 30 proposed credits");

for (const program of architecture.programs) {
  const courseIds = new Set();
  const buckets = new Map(program.creditBuckets.map((bucket) => [bucket.id, bucket]));
  const bucketCredits = sumCredits(program.creditBuckets);
  assert(bucketCredits === program.totalCredits,
    "Credit buckets for " + program.id + " sum to " + bucketCredits + ", expected " + program.totalCredits);

  for (const course of program.courses) {
    assert(!courseIds.has(course.id), "Duplicate course id " + course.id);
    courseIds.add(course.id);
    assert(Number.isInteger(course.credits) && course.credits > 0,
      "Invalid credits for " + course.id);
    assert(buckets.has(course.bucket), "Unknown credit bucket " + course.bucket + " for " + course.id);
  }

  const courseCredits = sumCredits(program.courses);
  assert(courseCredits === program.totalCredits,
    "Course credits for " + program.id + " sum to " + courseCredits + ", expected " + program.totalCredits);

  for (const bucket of program.creditBuckets) {
    const actual = sumCredits(program.courses.filter((course) => course.bucket === bucket.id));
    assert(actual === bucket.credits,
      "Bucket " + bucket.id + " sums to " + actual + ", expected " + bucket.credits);
  }

  for (const course of program.courses) {
    for (const prerequisite of course.prerequisites || []) {
      assert(courseIds.has(prerequisite), "Unknown prerequisite " + prerequisite + " for " + course.id);
      assert(prerequisite !== course.id, "Course " + course.id + " cannot require itself");
    }
  }
}

const common = undergraduate.courses.filter((course) =>
  course.status === "verified-kansas-common-course"
);
assert(common.length === 4, "Undergraduate architecture must preserve four Kansas common courses");
assert(sumCredits(common) === 12, "Kansas common courses must total 12 credits");

const expectedCommonTitles = new Set([
  "Brakes I",
  "Electrical I",
  "Engine Performance I",
  "Suspension & Steering I"
]);
for (const course of common) {
  assert(course.credits === 3, "Kansas common course " + course.id + " must be 3 credits");
  assert(expectedCommonTitles.has(course.title), "Unexpected Kansas common course title " + course.title);
}

const genEdCredits = sumCredits(
  undergraduate.courses.filter((course) => course.bucket === "general-education")
);
assert(genEdCredits === 15, "Undergraduate general education must total 15 credits");

const lessonIds = new Set(lessons.map((lesson) => lesson.id));
const mappedLessons = new Set();

for (const program of architecture.programs) {
  for (const course of program.courses) {
    if (course.existingLessonPlanId) {
      assert(lessonIds.has(course.existingLessonPlanId),
        "Unknown mapped lesson " + course.existingLessonPlanId + " for " + course.id);
      assert(!mappedLessons.has(course.existingLessonPlanId),
        "Lesson " + course.existingLessonPlanId + " mapped more than once");
      mappedLessons.add(course.existingLessonPlanId);
    }
  }
  for (const item of program.supplementalGraduateContent || []) {
    assert(lessonIds.has(item.existingLessonPlanId),
      "Unknown supplemental lesson " + item.existingLessonPlanId);
    assert(!mappedLessons.has(item.existingLessonPlanId),
      "Lesson " + item.existingLessonPlanId + " mapped more than once");
    mappedLessons.add(item.existingLessonPlanId);
  }
}

assert(mappedLessons.size === lessons.length,
  "Expected all " + lessons.length + " existing lessons to be classified, found " + mappedLessons.size);

const existingUndergraduateCourseIds = new Set(undergraduateCourses.map((course) => course.id));
for (const course of undergraduate.courses.filter((item) => item.existingCourseId)) {
  assert(existingUndergraduateCourseIds.has(course.existingCourseId),
    "Unknown existing undergraduate course " + course.existingCourseId);
}

const existingGraduateCourseIds = new Set(graduateCourses.map((course) => course.id));
for (const item of graduate.supplementalGraduateContent || []) {
  assert(existingGraduateCourseIds.has(item.existingCourseId),
    "Unknown supplemental graduate course " + item.existingCourseId);
}

console.log(
  "[PASS] Program architecture verified: undergraduate " + undergraduate.totalCredits +
  " credits, graduate " + graduate.totalCredits +
  " credits, " + mappedLessons.size + " existing lessons classified"
);

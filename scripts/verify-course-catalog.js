"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const doc = JSON.parse(fs.readFileSync(path.join(root, "data", "curriculum", "course-catalog.json"), "utf8"));
const courses = doc.courses || [];
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const dupes = (values) => {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter((entry) => entry[1] > 1);
};
assert(doc.schemaVersion === "1.0.0", "Unexpected catalog schemaVersion");
assert(courses.length === 68, "Expected 68 courses, found " + courses.length);
const undergraduate = courses.filter((course) => course.academicLevel === "undergraduate");
const graduate = courses.filter((course) => course.academicLevel === "graduate");
assert(undergraduate.length === 43, "Expected 43 undergraduate courses, found " + undergraduate.length);
assert(graduate.length === 25, "Expected 25 graduate courses, found " + graduate.length);
for (const field of ["id", "code", "title", "url", "canonicalUrl"]) {
  assert(dupes(courses.map((course) => String(course[field]).trim().toLowerCase())).length === 0, "Duplicate " + field);
}
for (const course of courses) {
  assert(/^aut-\d{3}$/.test(course.id), "Invalid course id " + course.id);
  assert(/^AUT \d{3}$/.test(course.code), "Invalid course code " + course.code);
  assert(course.title && course.credits && course.prerequisites && course.description, "Incomplete record " + course.code);
  assert(course.url === "/catalog/course/?course=" + course.code.replace(" ", "-"), "Unexpected URL " + course.code);
  assert(course.canonicalUrl === "https://exam.autolearnpro.com" + course.url, "Unexpected canonical URL " + course.code);
  assert(course.source && course.source.file === "Syllabus - the general foundation o.txt", "Missing source " + course.code);
}
const aut250 = courses.find((course) => course.code === "AUT 250");
assert(aut250 && aut250.title === "Automotive Diagnostics I", "AUT 250 catalog collision");
const aut330 = courses.find((course) => course.code === "AUT 330");
assert(aut330 && aut330.title === "Electric Vehicle Technology", "AUT 330 catalog title mismatch");
assert(aut330 && aut330.delivery && aut330.delivery.trainingPackageId === "AUT-250", "EV training crosswalk missing");
assert(aut330 && aut330.delivery && aut330.delivery.trainingUrl === "/courses/aut-250/", "EV training URL crosswalk missing");
for (const route of [
  "exam-site/catalog/index.html",
  "exam-site/catalog/catalog.js",
  "exam-site/catalog/course/index.html",
  "exam-site/catalog/course/course.js"
]) assert(fs.existsSync(path.join(root, route)), "Missing route asset " + route);
console.log("[PASS] Course catalog verified: " + courses.length + " unique courses (" + undergraduate.length + " undergraduate, " + graduate.length + " graduate), no duplicate ids/codes/titles/URLs");

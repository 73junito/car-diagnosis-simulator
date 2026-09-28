const API_URL = "https://app.autolearnpro.com/api/curriculum";
const STATIC_URL = "/data/curriculum/course-catalog.json";
const EXPECTED_SCHEMA_VERSION = "1.0.0";
const EXPECTED_COURSE_COUNT = 68;
const API_TIMEOUT_MS = 5000;

function validateCourses(courses) {
  if (!Array.isArray(courses) || courses.length !== EXPECTED_COURSE_COUNT) {
    throw new Error("Expected " + EXPECTED_COURSE_COUNT + " catalog courses");
  }
  return courses;
}

async function loadFromApi() {
  const response = await fetch(API_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error("Curriculum API returned " + response.status);
  const payload = await response.json();
  if (payload.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    throw new Error("Unsupported curriculum schemaVersion: " + payload.schemaVersion);
  }
  return validateCourses(payload.catalogCourses);
}

async function loadFromStatic() {
  const response = await fetch(STATIC_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Static catalog returned " + response.status);
  const payload = await response.json();
  return validateCourses(payload.courses);
}

export async function loadCatalogCourses() {
  try {
    return { courses: await loadFromApi(), source: "api" };
  } catch (apiError) {
    console.warn("Catalog API unavailable; using static fallback", apiError);
    return { courses: await loadFromStatic(), source: "static" };
  }
}

export { API_URL, STATIC_URL, EXPECTED_COURSE_COUNT };

const API_URL = "https://app.autolearnpro.com/api/curriculum";
const STATIC_URL = "/data/curriculum/course-catalog.json";
const DELIVERY_STATUS_URL = "/data/curriculum/course-delivery-status.json";
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

async function loadDeliveryStatus() {
  const response = await fetch(DELIVERY_STATUS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Delivery status returned " + response.status);
  return response.json();
}

async function attachDeliveryStatus(courses) {
  try {
    const status = await loadDeliveryStatus();
    const built = new Set(status?.baseline?.catalogAlignedDedicatedCoursePageIds || []);
    const routeOverrides = status?.baseline?.catalogAlignedDedicatedCoursePageRoutes || {};
    return courses.map((course) => {
      if (!built.has(course.id) || course.delivery?.trainingUrl) return course;
      return {
        ...course,
        delivery: {
          kind: "course-page",
          trainingUrl: routeOverrides[course.id] || ("/courses/" + course.id + "/"),
          note: "A dedicated instructional course page is available. Academic catalog status and assessment authorization remain separate."
        }
      };
    });
  } catch (error) {
    console.warn("Delivery status unavailable; catalog will omit dedicated-page links", error);
    return courses;
  }
}

export async function loadCatalogCourses() {
  try {
    return { courses: await attachDeliveryStatus(await loadFromApi()), source: "api" };
  } catch (apiError) {
    console.warn("Catalog API unavailable; using static fallback", apiError);
    return { courses: await attachDeliveryStatus(await loadFromStatic()), source: "static" };
  }
}

export { API_URL, STATIC_URL, DELIVERY_STATUS_URL, EXPECTED_COURSE_COUNT };

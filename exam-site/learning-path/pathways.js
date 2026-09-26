const DATA_ROOT = "/data/curriculum";

// Server-side curriculum read API (same contract as the static JSON below).
// The exam worker serves assets only, so the API is fetched cross-origin
// from the app worker, which holds SUPABASE_SERVICE_ROLE_KEY.
const API_URL = "https://app.autolearnpro.com/api/curriculum";
// Abort budget for the API request before falling back to static JSON.
// Overridable only to let the browser suite exercise the timeout branch
// without a real 5s wait; it never changes the request target or validation.
const API_TIMEOUT_MS = Number(globalThis.TORQUEMIND_CURRICULUM_API_TIMEOUT_MS) || 5000;
const EXPECTED_SCHEMA_VERSION = "1.0.0";
const API_COLLECTIONS = [
  "pathways",
  "courses",
  "competencies",
  "lessonPlans",
  "scenarioMappings"
];

const files = {
  pathways: "academic-pathways.json",
  undergraduateCourses: "undergraduate-courses.json",
  graduateCourses: "graduate-courses.json",
  competencies: "competencies.json",
  lessonPlans: "lesson-plans.json"
};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

async function loadJson(file) {
  const response = await fetch(`${DATA_ROOT}/${file}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${file}: ${response.status}`);
  return response.json();
}

function validateApiPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Curriculum API payload is not an object");
  }
  if (payload.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`Unsupported curriculum schemaVersion: ${payload.schemaVersion}`);
  }
  for (const collection of API_COLLECTIONS) {
    if (!Array.isArray(payload[collection])) {
      throw new Error(`Curriculum API payload is missing collection: ${collection}`);
    }
  }
  const levels = new Set(
    payload.pathways.map((pathway) => pathway && pathway.academicLevel)
  );
  if (!levels.has("undergraduate") || !levels.has("graduate")) {
    throw new Error("Required academic pathways are missing from the curriculum API payload");
  }
  return payload;
}

async function loadFromApi() {
  const response = await fetch(API_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Curriculum API returned ${response.status}`);
  return validateApiPayload(await response.json());
}

function lessonForCourse(lessonPlans, courseId) {
  return lessonPlans.find((lesson) => lesson.courseId === courseId);
}

function competencyForCourse(competencies, courseId) {
  return competencies.find((competency) => competency.courseId === courseId);
}
function renderCourses(courses, competencies, lessonPlans, gridClass) {
  return courses.map((course, index) => {
    const competency = competencyForCourse(competencies, course.id);
    const lesson = lessonForCourse(lessonPlans, course.id);
    const steps = lesson?.sequence || [];
    return `
      <article id="${escapeHtml(course.id)}">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <h4>${escapeHtml(course.title)}</h4>
        <p>${escapeHtml(competency?.statement || "Curriculum competency pending.")}</p>
        <details>
          <summary>Lesson plan</summary>
          <p><strong>${escapeHtml(lesson?.title || "Planned lesson")}</strong></p>
          <ol class="compact-sequence">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        </details>
      </article>`;
  }).join("");
}

function statusLabel(status) {
  return status === "active" ? "ACTIVE DESIGN PATHWAY" : "PLANNED";
}
function renderPathway(targetId, pathway, courses, competencies, lessonPlans, gridClass) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const plannedClass = pathway.status === "active" ? "" : " planned";
  target.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">${escapeHtml(pathway.academicLevel.toUpperCase())} PATHWAY</p>
        <h2>${escapeHtml(pathway.programName)}</h2>
      </div>
      <p>CIP ${escapeHtml(pathway.cipCode)} · ${escapeHtml(pathway.cipTitle)}</p>
    </div>
    <div class="pathway-card">
      <div class="pathway-card-head">
        <span class="pathway-status${plannedClass}">${statusLabel(pathway.status)}</span>
        <span>CIP ${escapeHtml(pathway.cipCode)}</span>
      </div>
      <div class="${gridClass}">
        ${renderCourses(courses, competencies, lessonPlans, gridClass)}
      </div>
    </div>`;
}

function renderError(error) {
  for (const id of ["undergraduate-content", "graduate-content"]) {
    const target = document.getElementById(id);
    if (target) {
      target.innerHTML = `<div class="pathway-load-error" role="alert">
        Curriculum data could not be loaded. Please try again later.
      </div>`;
    }
  }
  console.error("Academic pathway load failed", error);
}
function modelFromApi(payload) {
  const coursesForLevel = (level) =>
    payload.courses.filter((course) => course && course.academicLevel === level);
  return {
    pathways: payload.pathways,
    undergraduateCourses: coursesForLevel("undergraduate"),
    graduateCourses: coursesForLevel("graduate"),
    competencies: payload.competencies,
    lessonPlans: payload.lessonPlans
  };
}

async function loadStaticModel() {
  const [pathwayData, undergradData, gradData, competencyData, lessonData] = await Promise.all([
    loadJson(files.pathways),
    loadJson(files.undergraduateCourses),
    loadJson(files.graduateCourses),
    loadJson(files.competencies),
    loadJson(files.lessonPlans)
  ]);
  return {
    pathways: pathwayData.pathways,
    undergraduateCourses: undergradData.courses,
    graduateCourses: gradData.courses,
    competencies: competencyData.competencies,
    lessonPlans: lessonData.lessonPlans
  };
}

async function init() {
  let model;
  let source = "api";
  try {
    model = modelFromApi(await loadFromApi());
  } catch (apiError) {
    console.warn("Curriculum API unavailable; falling back to static curriculum JSON", apiError);
    source = "static";
    try {
      model = await loadStaticModel();
    } catch (staticError) {
      renderError(staticError);
      return;
    }
  }

  const undergraduate = model.pathways.find((item) => item && item.academicLevel === "undergraduate");
  const graduate = model.pathways.find((item) => item && item.academicLevel === "graduate");

  if (!undergraduate || !graduate) {
    renderError(new Error("Required academic pathways are missing"));
    return;
  }

  document.documentElement.dataset.curriculumSource = source;

  renderPathway(
    "undergraduate-content",
    undergraduate,
    model.undergraduateCourses,
    model.competencies,
    model.lessonPlans,
    "course-grid"
  );

  renderPathway(
    "graduate-content",
    graduate,
    model.graduateCourses,
    model.competencies,
    model.lessonPlans,
    "graduate-grid"
  );
}

init();
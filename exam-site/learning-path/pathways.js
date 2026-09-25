const DATA_ROOT = "/data/curriculum";

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
async function init() {
  try {
    const [pathwayData, undergradData, gradData, competencyData, lessonData] = await Promise.all([
      loadJson(files.pathways),
      loadJson(files.undergraduateCourses),
      loadJson(files.graduateCourses),
      loadJson(files.competencies),
      loadJson(files.lessonPlans)
    ]);

    const undergraduate = pathwayData.pathways.find((item) => item.academicLevel === "undergraduate");
    const graduate = pathwayData.pathways.find((item) => item.academicLevel === "graduate");

    if (!undergraduate || !graduate) {
      throw new Error("Required academic pathways are missing");
    }

    renderPathway(
      "undergraduate-content",
      undergraduate,
      undergradData.courses,
      competencyData.competencies,
      lessonData.lessonPlans,
      "course-grid"
    );

    renderPathway(
      "graduate-content",
      graduate,
      gradData.courses,
      competencyData.competencies,
      lessonData.lessonPlans,
      "graduate-grid"
    );
  } catch (error) {
    renderError(error);
  }
}

init();
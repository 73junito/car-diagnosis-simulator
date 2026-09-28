const ROOT = "/data/curriculum";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const titleCase = (value) => String(value ?? "")
  .split(/[-_]/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

async function loadJson(name) {
  const response = await fetch(`${ROOT}/${name}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${name}: ${response.status}`);
  return response.json();
}

function list(items, className = "") {
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderObjectives(objectives) {
  return objectives.map((objective, index) => `
    <li>
      <span class="objective-number">${String(index + 1).padStart(2, "0")}</span>
      <div><strong>${escapeHtml(titleCase(objective.cognitiveLevel))}</strong><p>${escapeHtml(objective.statement)}</p></div>
    </li>`
  ).join("");
}

function renderEvidenceReferences(references = []) {
  if (!references.length) return "";
  return `
    <div class="lesson-evidence-refs">
      <strong>Evidence references</strong>
      <ul>${references.map((ref) => {
        const details = [
          ref.value,
          ref.comparisonRole ? titleCase(ref.comparisonRole) : "",
          ref.applicability,
          ref.locator,
          ref.approval
        ].filter(Boolean).join(" · ");
        return `<li><code>${escapeHtml(ref.id || ref.sourceId || ref.type)}</code>${details ? `<span>${escapeHtml(details)}</span>` : ""}</li>`;
      }).join("")}</ul>
    </div>`;
}

function renderIndependentCases(cases = []) {
  if (!cases.length) return "";
  return `
    <div class="independent-case-grid">
      ${cases.map((caseItem) => `
        <article class="independent-case">
          <span class="case-role">${escapeHtml(titleCase(caseItem.evidenceRole))}</span>
          <h5>${escapeHtml(caseItem.title)}</h5>
          <p><strong>Concern:</strong> ${escapeHtml(caseItem.concern)}</p>
          <div><strong>Operating context</strong>${list(caseItem.operatingContext || [], "case-context")}</div>
          <div class="case-observations">
            <strong>Raw observations</strong>
            <ul>
              ${(caseItem.observations || []).map((observation) => `
                <li>
                  <code>${escapeHtml(observation.testPoint)}</code>
                  <span>${escapeHtml(observation.measurementType)} · ${escapeHtml(observation.value)}</span>
                  <small>${escapeHtml(observation.meaning)}</small>
                </li>`).join("")}
            </ul>
          </div>
          <div><strong>Unknowns to resolve</strong>${list(caseItem.unknownsToResolve || [], "case-unknowns")}</div>
          <p class="learner-action"><strong>Student prompt:</strong> ${escapeHtml(caseItem.studentPrompt)}</p>
        </article>`).join("")}
    </div>`;
}

function renderBlocks(blocks) {
  return blocks.map((block, index) => `
    <li>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(block.title)}</strong>
        <p>${escapeHtml(block.description)}</p>
        <small>${escapeHtml(titleCase(block.instructionalPurpose))}</small>
        ${block.teachingPoints?.length ? `<ul class="lesson-teaching-points">${block.teachingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}
        ${block.learnerAction ? `<p class="learner-action"><strong>Learner task:</strong> ${escapeHtml(block.learnerAction)}</p>` : ""}
        ${renderIndependentCases(block.independentCases)}
        ${block.sourceBoundary ? `<p class="source-boundary"><strong>Boundary:</strong> ${escapeHtml(block.sourceBoundary)}</p>` : ""}
        ${renderEvidenceReferences(block.evidenceReferences)}
      </div>
    </li>`
  ).join("");
}

function renderVisuals(visuals) {
  return visuals.map((visual) => `
    <article>
      <span>${escapeHtml(titleCase(visual.type))}</span>
      <h4>${escapeHtml(visual.title)}</h4>
      <p>${escapeHtml(visual.purpose)}</p>
      ${visual.content?.length ? `<ul class="visual-content">${visual.content.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${visual.altText ? `<p class="visual-alt"><strong>Accessibility:</strong> ${escapeHtml(visual.altText)}</p>` : ""}
      ${visual.sourceScope ? `<p class="source-boundary"><strong>Source scope:</strong> ${escapeHtml(visual.sourceScope)}</p>` : ""}
    </article>`
  ).join("");
}

function renderCourseModules(modules = []) {
  if (!modules.length) return "";

  return `
    <section class="course-module-experience" aria-labelledby="aut250-module-title">
      <div class="course-module-intro">
        <div>
          <p class="eyebrow">Learner course sequence</p>
          <h4 id="aut250-module-title">AUT-250 follow-on modules</h4>
          <p>Work through the six modules in sequence. Completion markers are stored only in this browser and do not represent scored assessment or institutional credit.</p>
        </div>
        <div class="module-progress" aria-live="polite">
          <strong><span data-module-complete-count>0</span> / ${modules.length}</strong>
          <span>modules completed</span>
        </div>
      </div>

      <nav class="module-jump-nav" aria-label="AUT-250 module navigation">
        ${modules.map((module) => `
          <a href="#${escapeHtml(module.id)}">
            <span>${String(module.sequence).padStart(2, "0")}</span>
            ${escapeHtml(module.title)}
          </a>`).join("")}
      </nav>

      <div class="course-module-list">
        ${modules.map((module) => `
          <article class="course-module-card" id="${escapeHtml(module.id)}" data-course-module="${escapeHtml(module.id)}">
            <header class="course-module-head">
              <div>
                <p class="module-kicker">Module ${String(module.sequence).padStart(2, "0")} · ${escapeHtml(String(module.estimatedMinutes))} MIN</p>
                <h5>${escapeHtml(module.title)}</h5>
              </div>
              <button type="button" class="module-complete-toggle" data-module-complete-toggle="${escapeHtml(module.id)}" aria-pressed="false">
                Mark complete
              </button>
            </header>

            <details open>
              <summary>Module objectives</summary>
              ${list(module.moduleObjectives || [], "module-objective-list")}
            </details>

            <details>
              <summary>Lessons</summary>
              <div class="module-lesson-list">
                ${(module.lessons || []).map((lesson, lessonIndex) => `
                  <article class="module-lesson">
                    <span>Lesson ${module.sequence}.${lessonIndex + 1}</span>
                    <h6>${escapeHtml(lesson.title)}</h6>
                    <p>${escapeHtml(lesson.text)}</p>
                    <p class="learner-action"><strong>Learner task:</strong> ${escapeHtml(lesson.learnerAction)}</p>
                    <p class="source-boundary"><strong>Evidence boundary:</strong> ${escapeHtml(lesson.evidenceBoundary)}</p>
                  </article>`).join("")}
              </div>
            </details>

            <details>
              <summary>Practice and assessment activities</summary>
              <div class="expanded-plan-overview module-activity-grid">
                <div><strong>Practice</strong>${list(module.practice || [])}</div>
                <div><strong>Assessment activities</strong>${list(module.assessments || [])}</div>
              </div>
            </details>

            <details>
              <summary>Planned visuals</summary>
              <div class="module-visual-grid">
                ${(module.visuals || []).map((visual) => `
                  <article>
                    <span>${escapeHtml(titleCase(visual.type))}</span>
                    <h6>${escapeHtml(visual.title)}</h6>
                    <p>Original AutoLearnPro instructional visual planned for this module.</p>
                  </article>`).join("")}
              </div>
            </details>

            <div class="module-safety-boundary">
              <strong>Safety and evidence boundary</strong>
              <p>${escapeHtml(module.safetyAndEvidenceBoundary)}</p>
            </div>
          </article>`).join("")}
      </div>
    </section>`;
}

function initModuleProgress() {
  const modules = [...document.querySelectorAll("[data-course-module]")];
  if (!modules.length) return;

  const storageKey = "autolearnpro:aut250:completed-modules";
  let completed = [];
  try {
    completed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(completed)) completed = [];
  } catch {
    completed = [];
  }

  const update = () => {
    const completedSet = new Set(completed);
    for (const module of modules) {
      const id = module.dataset.courseModule;
      const button = module.querySelector("[data-module-complete-toggle]");
      const isComplete = completedSet.has(id);
      module.dataset.completed = isComplete ? "true" : "false";
      if (button) {
        button.setAttribute("aria-pressed", String(isComplete));
        button.textContent = isComplete ? "Completed" : "Mark complete";
      }
    }

    document.querySelectorAll("[data-module-complete-count]")
      .forEach((node) => { node.textContent = String(completedSet.size); });

    try {
      localStorage.setItem(storageKey, JSON.stringify([...completedSet]));
    } catch {
      // Local progress is optional; the course remains usable without storage.
    }
  };

  document.querySelectorAll("[data-module-complete-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.moduleCompleteToggle;
      const set = new Set(completed);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      completed = [...set];
      update();
    });
  });

  update();
  document.documentElement.dataset.aut250Modules = "loaded";
}

function renderProgramMapping(mapping) {
  if (mapping.relationship === "course") {
    return `Program mapping: ${escapeHtml(mapping.programCourseId)} · ${escapeHtml(mapping.programCourseTitle)} · ${escapeHtml(titleCase(mapping.mappingType))}`;
  }

  return `Program mapping: ${escapeHtml(titleCase(mapping.classification))} · ${escapeHtml(mapping.title)}`;
}

function renderPlan(plan, lesson, course) {
  return `
    <article class="expanded-plan" id="${escapeHtml(plan.lessonPlanId)}">
      <div class="expanded-plan-head">
        <div>
          <p class="eyebrow">${escapeHtml(plan.programMapping?.programCourseTitle || course.title)} · ${escapeHtml(String(plan.estimatedMinutes))} MIN</p>
          <h3>${escapeHtml(lesson.title)}</h3>
          <p>${escapeHtml(plan.lessonSummary)}</p>
          <p class="program-context">${renderProgramMapping(plan.programMapping)}</p>
          ${plan.contentStatus ? `<div class="lesson-readiness"><span>${escapeHtml(titleCase(plan.contentStatus))}</span><span>${escapeHtml(titleCase(plan.evidenceApprovalStatus || "evidence status not recorded"))}</span></div>` : ""}
        </div>
        <span class="pathway-status${plan.status === "active" ? "" : " planned"}">${escapeHtml(plan.status.toUpperCase())}</span>
      </div>

      <div class="expanded-plan-overview">
        <div><strong>Prerequisites</strong>${list(plan.prerequisites)}</div>
        <div><strong>Key concepts</strong>${list(plan.keyConcepts)}</div>
      </div>

      <details open>
        <summary>Learning objectives</summary>
        <ol class="objective-list">${renderObjectives(plan.learningObjectives)}</ol>
      </details>

      <details>
        <summary>Instructional sequence</summary>
        <ol class="instruction-block-list">${renderBlocks(plan.contentBlocks)}</ol>
      </details>

      <details>
        <summary>Planned visuals</summary>
        <div class="lesson-visual-grid">${renderVisuals(plan.visuals)}</div>
      </details>

      <details>
        <summary>Practice and assessment</summary>
        <div class="expanded-plan-overview">
          <div><strong>Practice tasks</strong>${list(plan.practiceTasks)}</div>
          <div><strong>Assessment plan</strong>${list(plan.assessmentPlan)}</div>
        </div>
      </details>

      ${renderCourseModules(plan.courseModules)}

      <details>
        <summary>Evidence focus and boundaries</summary>
        <div class="evidence-boundary">
          <strong>Evidence focus</strong>
          ${list(plan.evidenceFocus)}
          <p><strong>Evidence expectation:</strong> ${escapeHtml(plan.evidenceExpectation)}</p>
          <p><strong>Assessment boundary:</strong> ${escapeHtml(plan.assessmentBoundary)}</p>
          ${plan.evidenceReview ? `
            <div class="lesson-review-state">
              <p><strong>Lesson content status:</strong> ${escapeHtml(titleCase(plan.contentStatus))}</p>
              <p><strong>Evidence approval:</strong> ${escapeHtml(titleCase(plan.evidenceApprovalStatus))}</p>
              <p><strong>Review note:</strong> ${escapeHtml(plan.evidenceReview.reviewNote)}</p>
              <p><strong>Pending technical-review chunks:</strong></p>
              ${list(plan.evidenceReview.pendingTechnicalReviewChunkIds || [], "pending-chunk-list")}
            </div>` : ""}
        </div>
      </details>
    </article>`;
}

function renderGroup(targetId, level, plans, lessons, courses) {
  const target = document.getElementById(targetId);
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const html = plans
    .filter((plan) => lessonsById.get(plan.lessonPlanId)?.academicLevel === level)
    .map((plan) => {
      const lesson = lessonsById.get(plan.lessonPlanId);
      const course = coursesById.get(lesson.courseId);
      return renderPlan(plan, lesson, course);
    })
    .join("");
  target.innerHTML = html;
}
async function init() {
  try {
    const [contentDoc, lessonDoc, undergraduateDoc, graduateDoc] = await Promise.all([
      loadJson("lesson-content.json"),
      loadJson("lesson-plans.json"),
      loadJson("undergraduate-courses.json"),
      loadJson("graduate-courses.json")
    ]);

    const courses = [...undergraduateDoc.courses, ...graduateDoc.courses];
    renderGroup(
      "undergraduate-plan-list",
      "undergraduate",
      contentDoc.lessonContentPlans,
      lessonDoc.lessonPlans,
      courses
    );
    renderGroup(
      "graduate-plan-list",
      "graduate",
      contentDoc.lessonContentPlans,
      lessonDoc.lessonPlans,
      courses
    );

    initModuleProgress();
    document.documentElement.dataset.lessonPlans = "loaded";
  } catch (error) {
    console.error(error);
    document.documentElement.dataset.lessonPlans = "error";
    for (const id of ["undergraduate-plan-list", "graduate-plan-list"]) {
      const target = document.getElementById(id);
      if (target) {
        target.innerHTML = '<div class="pathway-load-error">Expanded lesson plans are temporarily unavailable.</div>';
      }
    }
  }
}

init();

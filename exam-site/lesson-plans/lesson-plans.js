const ROOT = "/data/curriculum";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const titleCase = (value) => String(value ?? "")
  .split("-")
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

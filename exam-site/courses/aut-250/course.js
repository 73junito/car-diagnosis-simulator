const CURRICULUM_URL = "/data/curriculum/lesson-content.json";
const APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json";
const BATCH002_APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-002-final-approval-20260928.json";
const BATCH002_CURRICULUM_URL = "/data/curriculum/aut250-training-batch-002.json";
const STORAGE_KEY = "autolearnpro:aut250:module-progress";
const PROGRESS_VERSION = 2;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

function evaluateApproval(approval, expectedBatch) {
  const effect = approval?.approval_effect_if_confirmed;
  const release = approval?.release_state;
  const decision = approval?.requested_final_decision;
  return [
    approval?.course_id === "AUT-250",
    approval?.lesson_plan_id === "ug-hev-foundations",
    approval?.question_batch === expectedBatch,
    approval?.question_count === 20,
    decision?.decision === "approved",
    decision?.scope === "training-bank-final-approval-only",
    release?.training_bank_final_approval === "approved-for-training-use",
    effect?.training_delivery_allowed === true,
    effect?.scored === false,
    effect?.high_stakes_eligible === false,
    effect?.institutional_assessment_eligible === false,
    effect?.production_assessment_api_eligible === false,
    release?.production_release === false,
    release?.assessment_release === false,
    release?.high_stakes_release === false
  ].every(Boolean);
}

function mergeBatch002IntoPlan(plan, supplement) {
  const supplementalQuestions = (supplement?.modules || []).flatMap((module) => module.questions || []);
  const boundaryOk = supplement?.questionBatch === "aut250-training-batch-002-ollama-repaired" &&
    supplement?.questionCount === 20 &&
    supplementalQuestions.length === 20 &&
    supplementalQuestions.every((question) =>
      question.status === "approved-for-training-use" &&
      question.deliveryMode === "training" &&
      question.scored === false &&
      question.highStakesEligible === false &&
      question.institutionalAssessmentEligible === false &&
      question.productionAssessmentApiEligible === false
    );
  if (!plan || !boundaryOk) throw new Error("AUT-250 Batch 002 supplemental bank failed validation");
  for (const supplementalModule of supplement.modules) {
    const module = plan.courseModules?.find((item) => item.id === supplementalModule.moduleId);
    if (!module) throw new Error(`Unknown AUT-250 Batch 002 module: ${supplementalModule.moduleId}`);
    const existing = new Set((module.trainingQuestions || []).map((question) => question.id));
    module.trainingQuestions = [
      ...(module.trainingQuestions || []),
      ...supplementalModule.questions.filter((question) => !existing.has(question.id))
    ];
  }
  return plan;
}

function emptyProgress() {
  return { version: PROGRESS_VERSION, lastModuleId: null, modules: {} };
}

function normalizeModuleProgress(value = {}) {
  return {
    currentQuestionIndex: Number.isInteger(value.currentQuestionIndex) && value.currentQuestionIndex >= 0
      ? value.currentQuestionIndex : 0,
    attemptedQuestionIds: Array.isArray(value.attemptedQuestionIds) ? [...new Set(value.attemptedQuestionIds)] : [],
    feedbackViewedQuestionIds: Array.isArray(value.feedbackViewedQuestionIds) ? [...new Set(value.feedbackViewedQuestionIds)] : [],
    completed: value.completed === true,
    lastVisitedAt: typeof value.lastVisitedAt === "string" ? value.lastVisitedAt : null
  };
}

function migrateLegacyProgress(parsed) {
  const next = emptyProgress();
  if (!parsed || typeof parsed !== "object") return next;
  Object.entries(parsed).forEach(([moduleId, value]) => {
    if (typeof value === "boolean") {
      next.modules[moduleId] = {
        ...normalizeModuleProgress(),
        legacyMarkedComplete: value,
        completed: false
      };
    }
  });
  return next;
}

function getProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed?.version !== PROGRESS_VERSION || !parsed.modules) return migrateLegacyProgress(parsed);
    return {
      version: PROGRESS_VERSION,
      lastModuleId: typeof parsed.lastModuleId === "string" ? parsed.lastModuleId : null,
      modules: Object.fromEntries(
        Object.entries(parsed.modules).map(([id, value]) => [id, normalizeModuleProgress(value)])
      )
    };
  } catch {
    return emptyProgress();
  }
}

function setProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function moduleProgress(progress, moduleId) {
  return normalizeModuleProgress(progress.modules?.[moduleId]);
}

function moduleStatus(module, progress) {
  const state = moduleProgress(progress, module.id);
  const attempted = state.attemptedQuestionIds.filter((id) =>
    (module.trainingQuestions || []).some((question) => question.id === id)
  ).length;
  const total = (module.trainingQuestions || []).length;
  if (state.completed && total > 0 && attempted === total) return "Completed";
  if (attempted > 0 || state.lastVisitedAt) return "In progress";
  return "Not started";
}

function summarize(modules, progress) {
  const completedModules = modules.filter((module) => moduleStatus(module, progress) === "Completed").length;
  const totalQuestions = modules.reduce((sum, module) => sum + (module.trainingQuestions || []).length, 0);
  const attemptedQuestionIds = new Set();
  modules.forEach((module) => {
    moduleProgress(progress, module.id).attemptedQuestionIds.forEach((id) => attemptedQuestionIds.add(id));
  });
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons || []).length, 0);
  const minutes = modules.reduce((sum, module) => sum + Number(module.estimatedMinutes || 0), 0);
  const activityPercent = totalQuestions ? Math.round((attemptedQuestionIds.size / totalQuestions) * 100) : 0;
  return {
    completedModules,
    totalModules: modules.length,
    attemptedQuestions: attemptedQuestionIds.size,
    totalQuestions,
    totalLessons,
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
    activityPercent
  };
}

function renderProgress(modules, progress) {
  const summary = summarize(modules, progress);
  document.querySelector("[data-course-progress]").textContent =
    `${summary.completedModules} / ${summary.totalModules}`;
  document.querySelector("[data-course-progress-bar]").style.width = `${summary.activityPercent}%`;
  document.querySelector("[data-progress-attempted]").textContent =
    `${summary.attemptedQuestions} / ${summary.totalQuestions}`;
  document.querySelector("[data-progress-activity]").textContent = `${summary.activityPercent}%`;
  document.querySelector("[data-progress-hours]").textContent = `${summary.hours} hours`;
  document.querySelector("[data-progress-lessons]").textContent = `${summary.totalLessons} lessons`;

  const next = modules.find((module) => moduleStatus(module, progress) !== "Completed") || modules[modules.length - 1];
  const preferred = modules.find((module) => module.id === progress.lastModuleId) || next;
  const preferredState = moduleProgress(progress, preferred?.id);
  const continueLink = document.querySelector("[data-course-continue]");

  if (preferred) {
    const index = Math.min(
      preferredState.currentQuestionIndex || 0,
      Math.max((preferred.trainingQuestions || []).length - 1, 0)
    );
    continueLink.href =
      `/courses/aut-250/module/?module=${encodeURIComponent(preferred.id)}&question=${index + 1}`;
    continueLink.textContent = summary.attemptedQuestions
      ? `Continue Module ${String(preferred.sequence).padStart(2, "0")}`
      : "Start course";
  }

  document.querySelector("[data-course-last-activity]").textContent =
    progress.lastModuleId
      ? `Last activity: Module ${String(preferred?.sequence || "").padStart(2, "0")}`
      : "Last activity: Not started";
}

function renderModules(modules, progress) {
  const grid = document.querySelector("[data-module-grid]");
  grid.innerHTML = modules.map((module, index) => {
    const questionCount = (module.trainingQuestions || []).length;
    const state = moduleProgress(progress, module.id);
    const status = moduleStatus(module, progress);
    const attempted = state.attemptedQuestionIds.filter((id) =>
      (module.trainingQuestions || []).some((question) => question.id === id)
    ).length;
    const href = `/courses/aut-250/module/?module=${encodeURIComponent(module.id)}&question=${Math.min(state.currentQuestionIndex + 1, Math.max(questionCount, 1))}`;
    const action = status === "Completed" ? "Review module" : status === "In progress" ? "Continue module" : "Open module";

    return `
      <article class="aut250-dashboard-card ${status === "Completed" ? "is-complete" : ""}" id="${escapeHtml(module.id)}" data-dashboard-module="${escapeHtml(module.id)}" data-module-status="${status.toLowerCase().replace(/ /g, "-")}">
        <div class="aut250-dashboard-card-head">
          <span>Module ${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(module.estimatedMinutes)} min</span>
        </div>
        <div class="aut250-dashboard-card-title-row">
          <h3>${escapeHtml(module.title)}</h3>
          <span class="aut250-module-status" data-status="${status.toLowerCase().replace(/ /g, "-")}">${status}</span>
        </div>
        <p>${escapeHtml((module.moduleObjectives || [])[0] || "")}</p>
        <div class="aut250-dashboard-meta">
          <span>${(module.lessons || []).length} lessons</span>
          <span>${questionCount} training questions</span>
          <span>${attempted} attempted</span>
        </div>
        <div class="aut250-dashboard-actions">
          <a class="button primary" href="${href}">${action}</a>
        </div>
      </article>`;
  }).join("");
}

async function init() {
  const releaseStatus = document.querySelector("[data-course-release-status]");
  try {
    const [approval, batch002Approval, curriculum, batch002Supplement] = await Promise.all([
      loadJson(APPROVAL_URL),
      loadJson(BATCH002_APPROVAL_URL),
      loadJson(CURRICULUM_URL),
      loadJson(BATCH002_CURRICULUM_URL)
    ]);

    if (!evaluateApproval(approval, "aut250-training-batch-001") ||
        !evaluateApproval(batch002Approval, "aut250-training-batch-002-ollama-repaired")) {
      throw new Error("Final AUT-250 training approval gate not satisfied");
    }

    const plan = curriculum.lessonContentPlans?.find((item) => item.lessonPlanId === "ug-hev-foundations");
    mergeBatch002IntoPlan(plan, batch002Supplement);
    const modules = plan?.courseModules || [];
    if (modules.length !== 6) throw new Error(`Expected 6 AUT-250 modules, found ${modules.length}`);
    const counts = modules.map((module) => (module.trainingQuestions || []).length);
    if (JSON.stringify(counts) !== JSON.stringify([8, 8, 6, 6, 6, 6])) {
      throw new Error(`Expected approved AUT-250 distribution 8/8/6/6/6/6, found ${counts.join("/")}`);
    }
    if (modules.flatMap((module) => module.trainingQuestions || []).length !== 40) {
      throw new Error("Expected exactly 40 approved AUT-250 training questions");
    }

    document.documentElement.dataset.aut250CourseRelease = "approved-for-training-use";
    releaseStatus.textContent = "Approved for formative training use · non-scored";
    document.querySelector("[data-course-summary]").textContent =
      "24 training hours · 6 modules · 18 lessons · 20 formative questions; progress stored only in this browser.";

    const progress = getProgress();
    setProgress(progress);
    renderModules(modules, progress);
    renderProgress(modules, progress);
  } catch (error) {
    console.error("AUT-250 course dashboard failed closed:", error);
    document.documentElement.dataset.aut250CourseRelease = "blocked";
    releaseStatus.textContent = "Training unavailable — approval gate not satisfied";
    document.querySelector("[data-course-summary]").textContent =
      "No training content is exposed while the approval gate is blocked.";
    document.querySelector("[data-module-grid]").innerHTML = "";
    document.querySelector("#course-gate-blocked").hidden = false;
    const continueLink = document.querySelector("[data-course-continue]");
    continueLink.setAttribute("aria-disabled", "true");
    continueLink.removeAttribute("href");
  }
}

init();

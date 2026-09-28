const CURRICULUM_URL = "/data/curriculum/lesson-content.json";
const APPROVAL_URL = "/data/evidence/approval-records/aut250-training-batch-001-final-approval-20260927.json";
const STORAGE_KEY = "autolearnpro:aut250:module-progress";

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

function evaluateApproval(approval) {
  const effect = approval?.approval_effect_if_confirmed;
  const release = approval?.release_state;
  const decision = approval?.requested_final_decision;
  const checks = [
    approval?.course_id === "AUT-250",
    approval?.lesson_plan_id === "ug-hev-foundations",
    approval?.question_batch === "aut250-training-batch-001",
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
  ];
  return checks.every(Boolean);
}

function getProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function renderProgress(modules, progress) {
  const completed = modules.filter((module) => progress[module.id]).length;
  document.querySelector("[data-course-progress]").textContent = `${completed} / ${modules.length}`;
  document.querySelector("[data-course-progress-bar]").style.width = `${modules.length ? (completed / modules.length) * 100 : 0}%`;

  const next = modules.find((module) => !progress[module.id]) || modules[modules.length - 1];
  const continueLink = document.querySelector("[data-course-continue]");
  continueLink.href = next ? `#${next.id}` : "#modules";
  continueLink.textContent = completed === modules.length ? "Review modules" : completed ? "Continue learning" : "Start course";
}

function renderModules(modules, progress) {
  const grid = document.querySelector("[data-module-grid]");
  grid.innerHTML = modules.map((module, index) => {
    const questionCount = (module.trainingQuestions || []).length;
    const complete = Boolean(progress[module.id]);
    return `
      <article class="aut250-dashboard-card ${complete ? "is-complete" : ""}" id="${escapeHtml(module.id)}" data-dashboard-module="${escapeHtml(module.id)}">
        <div class="aut250-dashboard-card-head">
          <span>Module ${String(index + 1).padStart(2, "0")}</span>
          <span>${escapeHtml(module.estimatedMinutes)} min</span>
        </div>
        <h3>${escapeHtml(module.title)}</h3>
        <p>${escapeHtml((module.moduleObjectives || [])[0] || "")}</p>
        <div class="aut250-dashboard-meta">
          <span>${(module.lessons || []).length} lessons</span>
          <span>${questionCount} training questions</span>
        </div>
        <div class="aut250-dashboard-actions">
          <a class="button primary" href="/lesson-plans/#ug-hev-foundations">Open module</a>
          <button type="button" class="button secondary-button" data-toggle-module="${escapeHtml(module.id)}">${complete ? "Mark incomplete" : "Mark complete"}</button>
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll("[data-toggle-module]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggleModule;
      const nextProgress = getProgress();
      nextProgress[id] = !nextProgress[id];
      setProgress(nextProgress);
      renderModules(modules, nextProgress);
      renderProgress(modules, nextProgress);
    });
  });
}

async function init() {
  const releaseStatus = document.querySelector("[data-course-release-status]");
  try {
    const [approval, curriculum] = await Promise.all([
      loadJson(APPROVAL_URL),
      loadJson(CURRICULUM_URL)
    ]);

    if (!evaluateApproval(approval)) throw new Error("Final AUT-250 training approval gate not satisfied");

    const plan = curriculum.lessonContentPlans?.find((item) => item.lessonPlanId === "ug-hev-foundations");
    const modules = plan?.courseModules || [];
    if (modules.length !== 6) throw new Error(`Expected 6 AUT-250 modules, found ${modules.length}`);
    if (modules.flatMap((module) => module.trainingQuestions || []).length !== 20) {
      throw new Error("Expected exactly 20 approved AUT-250 training questions");
    }

    document.documentElement.dataset.aut250CourseRelease = "approved-for-training-use";
    releaseStatus.textContent = "Approved for formative training use · non-scored";
    document.querySelector("[data-course-summary]").textContent =
      "1,440 minutes across six follow-on modules, with progress stored only in this browser.";

    const progress = getProgress();
    renderModules(modules, progress);
    renderProgress(modules, progress);
  } catch (error) {
    console.error("AUT-250 course dashboard failed closed:", error);
    document.documentElement.dataset.aut250CourseRelease = "blocked";
    releaseStatus.textContent = "Training unavailable — approval gate not satisfied";
    document.querySelector("[data-course-summary]").textContent = "No training content is exposed while the approval gate is blocked.";
    document.querySelector("[data-module-grid]").innerHTML = "";
    document.querySelector("#course-gate-blocked").hidden = false;
    document.querySelector("[data-course-continue]").setAttribute("aria-disabled", "true");
    document.querySelector("[data-course-continue]").removeAttribute("href");
  }
}

init();

const DATA_URL = "/data/curriculum/program-architecture.json";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

async function loadArchitecture() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load program architecture: ${response.status}`);
  return response.json();
}

function statusLabel(status) {
  if (status === "verified-kansas-common-course") return "VERIFIED KANSAS COMMON COURSE";
  if (status === "proposed-with-verified-kansas-core") return "PROPOSED · VERIFIED KANSAS CORE";
  return String(status || "proposed").toUpperCase().replaceAll("-", " ");
}

function renderCourse(course) {
  const prereq = (course.prerequisites || []).length
    ? `<p class="program-prereq"><strong>Prerequisites:</strong> ${course.prerequisites.map(escapeHtml).join(", ")}</p>`
    : "";
  const mapping = course.existingLessonPlanId
    ? `<p class="program-mapping">Existing lesson: <code>${escapeHtml(course.existingLessonPlanId)}</code>${course.mappingType ? ` · ${escapeHtml(course.mappingType)}` : ""}</p>`
    : "";
  return `
    <tr>
      <td><strong>${escapeHtml(course.id)}</strong></td>
      <td>
        ${escapeHtml(course.title)}
        ${prereq}
        ${mapping}
      </td>
      <td>${escapeHtml(course.credits)}</td>
      <td><span class="program-status program-status-${escapeHtml(course.status)}">${escapeHtml(statusLabel(course.status))}</span></td>
    </tr>`;
}
function renderBuckets(program) {
  return `
    <div class="program-buckets">
      ${program.creditBuckets.map((bucket) => `
        <div class="program-bucket">
          <span>${escapeHtml(bucket.credits)} CR</span>
          <strong>${escapeHtml(bucket.title)}</strong>
        </div>`
      ).join("")}
    </div>`;
}

function renderSupplemental(program) {
  const items = program.supplementalGraduateContent || [];
  if (!items.length) return "";
  return `
    <section class="program-supplemental">
      <p class="eyebrow">SUPPLEMENTAL GRADUATE CONTENT</p>
      <h4>Preserved outside the engineering-technology core</h4>
      ${items.map((item) => `
        <article>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.reason)}</p>
          <small>${escapeHtml(item.existingLessonPlanId)}</small>
        </article>`
      ).join("")}
    </section>`;
}

function renderProgram(program) {
  return `
    <article class="program-card" id="${escapeHtml(program.id)}">
      <div class="program-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(program.academicLevel.toUpperCase())} · ${escapeHtml(program.credential)}</p>
          <h2>${escapeHtml(program.programName)}</h2>
          <p>CIP ${escapeHtml(program.cipCode)} · ${escapeHtml(program.cipTitle)}</p>
        </div>
        <div class="program-credit-total"><strong>${escapeHtml(program.totalCredits)}</strong><span>CREDITS</span></div>
      </div>
      <p class="program-program-status"><span class="program-status">${escapeHtml(statusLabel(program.status))}</span></p>
      ${renderBuckets(program)}
      <div class="program-table-wrap">
        <table class="program-course-table">
          <thead><tr><th>Course</th><th>Title / mapping</th><th>Credits</th><th>Status</th></tr></thead>
          <tbody>${program.courses.map(renderCourse).join("")}</tbody>
        </table>
      </div>
      ${renderSupplemental(program)}
    </article>`;
}
function renderAuthority(references) {
  return `
    <section class="program-authority">
      <p class="eyebrow">AUTHORITY / PROVENANCE</p>
      <h2>Verified facts stay separate from proposed curriculum.</h2>
      <div class="program-authority-grid">
        ${references.map((ref) => `
          <article>
            <strong>${escapeHtml(ref.authority)}</strong>
            <ul>${ref.verifiedFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
          </article>`
        ).join("")}
      </div>
    </section>`;
}

async function init() {
  const root = document.getElementById("program-architecture-root");
  try {
    const architecture = await loadArchitecture();
    root.innerHTML =
      architecture.programs.map(renderProgram).join("") +
      renderAuthority(architecture.authorityReferences);
    document.documentElement.dataset.programArchitecture = "loaded";
  } catch (error) {
    console.error(error);
    document.documentElement.dataset.programArchitecture = "error";
    root.innerHTML = '<div class="pathway-load-error">Program architecture is temporarily unavailable.</div>';
  }
}

init();

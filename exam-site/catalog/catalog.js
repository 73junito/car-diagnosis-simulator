const DATA_URL = "/data/curriculum/course-catalog.json";
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const groupsRoot = document.querySelector("[data-catalog-groups]");
const countNode = document.querySelector("[data-catalog-count]");
const searchInput = document.querySelector("[data-catalog-search]");
const levelSelect = document.querySelector("[data-catalog-level]");
let courses = [];

function normalized(value) {
  return String(value ?? "").toLowerCase();
}

function card(course) {
  return '<article class="catalog-course-card">' +
    '<div class="catalog-course-head"><span class="catalog-course-code">' + escapeHtml(course.code) +
    '</span><span class="catalog-course-credits">' + escapeHtml(course.credits) + ' cr.</span></div>' +
    '<h3><a href="' + escapeHtml(course.url) + '">' + escapeHtml(course.title) + '</a></h3>' +
    '<p>' + escapeHtml(course.description) + '</p>' +
    '<div class="catalog-course-meta"><span>' +
    escapeHtml(course.classification) +
    '</span><span>' + escapeHtml(course.category) + '</span></div>' +
    '<a class="text-link" href="' + escapeHtml(course.url) +
    '">View course details <span aria-hidden="true">→</span></a></article>';
}
function render() {
  const term = normalized(searchInput && searchInput.value).trim();
  const level = (levelSelect && levelSelect.value) || "all";
  const filtered = courses.filter((course) => {
    if (level !== "all" && course.academicLevel !== level) return false;
    if (!term) return true;
    return [course.code, course.title, course.description, course.prerequisites, course.category]
      .some((value) => normalized(value).includes(term));
  });

  countNode.textContent = filtered.length + " course" + (filtered.length === 1 ? "" : "s") + " shown";
  const categories = [...new Set(filtered.map((course) => course.category))];
  groupsRoot.innerHTML = categories.length ? categories.map((category) => {
    const subset = filtered.filter((course) => course.category === category);
    const anchor = "catalog-" + category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return '<section class="catalog-group" aria-labelledby="' + escapeHtml(anchor) + '">' +
      '<div class="catalog-group-heading"><h2 id="' + escapeHtml(anchor) + '">' +
      escapeHtml(category) + '</h2><span>' + subset.length + " course" +
      (subset.length === 1 ? "" : "s") + '</span></div>' +
      '<div class="catalog-grid">' + subset.map(card).join("") + '</div></section>';
  }).join("") : '<div class="pathway-load-error" role="status">No courses match the current filters.</div>';
}
async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Catalog returned " + response.status);
    const payload = await response.json();
    courses = Array.isArray(payload.courses) ? payload.courses : [];
    if (courses.length !== 68) throw new Error("Expected 68 courses, received " + courses.length);
    document.documentElement.dataset.catalogStatus = "loaded";
    render();
  } catch (error) {
    document.documentElement.dataset.catalogStatus = "error";
    groupsRoot.innerHTML = '<div class="pathway-load-error" role="alert">Course catalog could not be loaded. Please try again later.</div>';
    countNode.textContent = "Catalog unavailable";
    console.error("Course catalog load failed", error);
  }
}

if (searchInput) searchInput.addEventListener("input", render);
if (levelSelect) levelSelect.addEventListener("change", render);
init();

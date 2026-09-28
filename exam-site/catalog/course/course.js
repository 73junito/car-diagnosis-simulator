const DATA_URL = "/data/curriculum/course-catalog.json";
const root = document.querySelector("[data-course-detail]");
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function normalizedCode(value) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
}

async function init() {
  const requested = normalizedCode(new URLSearchParams(location.search).get("course"));
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Catalog returned " + response.status);
    const payload = await response.json();
    const course = payload.courses.find((item) => normalizedCode(item.code) === requested);
    if (!course) {
      document.title = "Course not found | AutoLearnPro";
      root.innerHTML = '<section class="catalog-detail-card"><p class="eyebrow">COURSE NOT FOUND</p><h1>No catalog course matches this URL.</h1><p>Return to the catalog and choose a listed course.</p><a class="button primary" href="/catalog/">Open course catalog</a></section>';
      return;
    }
    document.title = course.code + " — " + course.title + " | AutoLearnPro";
    const canonical = document.querySelector("[data-course-canonical]");
    if (canonical) canonical.href = course.canonicalUrl;
    const training = course.delivery && course.delivery.trainingUrl
      ? '<aside class="catalog-training-link"><strong>Related formative training available</strong>' +
        '<p>' + escapeHtml(course.delivery.note || "") + '</p>' +
        '<a class="button secondary-button" href="' + escapeHtml(course.delivery.trainingUrl) + '">Open training package</a></aside>'
      : "";

    root.innerHTML = '<article class="catalog-detail-card">' +
      '<p class="eyebrow">' + escapeHtml(course.academicLevel.toUpperCase()) + ' / ' + escapeHtml(course.category.toUpperCase()) + '</p>' +
      '<div class="catalog-detail-title"><div><span class="catalog-course-code">' + escapeHtml(course.code) +
      '</span><h1>' + escapeHtml(course.title) + '</h1></div><span class="catalog-detail-credits">' +
      escapeHtml(course.credits) + ' credits</span></div>' +
      '<p class="catalog-detail-description">' + escapeHtml(course.description) + '</p>' +
      '<dl class="catalog-detail-meta"><div><dt>Degree program</dt><dd>' + escapeHtml(course.degreeProgram) +
      '</dd></div><div><dt>Prerequisites</dt><dd>' + escapeHtml(course.prerequisites) +
      '</dd></div><div><dt>Academic level</dt><dd>' + escapeHtml(course.academicLevel) +
      '</dd></div><div><dt>CIP pathway</dt><dd>' + escapeHtml(course.cipCode) +
      '</dd></div><div><dt>Catalog status</dt><dd>' + escapeHtml(course.status) +
      '</dd></div><div><dt>Source</dt><dd>' + escapeHtml(course.source && course.source.file) +
      '</dd></div></dl>' + training + '</article>';
    document.documentElement.dataset.courseCatalogRecord = course.id;
  } catch (error) {
    root.innerHTML = '<div class="pathway-load-error" role="alert">Course details could not be loaded. Please try again later.</div>';
    console.error("Course detail load failed", error);
  }
}

init();

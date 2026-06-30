export function scenarioCard(scenario = {}) {
  const title = scenario.title || scenario.id || scenario.slug || 'Scenario';
  const description = scenario.description || scenario.symptoms || 'Diagnostic training scenario';
  const difficulty = scenario.difficulty || 'practice';
  const ase = scenario.aseArea || scenario.ase || scenario.category || 'general';
  const status = scenario.status || 'Not Started';
  const slug = scenario.slug || scenario.id || title.toLowerCase().replace(/\s+/g, '-');

  return `
    <article class="tm-scenario-v2-card" data-scenario-card="${slug}">
      <div class="tm-scenario-v2-media" aria-hidden="true">${ase}</div>
      <div class="tm-scenario-v2-body">
        <h3 class="tm-scenario-v2-title">${title}</h3>
        <p class="tm-scenario-v2-description">${description}</p>
        <div class="tm-scenario-v2-meta">
          <span class="tm-pill">${difficulty}</span>
          <span class="tm-pill">${ase}</span>
        </div>
      </div>
      <footer class="tm-scenario-v2-footer">
        <span class="tm-scenario-v2-status">${status}</span>
        <a class="tm-btn tm-btn-primary" href="/dashboard/student/scenario/?id=${encodeURIComponent(slug)}">Start</a>
      </footer>
    </article>
  `;
}

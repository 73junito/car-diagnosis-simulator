export function filterToolbar({
  searchId = "searchInput",
  categoryId = "filterCategory",
  difficultyId = "filterDifficulty",
  diagnosticAreaId = "filterDiagnosticArea"
} = {}) {
  return `
    <section class="tm-filter-toolbar" aria-label="Scenario filters">
      <div class="tm-filter-toolbar__field">
        <label for="${searchId}">Search</label>
        <input id="${searchId}" type="search" placeholder="Search by scenario name or symptom">
      </div>
      <div class="tm-filter-toolbar__field">
        <label for="${categoryId}">Category</label>
        <select id="${categoryId}">
          <option value="">All</option>
        </select>
      </div>
      <div class="tm-filter-toolbar__field">
        <label for="${difficultyId}">Difficulty</label>
        <select id="${difficultyId}">
          <option value="">All</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div class="tm-filter-toolbar__field">
        <label for="${diagnosticAreaId}">Diagnostic Area</label>
        <select id="${diagnosticAreaId}">
          <option value="">All</option>
        </select>
      </div>
      <div class="tm-filter-toolbar__actions">
        <button id="resetFiltersBtn" class="tm-btn tm-btn-secondary" type="button">Reset</button>
      </div>
    </section>
  `;
}

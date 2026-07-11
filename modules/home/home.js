(function () {
  const content = window.TorqueMindHome;
  if (!content) return;

  function createLink(action, className) {
    const link = document.createElement("a");
    link.className = className;
    link.href = action.href;
    link.textContent = action.label;
    return link;
  }

  function renderHero() {
    const root = document.getElementById("homeHero");
    if (!root) return;

    const text = document.createElement("div");
    text.className = "tm-home-hero__content";

    const eyebrow = document.createElement("p");
    eyebrow.className = "tm-eyebrow";
    eyebrow.textContent = content.hero.eyebrow;

    const title = document.createElement("h1");
    title.id = "homeTitle";
    title.textContent = content.hero.title;

    const description = document.createElement("p");
    description.className = "tm-home-hero__description";
    description.textContent = content.hero.description;

    const actions = document.createElement("div");
    actions.className = "tm-home-actions";
    actions.append(
      createLink(content.hero.primaryAction, "tm-btn tm-btn-primary"),
      createLink(content.hero.secondaryAction, "tm-btn tm-btn-secondary")
    );

    text.append(eyebrow, title, description, actions);
    root.append(text);
  }

  function renderTrainingModes() {
    const root = document.getElementById("trainingModeGrid");
    if (!root) return;

    content.trainingModes.forEach((mode) => {
      const card = document.createElement("article");
      card.className = "tm-training-mode-card";

      const title = document.createElement("h2");
      title.textContent = mode.title;

      const description = document.createElement("p");
      description.textContent = mode.description;

      const action = document.createElement("a");
      action.className = "tm-btn tm-btn-secondary";
      action.href = mode.href;
      action.textContent = mode.action;

      card.append(title, description, action);
      root.append(card);
    });
  }

  function renderInstructorSection() {
    const root = document.getElementById("homeInstructor");
    if (!root) return;

    const title = document.createElement("h2");
    title.id = "instructorSectionTitle";
    title.textContent = content.instructor.title;

    const description = document.createElement("p");
    description.textContent = content.instructor.description;

    const actions = document.createElement("div");
    actions.className = "tm-home-actions";

    content.instructor.actions.forEach((action) => {
      actions.append(createLink(action, "tm-btn tm-btn-secondary"));
    });

    root.append(title, description, actions);
  }

  renderHero();
  renderTrainingModes();
  renderInstructorSection();
})();

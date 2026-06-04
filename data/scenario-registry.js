// Normalized scenario registry derived from existing `window.scenarios`.
// Purpose: provide a single source of truth with normalized slugs, titles, images and routes.
(function(){
  function slugify(s){
    if(!s) return '';
    return String(s).toLowerCase().replace(/[_\s]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  }

  function chooseRoute(s){
    // Phase 4 routing rules:
    // - ASE procedural scenarios (contain `steps`) -> /dashboard/obd2-ase?scenario=
    // - Live diagnostic / high-voltage / hybrid -> /dashboard/obd2?scenario=
    // - Default student scenarios -> /dashboard/obd2-student?scenario=
    if(s && Array.isArray(s.steps) && s.steps.length) return '/dashboard/obd2-ase?scenario=';
    if(s && (s.safetyLevel==='high-voltage' || s.vehicleType==='hybrid' || s.symptomCategory==='hybrid-ev')) return '/dashboard/obd2?scenario=';
    return '/dashboard/obd2-student?scenario=';
  }

  const src = window.scenarios || [];
  const seen = new Set();
  const registry = src.map(s => {
    let slug = s.slug || slugify(s.symptomCategory || s.symptoms || s.fault || s.id);
    // ensure uniqueness by appending numeric id if collision
    if (seen.has(slug)) {
      const suffix = (s.id !== undefined) ? String(s.id) : String(Math.floor(Math.random()*9000)+1000);
      slug = `${slug}-${suffix}`;
    }
    seen.add(slug);
    const title = s.title || (s.symptomCategory || s.symptoms || (`Scenario ${s.id}`));
    const shortSymptom = (s.symptoms && (s.symptoms.length>120 ? s.symptoms.slice(0,117)+'...' : s.symptoms)) || s.trainingFocus || '';
    const difficulty = (s.difficultyLevel || (typeof s.difficulty==='number' ? (s.difficulty>=4?'advanced':(s.difficulty>=3?'intermediate':'beginner')) : s.difficulty)) || 'intermediate';
    const estimatedTime = s.timeLimit ? Math.ceil(s.timeLimit/60) + ' min' : (s.estimatedTime || '10-20 min');
    const aseArea = s.aseArea || '';
    const category = s.symptomCategory || s.primarySystem || '';
    const image = `/assets/images/scenarios/${slug}.svg`;
    const routeBase = chooseRoute(s);
    const route = routeBase + encodeURIComponent(slug);
    return {
      id: slug,
      numericId: s.id,
      title: title,
      category: category,
      image: image,
      shortSymptom: shortSymptom,
      difficulty: difficulty,
      estimatedTime: estimatedTime,
      aseArea: aseArea,
      route: route,
      raw: s
    };
  });

  // expose for non-module environments
  window.SCENARIO_REGISTRY = registry;
})();

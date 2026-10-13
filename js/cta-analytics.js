// CTA Analytics binding — binds the mini analytics widget in the Instructor CTA
document.addEventListener('DOMContentLoaded', () => {
  // Presentation-only CTA preview. Live analytics must be explicitly injected by
  // an authorized, class-scoped caller; this script does not fetch learner data.
  const fallback = { avgScore: null, completionRate: null, weakAreas: null };

  const src = window.analyticsData || window.dashboardAnalytics || window.DASHBOARD_ANALYTICS || null;
  const analytics = (src && typeof src === 'object') ? src : fallback;

  const container = document.querySelector('.tm-instructor-preview');
  if (!container) return;

  const avgScoreEl = container.querySelector('.tm-analytics-mini .metric-large');
  const completionEl = container.querySelector('.tm-analytics-mini .badge--accent, .tm-analytics-mini .badge-accent, .tm-analytics-mini .badge--accent');
  const weakAreasEl = container.querySelector('.tm-analytics-mini .badge-warn');
  const barFillEl = container.querySelector('.tm-analytics-mini .tm-bar-fill');
  const topStudentNameEl = container.querySelector('.tm-top-student-name');
  const topStudentScoreEl = container.querySelector('.tm-top-student-score');
  const topStudentRowEl = container.querySelector('.tm-top-student');
  const topStudentAvatarImgEl = container.querySelector('.tm-top-student-avatar-img');
  const topStudentInitialsEl = container.querySelector('.tm-top-student-initials');

  if (avgScoreEl) avgScoreEl.textContent = (analytics.avgScore != null) ? analytics.avgScore : '—';
  if (completionEl) completionEl.textContent = (analytics.completionRate != null) ? (analytics.completionRate + '%') : '—';
  if (weakAreasEl) weakAreasEl.textContent = (analytics.weakAreas != null) ? analytics.weakAreas : '—';

  if (barFillEl) {
    // animate from 0 to value
    const value = analytics.avgScore;
    barFillEl.style.width = '0%';
    if (value != null) {
      // small delay to ensure transition applies
      requestAnimationFrame(() => {
        barFillEl.style.transition = 'width 700ms cubic-bezier(.2,.9,.2,1)';
        barFillEl.style.width = Math.max(0, Math.min(100, value)) + '%';
      });
    }
  }

  // Expose an update helper so other scripts can push live data later
  window.updateCTAAnalytics = function (newData) {
    try {
      const d = Object.assign({}, analytics, newData);

      // Average score + delta
      if (avgScoreEl && d.avgScore != null) {
        const curr = Number(d.avgScore);
        avgScoreEl.textContent = curr;

        // delta: compare to last stored value (simple last-visit delta)
        try {
          const prevRaw = localStorage.getItem('tm_cta_avgScore_v1');
          const prev = prevRaw ? Number(prevRaw) : null;
          const deltaEl = container.querySelector('.tm-delta');
          if (deltaEl) {
            if (prev != null && !Number.isNaN(prev)) {
              const diff = Math.round(curr - prev);
              if (diff > 0) {
                deltaEl.textContent = `+${diff}%`;
                deltaEl.classList.remove('tm-delta--down','tm-delta--neutral');
                deltaEl.classList.add('tm-delta--up');
                deltaEl.style.display = '';
              } else if (diff < 0) {
                deltaEl.textContent = `${diff}%`;
                deltaEl.classList.remove('tm-delta--up','tm-delta--neutral');
                deltaEl.classList.add('tm-delta--down');
                deltaEl.style.display = '';
              } else {
                deltaEl.textContent = `0%`;
                deltaEl.classList.remove('tm-delta--up','tm-delta--down');
                deltaEl.classList.add('tm-delta--neutral');
                deltaEl.style.display = '';
              }
            } else {
              // no previous value — hide the delta until we have one
              deltaEl.style.display = 'none';
            }
          }
        } catch (e) { void e; }

        // persist current avg for next-visit delta calculation
        try { localStorage.setItem('tm_cta_avgScore_v1', String(curr)); } catch (e) { void e; }
      }

      if (completionEl && d.completionRate != null) completionEl.textContent = d.completionRate + '%';
      if (weakAreasEl && d.weakAreas != null) weakAreasEl.textContent = d.weakAreas;
      if (topStudentNameEl && d.topStudent && d.topStudent.name) topStudentNameEl.textContent = d.topStudent.name;
      if (topStudentScoreEl && d.topStudent && (d.topStudent.score != null)) topStudentScoreEl.textContent = d.topStudent.score;
      // avatar: prefer provided avatarUrl, otherwise show initials
      try {
        const avatarUrl = d.topStudent && (d.topStudent.avatarUrl || d.topStudent.photo || d.topStudent.picture) ? (d.topStudent.avatarUrl || d.topStudent.photo || d.topStudent.picture) : null;
        if (avatarUrl && topStudentAvatarImgEl) {
          topStudentAvatarImgEl.src = avatarUrl;
          topStudentAvatarImgEl.alt = (d.topStudent.name || 'Top Student') + "'s avatar";
          topStudentAvatarImgEl.style.display = '';
          if (topStudentInitialsEl) topStudentInitialsEl.style.display = 'none';
        } else {
          if (topStudentAvatarImgEl) { topStudentAvatarImgEl.style.display = 'none'; topStudentAvatarImgEl.src = '' }
          if (topStudentInitialsEl) {
            const name = d.topStudent && d.topStudent.name ? d.topStudent.name : (d.topStudent && d.topStudent.id ? String(d.topStudent.id) : '—');
            const parts = String(name).trim().split(/\s+/);
            const initials = parts.length === 1 ? parts[0].slice(0,2).toUpperCase() : (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
            topStudentInitialsEl.textContent = initials;
            topStudentInitialsEl.style.display = '';
          }
        }
      } catch (e) { void e; }
      // make row actionable: navigate to student report when clicked (if id available)
      try{
        const sid = d.topStudent && (d.topStudent.id || d.topStudent.studentId || d.topStudent.uid) ? (d.topStudent.id || d.topStudent.studentId || d.topStudent.uid) : null
        if (topStudentRowEl){
          topStudentRowEl.dataset.studentId = sid || ''
          topStudentRowEl.onclick = () => {
            if (sid) window.location.href = `/dashboard/student/?id=${encodeURIComponent(sid)}`
            else window.location.href = '/dashboard/instructor/'
          }
        }
      }catch(e){ void e; }
      if (barFillEl && d.avgScore != null) barFillEl.style.width = Math.max(0, Math.min(100, d.avgScore)) + '%';
    } catch (e) { void e; }
  };

  // Live analytics are intentionally not auto-loaded here. An authorized page may
  // call window.updateCTAAnalytics(...) after resolving an explicit class scope.

  // Expose a simple trackEvent bridge for ESM consumers (e.g. `import { track } from './analytics.js'`).
  // This ensures the classic script and new ES module can coexist on the same page.
  function trackEvent(eventName, properties) {
    try {
      if (typeof window !== 'undefined' && typeof window.analytics?.track === 'function') {
        window.analytics.track(eventName, properties);
        return;
      }
      // no-op fallback — keep telemetry lightweight and non-blocking
    } catch (e) {
      // swallow telemetry errors
    }
  }

  if (typeof window !== 'undefined') {
    window.__torquemind_track = window.__torquemind_track || trackEvent;
  }
});

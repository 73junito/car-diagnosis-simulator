// CTA Analytics binding — binds the mini analytics widget in the Instructor CTA
document.addEventListener('DOMContentLoaded', () => {
  // Try to find analytics data from existing globals (if dashboard scripts expose them).
  // Fallback to placeholder data so the widget is always informative.
  const fallback = { avgScore: 82, completionRate: 94, weakAreas: 3 };

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

  if (avgScoreEl) avgScoreEl.textContent = (analytics.avgScore != null) ? analytics.avgScore : fallback.avgScore;
  if (completionEl) completionEl.textContent = ((analytics.completionRate != null) ? analytics.completionRate : fallback.completionRate) + '%';
  if (weakAreasEl) weakAreasEl.textContent = (analytics.weakAreas != null) ? analytics.weakAreas : fallback.weakAreas;

  if (barFillEl) {
    // animate from 0 to value
    const value = (analytics.avgScore != null) ? analytics.avgScore : fallback.avgScore;
    barFillEl.style.width = '0%';
    // small delay to ensure transition applies
    requestAnimationFrame(() => {
      barFillEl.style.transition = 'width 700ms cubic-bezier(.2,.9,.2,1)';
      barFillEl.style.width = Math.max(0, Math.min(100, value)) + '%';
    });
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
        } catch (e) {
          // ignore localStorage errors
        }

        // persist current avg for next-visit delta calculation
        try { localStorage.setItem('tm_cta_avgScore_v1', String(curr)); } catch (e) {}
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
      } catch (e) { /* noop */ }
      // make row actionable: navigate to student report when clicked (if id available)
      try{
        const sid = d.topStudent && (d.topStudent.id || d.topStudent.studentId || d.topStudent.uid) ? (d.topStudent.id || d.topStudent.studentId || d.topStudent.uid) : null
        if (topStudentRowEl){
          topStudentRowEl.dataset.studentId = sid || ''
          topStudentRowEl.onclick = () => {
            if (sid) window.location.href = `/dashboard/student?id=${encodeURIComponent(sid)}`
            else window.location.href = '/dashboard'
          }
        }
      }catch(e){/* noop */}
      if (barFillEl && d.avgScore != null) barFillEl.style.width = Math.max(0, Math.min(100, d.avgScore)) + '%';
    } catch (e) {
      // noop
    }
  };

  // If dashboard exposes a summary function, use it to populate the CTA when available
  try{
    const maybeSummaryFn = window.getDashboardAnalyticsSummary || window.getAnalyticsSummary || null
    if (typeof maybeSummaryFn === 'function'){
      maybeSummaryFn().then(result=>{
        if (!result) return
        const payload = {
          avgScore: result.avgScore ?? result.averageScore ?? null,
          completionRate: result.completionRate ?? result.completion ?? null,
          weakAreas: result.weakAreas ?? result.aseWeaknessesCount ?? null
        }
        window.updateCTAAnalytics(payload)
      }).catch(()=>{/* ignore */})
    }
  }catch(e){/* noop */}

  // Try to fetch a small analytics summary from the server if available
  async function fetchSummary() {
    // Try a dedicated summary endpoint first
    const tryJson = async (path) => {
      try {
        const res = await fetch(path, {cache: 'no-store'});
        if (!res.ok) return null;
        return await res.json();
      } catch { return null }
    }

    // /api/analytics/summary (optional)
    const summary = await tryJson('/api/analytics/summary');
    if (summary && (summary.avgScore != null || summary.completionRate != null || summary.weakAreas != null)) return {
      avgScore: summary.avgScore,
      completionRate: summary.completionRate,
      weakAreas: summary.weakAreas
    };

    // fallback: try sessions and students endpoints used by dashboard
    const sessions = await tryJson('/api/analytics/sessions');
    const students = await tryJson('/api/analytics/students');

    let out = {};
    if (students && Array.isArray(students.students) && students.students.length) {
      const vals = students.students.map(s=> (s.averageScore!=null? s.averageScore : (s.avgScore!=null? s.avgScore : null))).filter(n=>typeof n === 'number');
      if (vals.length) out.avgScore = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
    }
    if (!out.avgScore && sessions && typeof sessions.averageScore === 'number') out.avgScore = Math.round(sessions.averageScore);

    if (sessions) {
      if (typeof sessions.completionRate === 'number') out.completionRate = Math.round(sessions.completionRate);
      else if (typeof sessions.completed === 'number' && typeof sessions.totalSessions === 'number' && sessions.totalSessions>0) out.completionRate = Math.round((sessions.completed/sessions.totalSessions)*100);
    }

    if (sessions && typeof sessions.aseWeaknesses === 'number') out.weakAreas = sessions.aseWeaknesses;
    else if (students && typeof students.weakAreas === 'number') out.weakAreas = students.weakAreas;

    return (Object.keys(out).length) ? out : null;
  }

  // If a global `getAnalyticsSummary` exists, use it; otherwise try fetching summary endpoints
  (async () => {
    try {
      let remote = null;
      if (typeof window.getAnalyticsSummary === 'function') {
        remote = await window.getAnalyticsSummary();
      } else {
        remote = await fetchSummary();
      }
      if (remote) window.updateCTAAnalytics(remote);
    } catch (e) {
      // ignore failures — widget already has fallback values
    }
  })();

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

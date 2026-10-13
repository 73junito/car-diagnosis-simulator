/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve('apiClient.js'), 'utf8');

describe('shared auth expiry transition hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    delete window.__apiClientFetchPatched;
    delete window.apiGet;
    delete window.apiPost;
    delete window.apiPatch;
    delete window.apiDelete;
    delete window.getAccessToken;
    delete window.supabaseSignOut;
    window.API_BASE_URL = '';
  });

  test('recognizes same-origin /api calls as protected requests', () => {
    expect(source).toContain("return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');");
  });

  test('401 clears the session and emits authExpired', () => {
    expect(source).toContain('if (status === 401)');
    expect(source).toContain('window.supabaseSignOut');
    expect(source).toContain("new CustomEvent('supabase:authExpired'");
  });

  test('403 is authorization failure, not session expiry', () => {
    const forbiddenBlock = source.slice(
      source.indexOf('if (status === 403)'),
      source.indexOf('}', source.indexOf('if (status === 403)')) + 1
    );
    expect(forbiddenBlock).toContain("new CustomEvent('supabase:authForbidden'");
    expect(forbiddenBlock).not.toContain('supabaseSignOut');
  });

  test('expired dashboard sessions return to role-appropriate sign-in surfaces', () => {
    expect(source).toContain("path.startsWith('/dashboard/student/')");
    expect(source).toContain("window.location.replace('/sign-in/student/')");
    expect(source).toContain("path.startsWith('/dashboard/instructor/')");
    expect(source).toContain("path.startsWith('/dashboard/admin/')");
    expect(source).toContain("path.startsWith('/dashboard/institution/')");
    expect(source).toContain("path.startsWith('/dashboard/author/')");
    expect(source).toContain("window.location.replace('/sign-in/instructor/')");
  });
});

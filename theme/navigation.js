import { ROUTES } from '../config/routes.js';

/*
 * Public navigation is intentionally limited to non-paid surfaces.
 * Training and assessment routes are entitlement-controlled product surfaces
 * and must not be advertised here until their server-side access gate is live.
 */
export const NAV_ITEMS = Object.freeze([
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Docs', href: ROUTES.DOCS },
  { label: 'Contact', href: ROUTES.CONTACT },
  { label: 'Privacy', href: ROUTES.PRIVACY },
  { label: 'Terms', href: ROUTES.TERMS }
]);


export const WORKSPACE_NAV = Object.freeze({
  student: Object.freeze([
    { label: 'Scenarios', href: '/dashboard/student/' },
    { label: 'Learning Path', href: '/dashboard/student/learning-path/' },
    { label: 'Copilot', href: '/dashboard/student/copilot/' },
    { label: 'References', href: '/reference-library/' }
  ]),
  instructor: Object.freeze([
    { label: 'Instructor Home', href: '/dashboard/instructor/' },
    { label: 'Classroom', href: '/dashboard/instructor/classroom.html' },
    { label: 'Analytics', href: '/dashboard/instructor/analytics.html' },
    { label: 'Research', href: '/dashboard/instructor/research/' }
  ]),
  institution: Object.freeze([
    { label: 'Institution Home', href: '/dashboard/institution/' }
  ]),
  author: Object.freeze([
    { label: 'Authoring Home', href: '/dashboard/author/' }
  ])
});

export function workspaceNavFor(pathname = '/', search = '') {
  const path = String(pathname || '/');
  if (path.startsWith('/dashboard/student/')) return WORKSPACE_NAV.student;
  if (path.startsWith('/reference-library/')) {
    const params = new URLSearchParams(String(search || ''));
    return params.get('audience') === 'instructor'
      ? WORKSPACE_NAV.instructor
      : WORKSPACE_NAV.student;
  }
  if (path.startsWith('/dashboard/instructor/')) return WORKSPACE_NAV.instructor;
  if (path.startsWith('/dashboard/institution/')) return WORKSPACE_NAV.institution;
  if (path.startsWith('/dashboard/author/')) return WORKSPACE_NAV.author;
  return NAV_ITEMS;
}

const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const home = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'index.html'), 'utf8')
const html = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'classroom.html'), 'utf8')
const js = fs.readFileSync(path.join(root, 'dashboard', 'instructor', 'classroom.js'), 'utf8')
const build = fs.readFileSync(path.join(root, 'scripts', 'build-static-site.js'), 'utf8')

describe('Instructor classroom UI contract', () => {
  test('links the classroom workspace from the verified instructor home', () => {
    expect(home).toContain('href="/dashboard/instructor/classroom.html"')
    expect(home).toContain('Classes & Assignments')
  })

  test('ships classroom assets in the production static build', () => {
    for (const expected of [
      '"dashboard/instructor/classroom.html"',
      '"dashboard/instructor/classroom.css"',
      '"dashboard/instructor/classroom.js"'
    ]) expect(build).toContain(expected)
  })

  test('uses the shared auth and API clients', () => {
    expect(html).toContain('<script src="/auth.js"></script>')
    expect(html).toContain('<script src="/apiClient.js"></script>')
    expect(js).toContain("window.apiGet('/api/instructor/verification/status')")
    expect(js).toContain("window.location.replace('/sign-in/instructor/')")
  })

  test('uses only Worker-native classroom endpoints', () => {
    expect(js).toContain("window.apiGet('/api/classes')")
    expect(js).toContain("'/api/classes/' + encodeURIComponent(selectedClass.id) + '/students'")
    expect(js).toContain("window.apiPost('/api/classes', { name })")
    expect(js).toContain("window.apiPost('/api/assign', payload)")
    expect(js).not.toContain('/api/teacher/data')
  })

  test('does not authorize instructor access from browser role state', () => {
    expect(js).not.toContain('torquemindRole')
    expect(js).not.toContain("localStorage.getItem('role')")
    expect(js).toContain('verification?.authorizationGranted')
  })

  test('renders roster identity from the privacy-minimal contract', () => {
    expect(js).toContain('student.email || student.id')
    expect(js).toContain('student.enrolled_at')
    expect(js).not.toContain('student.password')
    expect(js).not.toContain('student.metadata')
  })

  test('preserves the training-assignment governance boundary', () => {
    expect(html).toContain('does not grant scored-assessment eligibility')
    expect(js).toContain("payload.studentIds = studentIds")
    expect(js).toContain("classId: selectedClass.id")
  })
})

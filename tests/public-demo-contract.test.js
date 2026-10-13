const fs = require('fs')
const path = require('path')

const root = path.resolve('.')
const html = fs.readFileSync(path.join(root, 'public-site', 'demo', 'index.html'), 'utf8')
const js = fs.readFileSync(path.join(root, 'public-site', 'demo', 'demo.js'), 'utf8')
const home = fs.readFileSync(path.join(root, 'public-site', 'index.html'), 'utf8')
const wrangler = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')

describe('G15 public interactive demo', () => {
  test('ships from the canonical public-site deployment surface', () => {
    expect(wrangler).toContain('"directory": "./public-site"')
    expect(home).toContain('href="/demo/"')
    expect(html).toContain('Interactive Diagnostic Demo')
  })

  test('uses only synthetic cleared content and labels the boundary explicitly', () => {
    expect(html).toContain('synthetic, cleared content')
    expect(html).toContain('Synthetic case')
    expect(html).toContain('fictional training vehicle')
    expect(html).toContain('Non-graded practice')
  })

  test('does not expose or call assessment APIs', () => {
    expect(html).not.toContain('/api/assessment')
    expect(html).not.toContain('/api/scenario-questions-approved')
    expect(html).not.toContain('/api/scenario-submissions/grade')
    expect(js).not.toContain('/api/')
    expect(js).not.toContain('fetch(')
    expect(js).not.toContain('XMLHttpRequest')
    expect(js).not.toContain('sendBeacon')
  })

  test('does not persist or personalize demo state', () => {
    expect(js).not.toContain('localStorage')
    expect(js).not.toContain('sessionStorage')
    expect(js).not.toContain('indexedDB')
    expect(js).not.toContain('cookie')
    expect(html).not.toContain('/auth.js')
    expect(html).not.toContain('SUPABASE')
  })

  test('does not contain answer-key or grading fields', () => {
    const combined = html + '\n' + js
    expect(combined).not.toContain('correct_answer')
    expect(combined).not.toContain('answer_key')
    expect(combined).not.toContain('is_correct')
    expect(combined).not.toContain('score')
    expect(combined).not.toContain('grade')
  })

  test('does not emit private telemetry', () => {
    const combined = html + '\n' + js
    expect(combined).not.toContain('/api/telemetry')
    expect(combined).not.toContain('telemetry_events')
    expect(combined).not.toContain('user_id')
    expect(combined).not.toContain('session_id')
  })

  test('does not imply academic credit, credentials, or accreditation', () => {
    expect(html).toContain('does not award academic credit or credentials')
    expect(html).toContain('does not create an assessment record')
    expect(html).toContain('no institutional record')
    expect(html).not.toMatch(/accredited|accreditation|certified|certificate earned/i)
  })

  test('follows the five-stage reasoning model without judging choices', () => {
    for (const label of ['Concern', 'Evidence', 'Evaluate', 'Test', 'Verify']) {
      expect(html).toContain('>'+label+'<')
    }
    expect(html).toContain('This choice is not scored.')
    expect(html).toContain('not a hidden answer key')
    expect(js).not.toContain('correct')
    expect(js).not.toContain('incorrect')
  })

  test('restart clears only in-page controls', () => {
    expect(js).toContain("document.querySelectorAll('input[type=\"radio\"]')")
    expect(js).toContain("document.querySelectorAll('textarea')")
    expect(js).toContain("document.querySelectorAll('select')")
    expect(js).toContain('setActive(0)')
  })
})

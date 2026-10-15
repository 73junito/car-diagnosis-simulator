/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8')

const page = {
  html: 'dashboard/student/multivoltage-lab/index.html',
  css: 'dashboard/student/multivoltage-lab/multivoltage-lab.css',
  js: 'dashboard/student/multivoltage-lab/multivoltage-lab.js',
  pageScript: 'src="./multivoltage-lab.js"',
  baseCss: 'dashboard/student/circuit-lab/circuit-lab.css',
  requiredIds: [
    'voltageProfile','stateSelect','faultSelect','showSystemFlow','traceLv','traceControl',
    'traceDcdc','traceTraction','resetView','stateBadge','circuitSvg','flowNote','inspectorContent',
    'multiVoltageEngineeringHeading','multiVoltageEngineeringStatus','engineeringDomainSelect',
    'domainCurrentInput','engDomainVoltage','engDomainVoltageLabel','engDomainCurrent','engDomainPower',
    'engDomainRole','engDomainBoundary','multiVoltageComparisonSummary','multiVoltageEngineeringFormula',
  ],
  jsMarkers: ['multivoltage-lab-lmf-runtime.json','LV12','TP_','multiVoltageEngineeringStatus'],
  // Safety / voltage-domain content that must survive the theme migration verbatim.
  safetyMarkers: [
    'Training safety boundary',
    'Conceptual training only',
    'isolation',
    'interlock bypass',
    'voltage-domain separation',
    '12 V low-voltage domain',
    'traction domain',
    '400 V traction',
    'not a universal hybrid/EV value',
  ],
}

describe('Student labs shared-theme conformance (Batch 4: multivoltage lab)', () => {
  test('loads canonical shared theme layers and drops legacy student.css', () => {
    const html = read(page.html)
    expect(html).toContain('href="/theme/tokens.css"')
    expect(html).toContain('href="/theme/layout.css"')
    expect(html).toContain('href="/theme/dashboard.css"')
    expect(html).toContain('href="/dashboard/student/circuit-lab/circuit-lab.css"')
    expect(html).toContain(page.css.split('/').pop())
    expect(html).not.toContain('href="../student.css"')
  })

  test('mounts the shared AutoLearnPro shell exactly once', () => {
    const html = read(page.html)
    expect((html.match(/data-theme-shell/g) || [])).toHaveLength(1)
    expect((html.match(/<main class="lab-shell tm-main">/g) || [])).toHaveLength(1)
    expect(html).toContain('import { mountShell } from "/theme/shell.js"')
    expect(html).toContain('mountShell()')
    expect(html).toContain('class="tm-page-header"')
    expect(html).toContain('class="tm-page-title"')
    expect(html).toContain('class="tm-page-subtitle"')
    expect(html).toContain('AutoLearnPro')
    // no duplicate shell/header structure
    expect((html.match(/<header class="tm-page-header">/g) || [])).toHaveLength(1)
    expect((html.match(/<nav class="lab-nav"/g) || [])).toHaveLength(1)
  })

  test('preserves load-bearing ids, page script, and shared button classes', () => {
    const html = read(page.html)
    for (const id of page.requiredIds) expect(html).toContain('id="' + id + '"')
    expect(html).toContain(page.pageScript)
    expect(html).toContain('id="resetView"')
    expect((html.match(/tm-btn tm-btn-secondary/g) || []).length).toBeGreaterThanOrEqual(6)
  })

  test('preserves canonical engineering/template behavior markers in JS', () => {
    const js = read(page.js)
    for (const marker of page.jsMarkers) expect(js).toContain(marker)
  })

  test('preserves critical safety and voltage-domain content', () => {
    const html = read(page.html)
    for (const marker of page.safetyMarkers) expect(html).toContain(marker)
    // voltage-domain separation must remain structurally present
    // (.domain-zone is rendered by JS into #circuitSvg and styled in the page CSS)
    const css = read(page.css)
    expect(css).toContain('.domain-zone')
    expect(html).toContain('LV12')
  })

  test('uses shared tokens and keeps narrow viewport safeguards', () => {
    const css = read(page.css)
    expect(css).toContain('var(--tm-')
    expect(css).toContain('@media(max-width:420px)')
    expect(css).toContain('.button-row .tm-btn')
  })

  test('keeps diagram overflow explicitly localized to the visualization', () => {
    const html = read(page.html)
    const css = read(page.baseCss) + '\n' + read(page.css)
    expect(html).toMatch(/class="diagram-scroll" aria-label="Scrollable/)
    expect(css).toContain('overflow-x:auto')
  })

  test('introduces no retired third-party certification trademark or taxonomy', () => {
    const combined = read(page.html) + '\n' + read(page.css) + '\n' + read(page.js)
    const protectedMark = ['A','S','E'].join('')
    const protectedOrganization = ['automotive','service','excellence'].join(' ')
    expect(combined).not.toMatch(new RegExp('\\b' + protectedMark + '\\b'))
    expect(combined.toLowerCase()).not.toContain(protectedOrganization)
    expect(combined).not.toMatch(/\bA[1-8]\b/)
    expect(combined).not.toMatch(/\bL1\b/)
    expect(combined).not.toMatch(/\bL3\b/)
  })

  test('introduces no animation workstream imports', () => {
    const combined = read(page.html) + '\n' + read(page.css) + '\n' + read(page.js)
    expect(combined).not.toMatch(/three(?:\.min|\.module)?\.js/i)
    expect(combined).not.toMatch(/(?:src|href)=["'][^"']*\/three\//i)
    expect(combined).not.toContain('animation-manifest')
    expect(combined).not.toContain('animation-player')
    expect(combined).not.toContain('blender-animation-pipeline')
  })
})

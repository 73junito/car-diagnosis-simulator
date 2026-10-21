#!/usr/bin/env node
/**
 * Build-time renderer for the static pathway architecture diagram.
 *
 * The exam site must not load executable JavaScript from a CDN: its own
 * Content-Security-Policy allows script-src 'self' only (plus the Cloudflare
 * Insights beacon origin). The learning-path flowchart is therefore rendered
 * ahead of time and committed as a static SVG.
 *
 * Source of truth: exam-site/learning-path/pathway-architecture.mmd
 * Output:          exam-site/learning-path/pathway-architecture.svg
 *
 * Usage:
 *   node scripts/render-pathway-diagram.js           # render and write the SVG
 *   node scripts/render-pathway-diagram.js --check   # re-render and compare only
 *
 * Requirements: network access to fetch the pinned Mermaid build, plus the
 * Playwright Chromium browser already used by the test suite. This script is a
 * development tool: it is not shipped and not run by the application.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'exam-site', 'learning-path', 'pathway-architecture.mmd');
const outputPath = path.join(root, 'exam-site', 'learning-path', 'pathway-architecture.svg');

const MERMAID_VERSION = '11.17.2';
const STABLE_ID = 'pathway-architecture-diagram';
const TITLE = 'AutoLearnPro academic pathway structure diagram';
const DESCRIPTION = [
  'Flowchart. The academic pathway structure splits into two academic levels.',
  'Undergraduate: 48 pathway courses under CIP 47.0604 — AUT 100-199 Foundations (13), AUT 200-299 Core Systems (12) and AUT 300-499 Advanced Technology (18), plus 5 named subject courses (Brakes, Electrical, Engine Performance, Hybrid and Electric Vehicle Technology, Suspension and Steering).',
  'Graduate: 30 pathway courses under CIP 15.0803 — AUT 500-599 Graduate Core and Specializations (18) and AUT 600-699 Research and Professional Practice (7), plus 5 named graduate courses (Advanced Diagnostic Analysis, Applied Research, Curriculum and Assessment Design, Technical Instructional Leadership, Vehicle Systems and Testing).',
  'The AUT-numbered courses lead to a unique course catalog record, and every catalog record has a stable course detail URL; the catalog holds 68 records in total (43 undergraduate, 25 graduate). Each record branches on whether curriculum content is developed: yes leads to a competency and lesson plan and then to evidence-governed learning; not yet leads to a catalog-only planned course.'
].join(' ');

async function prepareWorkspace() {
  const source = fs.readFileSync(sourcePath, 'utf8').trimEnd();

  const bundleUrl = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;
  const response = await fetch(bundleUrl);
  if (!response.ok) {
    throw new Error(`could not fetch Mermaid ${MERMAID_VERSION}: ${response.status}`);
  }
  const bundle = Buffer.from(await response.arrayBuffer());

  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'pathway-diagram-'));
  fs.writeFileSync(path.join(workspace, 'mermaid.min.js'), bundle);

  const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<pre class="mermaid">${source}</pre>
<script src="mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
  mermaid.run({ querySelector: '.mermaid' })
    .then(function () { window.__state = 'ok'; })
    .catch(function (error) { window.__state = 'error: ' + String(error); });
</script>
</body></html>`;
  const harnessPath = path.join(workspace, 'harness.html');
  fs.writeFileSync(harnessPath, harness);
  return { workspace, harnessPath };
}

async function renderWithPage(page, harnessPath) {
  await page.goto(`file:///${harnessPath.replace(/\\/g, '/')}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__state !== undefined, { timeout: 60000 });

  const state = await page.evaluate(() => window.__state);
  if (state !== 'ok') {
    throw new Error(`mermaid render failed: ${state}`);
  }

  const svg = await page.evaluate(() => {
    const element = document.querySelector('.mermaid svg');
    if (!element) return null;
    // XMLSerializer, not outerHTML: the rendered DOM is HTML-serialised, which
    // emits void elements such as <br> inside <foreignObject> and produces a
    // file that is not well-formed XML, so browsers refuse to decode it as an
    // SVG image. XMLSerializer emits valid XML.
    return new XMLSerializer().serializeToString(element);
  });
  if (!svg) {
    throw new Error('mermaid produced no SVG element');
  }
  return svg;
}

/**
 * Byte equality alone is not enough: a reproducible render can still be an
 * invalid image. Parse the markup as XML and check the properties a browser
 * needs in order to decode and lay it out. This runs in Chromium so the check
 * uses the same XML parser that will load the file.
 */
async function validateSvg(page, markup) {
  return page.evaluate((xml) => {
    const problems = [];
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      problems.push(`not well-formed XML: ${parseError.textContent.slice(0, 160)}`);
    }

    const root = doc.documentElement;
    if (!root || root.nodeName !== 'svg') {
      problems.push('root element is not <svg>');
      return problems;
    }

    const width = Number(root.getAttribute('width'));
    const height = Number(root.getAttribute('height'));
    if (!Number.isFinite(width) || width <= 0) problems.push('missing or invalid intrinsic width');
    if (!Number.isFinite(height) || height <= 0) problems.push('missing or invalid intrinsic height');

    const viewBox = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0 && width > 0 && height > 0) {
      const ratio = viewBox[2] / viewBox[3];
      if (Math.abs(width / height - ratio) / ratio > 0.01) {
        problems.push(`intrinsic size ${width}x${height} does not match the viewBox aspect ratio`);
      }
    }

    if (!root.querySelector('title') || !root.querySelector('desc')) {
      problems.push('missing accessible title/desc');
    }
    if (doc.querySelector('script')) problems.push('contains a script element');

    const external = [...xml.matchAll(/https?:\/\/[^\s"')]+/g)]
      .map((match) => match[0])
      .filter((url) => !url.startsWith('http://www.w3.org/'));
    if (external.length) problems.push(`external references: ${external.join(', ')}`);

    return problems;
  }, markup);
}

function stabilise(svg) {
  const idMatch = svg.match(/<svg id="(mermaid-\d+)"/);
  if (!idMatch) {
    throw new Error('could not locate the mermaid root id');
  }

  const provenance = `<!-- Pre-rendered static diagram. Generated with Mermaid ${MERMAID_VERSION} (theme: neutral, securityLevel: strict) from learning-path/pathway-architecture.mmd. Regenerate with: node scripts/render-pathway-diagram.js. No runtime JavaScript dependency. -->\n`;

  // Mermaid emits width="100%", which gives an SVG image no intrinsic size and
  // makes layout depend on the <img> attributes alone. Publish the viewBox
  // dimensions instead so the file is self-describing and cannot shift layout.
  let sized = svg;
  const viewBox = svg.match(/viewBox="([\d.\s]+)"/);
  if (viewBox) {
    const [, , width, height] = viewBox[1].trim().split(/\s+/);
    sized = svg.replace(
      /(<svg[^>]*?)width="100%"/,
      `$1width="${Math.ceil(Number(width))}" height="${Math.ceil(Number(height))}"`
    );
  }

  return provenance
    + sized
      .split(idMatch[1]).join(STABLE_ID)
      .replace(/(<svg id="[^"]+")/, `$1 aria-labelledby="${STABLE_ID}-title ${STABLE_ID}-desc"`)
      .replace(/(<svg[^>]*>)/, `$1<title id="${STABLE_ID}-title">${TITLE}</title><desc id="${STABLE_ID}-desc">${DESCRIPTION}</desc>`);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const { chromium } = require('playwright');

  const { workspace, harnessPath } = await prepareWorkspace();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const rendered = stabilise(await renderWithPage(page, harnessPath));

    const problems = await validateSvg(page, rendered);
    if (problems.length) {
      throw new Error(`generated SVG failed validation: ${problems.join('; ')}`);
    }

    if (checkOnly) {
      const committed = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
      const committedProblems = await validateSvg(page, committed);
      if (committedProblems.length) {
        console.error(
          `[FAIL] committed ${path.relative(root, outputPath)} failed validation: ${committedProblems.join('; ')}`
        );
        process.exit(1);
      }
      if (committed !== rendered) {
        console.error('[FAIL] pathway-architecture.svg is not current; run node scripts/render-pathway-diagram.js');
        process.exit(1);
      }
      console.log('[PASS] pathway-architecture.svg is current, well-formed and correctly sized.');
      return;
    }

    fs.writeFileSync(outputPath, rendered, 'utf8');
    console.log(`[PASS] wrote ${path.relative(root, outputPath)} (${Buffer.byteLength(rendered)} bytes)`);
  } finally {
    await browser.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[FAIL] ${error.message}`);
  process.exit(1);
});

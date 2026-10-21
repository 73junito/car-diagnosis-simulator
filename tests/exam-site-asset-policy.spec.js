const fs = require('fs');
const path = require('path');

const examDir = path.join(__dirname, '..', 'exam-site');
const stylesPath = path.join(examDir, 'styles.css');
const headersPath = path.join(examDir, '_headers');

function listExamSources(extensions) {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.test(entry.name)) found.push(full);
    }
  })(examDir);
  return found;
}

describe('Exam site cross-origin connect-src contract', () => {
  const cspLine = fs
    .readFileSync(headersPath, 'utf8')
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith('Content-Security-Policy:'));
  const connectDirective = cspLine
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('connect-src'));
  const allowedOrigins = connectDirective.replace('connect-src', '').trim().split(/\s+/);

  test('allows exactly the curriculum API origin in addition to self', () => {
    expect(allowedOrigins).toEqual(["'self'", 'https://app.autolearnpro.com']);
  });

  test('every cross-origin fetch target in exam-site is permitted by connect-src', () => {
    const offenders = [];

    for (const file of listExamSources(/\.(js|html)$/i)) {
      const relative = path.relative(examDir, file).split(path.sep).join('/');
      const text = fs.readFileSync(file, 'utf8');
      const literals = new Map(
        [...text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*['"](https:\/\/[^'"]+)['"]/g)].map(
          (m) => [m[1], m[2]]
        )
      );

      for (const match of text.matchAll(/fetch\(\s*(?:([A-Za-z0-9_$]+)|['"](https:\/\/[^'"]+)['"])/g)) {
        const url = match[2] || literals.get(match[1]);
        if (!url) continue;
        const origin = new URL(url).origin;
        if (!allowedOrigins.includes(origin)) {
          offenders.push(`${relative}:${text.slice(0, match.index).split(/\r?\n/).length} -> ${origin}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  test('keeps the curriculum API as the live source with the static fallback intact', () => {
    const catalogData = fs.readFileSync(path.join(examDir, 'catalog', 'catalog-data.js'), 'utf8');
    expect(catalogData).toContain('https://app.autolearnpro.com/api/curriculum');
    expect(catalogData).toContain('loadFromStatic');
    expect(catalogData).toMatch(/catch \(apiError\)[\s\S]*loadFromStatic/);
  });
});


describe('Exam site self-hosted font contract', () => {
  const styles = fs.readFileSync(stylesPath, 'utf8');

  test('declares DM Sans and Manrope from same-origin font files', () => {
    expect(styles).toContain("font-family:'DM Sans'");
    expect(styles).toContain("font-family:'Manrope'");

    const sources = [...styles.matchAll(/@font-face\{[^}]*src:url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const source of sources) {
      expect(source.startsWith('/fonts/')).toBe(true);
      expect(source.endsWith('.woff2')).toBe(true);
    }
  });

  test('ships every declared font file as a real woff2 asset', () => {
    const sources = [...new Set([...styles.matchAll(/url\('(\/fonts\/[^']+)'\)/g)].map((m) => m[1]))];
    expect(sources.length).toBeGreaterThanOrEqual(4);

    for (const source of sources) {
      const file = path.join(examDir, source.replace(/^\//, ''));
      expect(fs.existsSync(file)).toBe(true);
      const buffer = fs.readFileSync(file);
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('wOF2');
      expect(buffer.length).toBeGreaterThan(4096);
    }
  });

  test('ships the OFL licence text for each redistributed family', () => {
    for (const name of ['OFL-DM-Sans.txt', 'OFL-Manrope.txt']) {
      const file = path.join(examDir, 'fonts', name);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, 'utf8')).toContain('SIL OPEN FONT LICENSE');
    }
  });

  test('never reintroduces an external font or stylesheet source', () => {
    expect(styles).not.toMatch(/fonts\.googleapis\.com/);
    expect(styles).not.toMatch(/fonts\.gstatic\.com/);
    expect(styles).not.toMatch(/@import\s+url\(\s*['"]?https?:/);

    const externalUrls = [...styles.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)/g)].map((m) => m[1]);
    expect(externalUrls).toEqual([]);

    for (const file of listExamSources(/\.(css|html)$/i)) {
      const text = fs.readFileSync(file, 'utf8');
      const relative = path.relative(examDir, file).split(path.sep).join('/');
      expect(`${relative}:${/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text)}`).toBe(`${relative}:false`);
    }
  });
});


describe('Exam site static diagram contract', () => {
  const diagramPath = path.join(examDir, 'learning-path', 'pathway-architecture.svg');
  const learningPathHtml = fs.readFileSync(path.join(examDir, 'learning-path', 'index.html'), 'utf8');

  test('ships the pre-rendered diagram as a self-contained static asset', () => {
    expect(fs.existsSync(diagramPath)).toBe(true);
    const svg = fs.readFileSync(diagramPath, 'utf8');

    expect(svg).toMatch(/<svg[^>]*viewBox="/);
    expect(svg).toMatch(/<svg[^>]*width="\d+"/);
    expect(svg).toMatch(/<svg[^>]*height="\d+"/);
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).toContain('aria-labelledby');
    expect(svg).not.toMatch(/<script/i);

    const externalReferences = [...svg.matchAll(/https?:\/\/[^\s"')]+/g)]
      .map((match) => match[0])
      .filter((url) => !url.startsWith('http://www.w3.org/'));
    expect(externalReferences).toEqual([]);
  });

  test('is well-formed XML with intrinsic dimensions that match its viewBox', () => {
    // A reproducible render can still be an invalid image: an HTML-serialised
    // SVG (for example <br> inside <foreignObject>) is byte-stable yet fails to
    // decode. Parse the committed file as XML and check the sizing a browser
    // needs before it will render the diagram.
    const svg = fs.readFileSync(diagramPath, 'utf8');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.nodeName).toBe('svg');

    const root = doc.documentElement;
    const width = Number(root.getAttribute('width'));
    const height = Number(root.getAttribute('height'));
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);

    const [, , viewBoxWidth, viewBoxHeight] = root.getAttribute('viewBox').trim().split(/\s+/).map(Number);
    expect(viewBoxWidth).toBeGreaterThan(0);
    expect(viewBoxHeight).toBeGreaterThan(0);
    expect(Math.abs(width / height - viewBoxWidth / viewBoxHeight)).toBeLessThan(0.01);
  });

  test('embeds the diagram with an accessible text equivalent', () => {
    expect(learningPathHtml).toContain('src="/learning-path/pathway-architecture.svg"');
    expect(learningPathHtml).toMatch(/<img[^>]+alt="[^"]{80,}"/);
    expect(learningPathHtml).toContain('<figcaption>');
    expect(learningPathHtml).toMatch(
      /<details class="diagram-text">[\s\S]*<summary>Diagram text description<\/summary>[\s\S]*<\/details>/
    );
  });

  test('loads no third-party executable script on any exam page', () => {
    for (const file of listExamSources(/\.html$/i)) {
      const relative = path.relative(examDir, file).split(path.sep).join('/');
      const text = fs.readFileSync(file, 'utf8');

      expect(`${relative}:${/cdn\.jsdelivr\.net/.test(text)}`).toBe(`${relative}:false`);
      expect([...text.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)].map((m) => m[1])).toEqual([]);
      expect([...text.matchAll(/from\s+['"](https?:\/\/[^'"]+)['"]/g)].map((m) => m[1])).toEqual([]);
    }
  });
});


describe('Exam site pathway diagram content contract', () => {
  const learningPathDir = path.join(examDir, 'learning-path');
  const mmd = fs.readFileSync(path.join(learningPathDir, 'pathway-architecture.mmd'), 'utf8');
  const svg = fs.readFileSync(path.join(learningPathDir, 'pathway-architecture.svg'), 'utf8');
  const page = fs.readFileSync(path.join(learningPathDir, 'index.html'), 'utf8');
  const curriculumDir = path.join(__dirname, '..', 'data', 'curriculum');
  const courses = (file) => JSON.parse(fs.readFileSync(path.join(curriculumDir, file), 'utf8')).courses;

  const undergraduate = courses('undergraduate-courses.json');
  const graduate = courses('graduate-courses.json');
  const catalog = courses('course-catalog.json');

  const inBand = (list, prefix) =>
    list.filter((course) => new RegExp(`^aut-${prefix}`, 'i').test(String(course.id))).length;
  const named = (list) => list.filter((course) => !/^aut-/i.test(String(course.id))).length;

  const ugFoundations = inBand(undergraduate, 1);
  const ugCore = inBand(undergraduate, 2);
  const ugAdvanced = inBand(undergraduate, 3) + inBand(undergraduate, 4);
  const ugNamed = named(undergraduate);
  const grCore = inBand(graduate, 5);
  const grResearch = inBand(graduate, 6);
  const grNamed = named(graduate);
  const catalogUndergraduate = catalog.filter((course) => course.academicLevel === 'undergraduate').length;
  const catalogGraduate = catalog.filter((course) => course.academicLevel === 'graduate').length;

  test('the canonical data splits as pathway sets plus catalog records', () => {
    expect(ugFoundations + ugCore + ugAdvanced + ugNamed).toBe(undergraduate.length);
    expect(grCore + grResearch + grNamed).toBe(graduate.length);

    // The catalog holds exactly the AUT-numbered pathway courses.
    expect(ugFoundations + ugCore + ugAdvanced).toBe(catalogUndergraduate);
    expect(grCore + grResearch).toBe(catalogGraduate);

    // Named pathway courses have no catalog record, so the diagram must not
    // claim they lead to one.
    expect(ugNamed).toBeGreaterThan(0);
    expect(grNamed).toBeGreaterThan(0);
  });

  test('the diagram source states the canonical pathway totals and bands', () => {
    const expected = [
      `Undergraduate - ${undergraduate.length} courses`,
      `Graduate - ${graduate.length} courses`,
      `Foundations - ${ugFoundations}`,
      `Core Systems - ${ugCore}`,
      `Advanced Technology - ${ugAdvanced}`,
      `Named Subject Courses - ${ugNamed}`,
      `Graduate Core and Specializations - ${grCore}`,
      `Research and Professional Practice - ${grResearch}`,
      `Named Graduate Courses - ${grNamed}`
    ];
    for (const phrase of expected) {
      expect(mmd).toContain(phrase);
    }
    expect(mmd).toContain('Academic Pathway Structure');
  });

  test('the accessible descriptions agree with the diagram totals', () => {
    // The SVG <desc>, the page's <details> text and the img alt must all state
    // the same totals as the diagram source.
    expect(svg).toContain(`Undergraduate: ${undergraduate.length} pathway courses`);
    expect(svg).toContain(`Graduate: ${graduate.length} pathway courses`);

    expect(page).toContain(`Undergraduate — ${undergraduate.length} courses`);
    expect(page).toContain(`Graduate — ${graduate.length} courses`);
    expect(page).toContain(`undergraduate ${undergraduate.length} courses`);
    expect(page).toContain(`graduate ${graduate.length} courses`);

    expect(svg).toContain(`${catalog.length} records`);
    expect(page).toContain(`${catalogUndergraduate} undergraduate, ${catalogGraduate} graduate`);
  });

  test('the img dimensions match the SVG intrinsic size', () => {
    const svgRoot = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    const imgTag = page.match(/<img src="\/learning-path\/pathway-architecture\.svg"[^>]*>/)[0];

    expect(imgTag).toContain(`width="${svgRoot.getAttribute('width')}"`);
    expect(imgTag).toContain(`height="${svgRoot.getAttribute('height')}"`);
  });
});

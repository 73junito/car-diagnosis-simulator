const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OWNED_PREFIXES = [
  'dashboard/student/aut250-weekly-labs/',
  'instructor-resources/aut250-weekly-labs/',
  'tests/aut250-weekly-labs/',
  'docs/institutional-readiness/aut250-weekly-labs/',
  'scripts/verify-aut250-weekly-labs.js'
];

const NEW_SOURCES = [
  'scripts/verify-aut250-weekly-labs.js',
  'dashboard/student/aut250-weekly-labs/schema/student-lab.schema.json',
  'dashboard/student/aut250-weekly-labs/schema/instructor-reference.schema.json',
  'tests/aut250-weekly-labs/schema.test.js',
  'tests/aut250-weekly-labs/validator.test.js'
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('AUT 250 weekly labs — ownership and isolation boundary', () => {
  test('every new source file lives inside a declared owned path', () => {
    NEW_SOURCES.forEach((file) => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
      expect(OWNED_PREFIXES.some((prefix) => file.startsWith(prefix))).toBe(true);
    });
  });

  test('instructor material is never placed inside the student tree', () => {
    const instructorRoot = path.join(ROOT, 'instructor-resources', 'aut250-weekly-labs');
    expect(instructorRoot.startsWith(path.join(ROOT, 'dashboard'))).toBe(false);
    const studentLabs = path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'labs');
    if (fs.existsSync(studentLabs)) {
      const offenders = [];
      const walk = (dir) => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name === 'reference.json') offenders.push(full);
        });
      };
      walk(studentLabs);
      expect(offenders).toEqual([]);
    }
  });

  test('the validator is read-only: it performs no filesystem writes', () => {
    const source = stripComments(read('scripts/verify-aut250-weekly-labs.js'));
    ['writeFileSync', 'writeFile(', 'appendFile', 'mkdirSync', 'rmSync', 'unlinkSync', 'createWriteStream']
      .forEach((operation) => expect(source).not.toContain(operation));
  });

  test('the validator does not reference production systems or assessment logic', () => {
    const source = stripComments(read('scripts/verify-aut250-weekly-labs.js')).toLowerCase();
    ['supabase', 'wrangler', 'migration', 'gradebook', 'assessmenteligibility', 'score', 'points', 'passingmark']
      .forEach((term) => expect(source).not.toContain(term));
  });

  test('no new source file imports the engine, contracts, or student lab UI', () => {
    NEW_SOURCES.filter((file) => file.endsWith('.js')).forEach((file) => {
      // Only import/require statements are inspected. A test may legitimately
      // reference an asset *path string* to prove the reuse-plan rule works.
      const imports = stripComments(read(file)).split('\n')
        .filter((line) => /\brequire\s*\(|\bimport\s/.test(line))
        .join('\n')
        .toLowerCase();
      ['aut250misfirelab', 'engine/', 'contracts/', 'aut250-lab-ui', 'aut250-lab-assets'].forEach((term) => {
        expect(imports).not.toContain(term);
      });
    });
  });

  test('schemas forbid unknown properties so answer fields cannot be smuggled in', () => {
    ['student-lab', 'instructor-reference'].forEach((name) => {
      const schema = JSON.parse(read('dashboard/student/aut250-weekly-labs/schema/' + name + '.schema.json'));
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties.flags.additionalProperties).toBe(false);
    });
  });

  test('no delivered lab claims publication, grading, or assessment eligibility', () => {
    const labsDir = path.join(ROOT, 'dashboard', 'student', 'aut250-weekly-labs', 'labs');
    if (!fs.existsSync(labsDir)) return;
    fs.readdirSync(labsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        const file = path.join(labsDir, entry.name, 'lab.json');
        if (!fs.existsSync(file)) return;
        const lab = JSON.parse(fs.readFileSync(file, 'utf8'));
        Object.keys(lab.flags).forEach((flag) => expect(lab.flags[flag]).toBe(false));
      });
  });

  test('the blueprint and task doc owned by PR #1067 are not redefined here', () => {
    const forbidden = [
      'data/curriculum/aut250-weekly-lab-blueprint.json',
      'docs/institutional-readiness/AUT250-CLINE-WEEKLY-LABS-TASK.md',
      'tests/aut250-weekly-labs.spec.js'
    ];
    const { execFileSync } = require('child_process');
    const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
      .trim().split(/\r?\n/);
    forbidden.forEach((file) => {
      expect(changed).not.toContain(file);
    });
  });
});

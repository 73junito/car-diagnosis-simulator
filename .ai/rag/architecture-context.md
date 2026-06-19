# SOURCE 1: core\checkpoint\fileStore.js

const fs = require('fs');
const path = require('path');

class FileCheckpointStore {
  constructor(filePath, options = {}) {
    this.filePath = path.resolve(process.cwd(), filePath || '.checkpoints/checkpoints.json');
    this.tmpPath = this.filePath + '.tmp';
    this._data = {};
    this._loaded = false;
    this.options = options;
  }

  async _ensureDir() {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  async _load() {
    if (this._loaded) return;
    try {
      const txt = await fs.promises.readFile(this.filePath, 'utf8');
      this._data = JSON.parse(txt || '{}');
    } catch (e) {
      this._data = {};
    }
    this._loaded = true;
  }

  async _persist() {
    await this._ensureDir();
    const tmp = this.tmpPath;
    const data = JSON.stringify(this._data, null, 2);
    await fs.promises.writeFile(tmp, data, 'utf8');
    await fs.promises.rename(tmp, this.filePath);
  }

  async get(key) {
    await this._load();
    return this._data.hasOwnProperty(key) ? this._data[key] : undefined;
  }

  async set(key, value) {
    await this._load();
    this._data[key] = value;
    await this._persist();
    return true;
  }

  async has(key) {
    await this._load();
    return this._data.hasOwnProperty(key);
  }

  async delete(key) {
    await this._load();
    if (this._data.hasOwnProperty(key)) {
      delete this._data[key];
      await this._persist();
      return true;
    }
    return false;
  }

  async clear() {
    this._data = {};
    await this._persist();
    return true;
  }
}

module.exports = FileCheckpointStore;

---

# SOURCE 2: core\checkpoint\index.js

const FileCheckpointStore = require('./fileStore');
const { createMemoryStore } = require('./store');

// Export a default pluggable store. By default use a file-backed store but allow
// consumers to require and create their own stores if they prefer.
function defaultStore() {
  try {
    return new FileCheckpointStore('.checkpoints/checkpoints.json');
  } catch (e) {
    return createMemoryStore();
  }
}

module.exports = defaultStore();

---

# SOURCE 3: core\checkpoint\store.js

// Minimal checkpoint store interface and an in-memory store implementation.
// Exports a factory for an in-memory store to be used in tests or as a fallback.
class MemoryCheckpointStore {
  constructor() {
    this._map = new Map();
  }
  async get(key) {
    return this._map.has(key) ? this._map.get(key) : undefined;
  }
  async set(key, value) {
    this._map.set(key, value);
    return true;
  }
  async has(key) {
    return this._map.has(key);
  }
  async delete(key) {
    return this._map.delete(key);
  }
  async clear() {
    this._map.clear();
    return true;
  }
}

function createMemoryStore() {
  return new MemoryCheckpointStore();
}

module.exports = { createMemoryStore, MemoryCheckpointStore };

---

# SOURCE 4: core\diagnosis\artifactParser.js

const isBuffer = (v) => Buffer && Buffer.isBuffer && Buffer.isBuffer(v);

function tryParseJsonString(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function extractJsonFromBuffer(buf) {
  // try raw JSON
  const asString = buf.toString('utf8');
  const parsed = tryParseJsonString(asString);
  if (parsed) return parsed;

  // try ZIP
  // attempt to read as ZIP if JSON parse failed
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    for (const e of entries) {
      if (e.entryName && e.entryName.toLowerCase().endsWith('.json')) {
        const txt = e.getData().toString('utf8');
        const p = tryParseJsonString(txt);
        if (p) return p;
      }
    }
  } catch (err) {
    // not a zip or failed to parse; fall through
  }
  // fallback: try to locate a JSON substring inside the buffer
  try {
    const s = buf.toString('utf8');
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const sub = s.slice(first, last + 1);
      const p = tryParseJsonString(sub);
      if (p) return p;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function normalizeTestEntry(t) {
  return {
    name: t.name || t.fullName || t.title || 'unknown',
    status: (t.status || t.outcome || 'unknown').toString(),
    duration: Number.isFinite(t.duration) ? t.duration : (t.time || t.ms || 0),
    suite: t.suite || t.parent || t.file || null
  };
}

async function parseArtifact(input, opts = {}) {
  let obj = null;
  if (isBuffer(input)) {
    obj = extractJsonFromBuffer(input);
  } else if (typeof input === 'string') {
    obj = tryParseJsonString(input);
  } else if (typeof input === 'object' && input !== null) {
    obj = input;
  }

  const tests = [];
  if (obj) {
    if (Array.isArray(obj.tests)) {
      for (const t of obj.tests) tests.push(normalizeTestEntry(t));
    } else if (Array.isArray(obj.testResults)) {
      for (const suite of obj.testResults) {
        if (Array.isArray(suite.tests)) {
          for (const t of suite.tests) tests.push(normalizeTestEntry(t));
        }
      }
    } else if (Array.isArray(obj.results)) {
      for (const t of obj.results) tests.push(normalizeTestEntry(t));
    }
  }

  const metadata = {
    runId: opts.runId || (obj && obj.runId) || null,
    repo: opts.rep

---

# SOURCE 5: core\diagnosis\artifactParser.js

o || (obj && obj.repo) || null,
    timestamp: opts.timestamp || (obj && obj.timestamp) || Date.now()
  };

  return { tests, metadata };
}

module.exports = { parseArtifact };

---

# SOURCE 6: core\diagnosis\graphModel.js

const graph = {
  overheating: {
    causes: ['coolant_leak', 'thermostat_failure', 'radiator_blockage']
  },
  misfire: {
    causes: ['spark_plug_fault', 'fuel_injector_issue', 'ignition_coil_failure']
  },
  'battery-drain': {
    causes: ['parasitic_draw', 'faulty_alternator', 'old_battery']
  },
  'brake-noise': {
    causes: ['worn_pads', 'rotor_warp', 'foreign_object']
  }
};

function getGraph() {
  return graph;
}

function getCauses(symptom) {
  return graph[symptom] && Array.isArray(graph[symptom].causes) ? graph[symptom].causes.slice() : [];
}

module.exports = {
  getGraph,
  getCauses
};

---

# SOURCE 7: core\diagnosis\inference.js

/**
 * Decay a flap count given the number of days since last occurrence.
 * @param {number} oldCount - previous flap count
 * @param {number} daysSinceLast - days elapsed since last occurrence
 * @param {number} decayDays - number of days per decay step
 * @param {number} decayAmount - amount to subtract per decay step
 * @returns {number} new flap count (not negative)
 */
function decayFlapCount(oldCount, daysSinceLast, decayDays = 14, decayAmount = 1) {
  if (!Number.isFinite(oldCount) || oldCount <= 0) return 0;
  if (!Number.isFinite(daysSinceLast) || daysSinceLast <= 0) return oldCount;
  const steps = Math.floor(daysSinceLast / decayDays);
  const decayed = oldCount - steps * decayAmount;
  return Math.max(0, Math.floor(decayed));
}

/**
 * Decide whether to reopen an issue based on flap count and thresholds.
 * @param {object} opts
 * @param {number} opts.flapCount
 * @param {number} [opts.minOccurrences=1]
 * @param {number} [opts.runsSinceClose=0]
 * @param {number} [opts.backoffRuns=0]
 * @returns {boolean}
 */
function shouldReopen({ flapCount, minOccurrences = 1, runsSinceClose = 0, backoffRuns = 0 } = {}) {
  if (!Number.isFinite(flapCount) || flapCount <= 0) return false;
  if (flapCount < minOccurrences) return false;
  if (Number.isFinite(backoffRuns) && runsSinceClose < backoffRuns) return false;
  return true;
}

function applyReopenMetadata(body, newFlapCount) {
  const next = Object.assign({}, body || {});
  next.flap_count = newFlapCount;
  next.reopened = true;
  next.reopened_at = new Date().toISOString();
  return next;
}

module.exports = {
  decayFlapCount,
  shouldReopen,
  applyReopenMetadata
};

/**
 * Evaluate signals and produce a score and decision.
 * @param {Array} signals
 * @param {object} context { flapCount, runsSinceClose, daysSinceLast, thresholds }
 */
function evaluateSignals(signals = [], context = {}) {
  const flapCount = Number.isFinite(context.flapCount) ? context.flapCount : 0;
  const runsSinceClose = Number.isFinite(context.runsSinceClose) ? context.runsSinceClose : 0;
  const daysSinceLast = Number.isFinite(context.daysSinceLast) ? context.daysSinceLast : 0;

  let raw = 0;
  const reasons = [];

  if (!Array.isArray(signals) || signals.length === 0) {
    const finalScore = 0;
    const should = shouldReopen({ flapCount, runsSinceClose, minOccurrences: (context.thresholds && context.thresholds.minOccurrences) || 1, backoffRuns: (context.thresho

---

# SOURCE 8: core\diagnosis\inference.js

lds && context.thresholds.backoffRuns) || 0 });
    return { score: finalScore, shouldReopen: should, reasons, updatedFlapCount: flapCount };
  }

  for (const s of signals) {
    // base signal match
    raw += 0.5;
    // repeated symptom
    if (flapCount > 0) raw += 0.2;
    // graph-confirmed cause
    if (s && Array.isArray(s.likelyCauses) && s.likelyCauses.length > 0) raw += 0.2;
  }

  // average per signal to keep scale reasonable
  raw = raw / signals.length;

  // apply decay penalty based on flap count (older flaps decay reduce influence)
  const decayed = decayFlapCount(flapCount, daysSinceLast, (context.thresholds && context.thresholds.decayDays) || 14, (context.thresholds && context.thresholds.decayAmount) || 1);
  const penalty = Math.min(0.5, decayed * 0.05);

  let score = Math.max(0, Math.min(1, raw - penalty));

  // reasons
  if (score >= 0.7) reasons.push('high frequency regression signal');
  if (signals.some(s => s && Array.isArray(s.likelyCauses) && s.likelyCauses.length > 0)) reasons.push('matches known unstable subsystem');

  const updatedFlapCount = (score >= 0.5) ? (flapCount + 1) : flapCount;

  const should = shouldReopen({ flapCount: updatedFlapCount, runsSinceClose, minOccurrences: (context.thresholds && context.thresholds.minOccurrences) || 1, backoffRuns: (context.thresholds && context.thresholds.backoffRuns) || 0 });

  return {
    score,
    shouldReopen: should,
    reasons,
    updatedFlapCount
  };
}

module.exports.evaluateSignals = evaluateSignals;

---

# SOURCE 9: core\diagnosis\ruleEngine.js

/**
 * Convert parsed artifact model into normalized findings.
 * @param {{tests: Array}} parsedArtifact
 * @returns {Array} findings
 */
function normalizeFindings(parsedArtifact) {
  const out = [];
  const tests = (parsedArtifact && Array.isArray(parsedArtifact.tests)) ? parsedArtifact.tests : [];
  for (const t of tests) {
    const name = t.name || t.fullName || t.title || 'unknown';
    const suite = (t.suite || '').toString();
    const status = (t.status || t.outcome || 'unknown').toString().toLowerCase();

    let symptom = 'test_failure';
    if (suite.toLowerCase().includes('integration') || name.toLowerCase().includes('integration')) symptom = 'integration_failure';
    else if (suite.toLowerCase().includes('unit') || name.toLowerCase().includes('unit')) symptom = 'unit_failure';

    out.push({
      symptom,
      severity: status,
      suite: suite || null,
      name
    });
  }
  return out;
}

/**
 * Given normalized findings and a graphModel, return candidate regression signals.
 * @param {Array} findings
 * @param {{getCauses: function}} graphModel
 */
function detectRegressionSignals(findings, graphModel) {
  const signals = [];
  for (const f of findings) {
    const causes = (graphModel && typeof graphModel.getCauses === 'function') ? graphModel.getCauses(f.symptom) : [];
    signals.push({
      symptom: f.symptom,
      likelyCauses: Array.isArray(causes) ? causes.slice() : []
    });
  }
  return signals;
}

module.exports = {
  normalizeFindings,
  detectRegressionSignals
};

---

# SOURCE 10: api\analytics\export.js

const fs = require('fs');
const path = require('path');

function availableExports() {
  const out = [];
  const csv = path.resolve('reports/student-performance.csv');
  const xapi = path.resolve('reports/xapi-statements.json');
  const sv = path.resolve('reports/scenario-validation-report.json');
  if (fs.existsSync(csv)) out.push({ name: 'student-performance.csv', path: csv });
  if (fs.existsSync(xapi)) out.push({ name: 'xapi-statements.json', path: xapi });
  if (fs.existsSync(sv)) out.push({ name: 'scenario-validation-report.json', path: sv });
  return out;
}

function getExportContent(format='csv') {
  const list = availableExports();
  const found = list.find(e => e.name.toLowerCase().endsWith(format.toLowerCase()));
  if (!found) return null;
  return fs.readFileSync(found.path, 'utf8');
}

function registerExportRoutes(app) {
  app.get('/api/analytics/export', (req, res) => {
    const fmt = (req.query.format || 'csv').toLowerCase();
    const content = getExportContent(fmt);
    if (!content) return res.status(404).json({ ok: false, message: 'export not found' });
    if (fmt === 'csv') {
      res.setHeader('Content-Type','text/csv');
      return res.send(content);
    }
    if (fmt === 'json' || fmt === 'xjson' || fmt === 'xapi' || fmt.endsWith('.json')) {
      res.setHeader('Content-Type','application/json');
      try { return res.send(JSON.parse(content)); } catch (e) { return res.send(content); }
    }
    res.send(content);
  });
}

module.exports = { registerExportRoutes, availableExports, getExportContent };

---

# SOURCE 11: api\analytics\sessions.js

function loadReport() {
  const fs = require('fs');                
  const path = require('path');
  const reportPath = path.join(__dirname, 'analytics-report.json');
  try {
    const exists = fs.existsSync && typeof fs.existsSync === 'function' ? fs.existsSync(reportPath) : undefined;
    try {
      console.debug('[loadReport sessions] fs keys:', Object.keys(fs));
    } catch (e) {
      console.debug('[loadReport sessions] fs keys: <unable to list>');
    }
    console.debug('[loadReport sessions] existsSync:', exists, 'path:', reportPath);
    if (exists === false) return { sessions: [] };
    const raw = fs.readFileSync(reportPath, 'utf8');
    console.debug('[loadReport sessions] readFileSync type:', typeof raw);
    return JSON.parse(raw);
  } catch (err) {
    return { sessions: [] };
  }
}

const { setAppVersionHeader } = require('../_utils/app-version');

function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function aggregateSessions() {
  const report = loadReport();
  const sessions = Array.isArray(report && report.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return {
      ok: true,
      totalSessions: 0,
      averageConfidence: 0,
      students: [],
    };
  }

  const totalSessions = sessions.length;
  const totalConfidence = sessions.reduce((sum, s) => sum + (Number(s.confidence) || 0), 0);
  const averageConfidence = round(totalConfidence / totalSessions, 3);

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    if (!perStudent.has(id)) perStudent.set(id, { id, sessions: 0, confidenceSum: 0 });
    const cur = perStudent.get(id);
    cur.sessions += 1;
    cur.confidenceSum += Number(session.confidence) || 0;
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageConfidence: round(s.confidenceSum / s.sessions, 3),
  }));

  return {
    ok: true,
    totalSessions,
    averageConfidence,
    students,
  };
}

function handler(req, res) {
  setAppVersionHeader(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    return res.json(aggregateSessions());
  } catch (err) {
    console.error('[/api/analytics/sessions]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

---

# SOURCE 12: api\analytics\sessions.js

module.exports = handler;
module.exports.aggregateSessions = aggregateSessions;

function registerSessionsRoutes(app) {
  app.get('/api/analytics/sessions', (req, res) => {
    try {
      return res.json(aggregateSessions());
    } catch (err) {
      console.error('[registerSessionsRoutes] error', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}

module.exports.registerSessionsRoutes = registerSessionsRoutes;

---

# SOURCE 13: api\analytics\students.js

function loadReport() {
  const fs = require('fs');                
  const path = require('path');
  const reportPath = path.join(__dirname, 'analytics-report.json');
  try {
    const raw = fs.readFileSync(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { sessions: [] };
  }
}

const { setAppVersionHeader } = require('../_utils/app-version');

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function aggregateStudents() {
  const report = loadReport();
  const sessions = Array.isArray(report && report.sessions) ? report.sessions : [];

  if (sessions.length === 0) {
    return { ok: true, totalStudents: 0, students: [] };
  }

  const perStudent = new Map();
  for (const session of sessions) {
    const id = session.userId || session.user || 'unknown';
    if (!perStudent.has(id)) perStudent.set(id, { id, sessions: 0, scoreSum: 0, confidenceSum: 0 });
    const cur = perStudent.get(id);
    cur.sessions += 1;
    cur.scoreSum += Number(session.score) || 0;
    cur.confidenceSum += Number(session.confidence) || 0;
  }

  const students = Array.from(perStudent.values()).map((s) => ({
    id: s.id,
    sessions: s.sessions,
    averageScore: s.sessions ? round(s.scoreSum / s.sessions, 0) : 0,
    averageConfidence: s.sessions ? round(s.confidenceSum / s.sessions, 2) : 0,
  }));

  return { ok: true, totalStudents: students.length, students };
}

function handler(req, res) {
  setAppVersionHeader(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    return res.json(aggregateStudents());
  } catch (err) {
    console.error('[/api/analytics/students]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

module.exports = handler;
module.exports.aggregateStudents = aggregateStudents;

function registerStudentsRoutes(app) {
  app.get('/api/analytics/students', (req, res) => {
    try {
      return res.json(aggregateStudents());
    } catch (err) {
      console.error('[registerStudentsRoutes] error', err);
      return res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  });
}

module.exports.registerStudentsRoutes = registerStudentsRoutes;

---

# SOURCE 14: api\analytics\summary.js

const { aggregateSessions } = require('./sessions');
const { setAppVersionHeader } = require('../_utils/app-version');

// Vercel serverless handler — returns a small analytics summary
module.exports = (req, res) => {
  setAppVersionHeader(res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const data = aggregateSessions();
    res.status(200).json({
      ok:                true,
      totalSessions:     data.totalSessions || 0,
      averageConfidence: data.averageConfidence || 0,
      totalStudents:     Array.isArray(data.students) ? data.students.length : 0,
      aseWeaknesses:     data.aseWeaknesses || [],
    });
  } catch (err) {
    console.error('[/api/analytics/summary]', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
};

---

# SOURCE 15: api\attempts\load.js

const appVersionUtil = require('../_utils/app-version');

let createClient = null;
try {
  // lazy require so missing dependency doesn't crash non-configured envs
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  createClient = null;
}

module.exports = async (req, res) => {
  appVersionUtil.setAppVersionHeader(res);
  // debug logging removed
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const user_id = req.query.user_id || null;
    const scenario = req.query.scenario || null;

    if (!user_id) return res.status(400).json({ ok: false, error: 'validation', message: 'user_id is required' });
    if (!scenario) return res.status(400).json({ ok: false, error: 'validation', message: 'scenario is required' });

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    if (!createClient || !SUPABASE_URL || !(SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    // Create supabase client using the available factory
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
    let resp = null;

    // Execute the query using the standard Supabase query-builder shape.
    const tableRef = client && typeof client.from === 'function' ? client.from('attempts') : null;
    if (!tableRef) {
      console.error('[/api/attempts/load] supabase client.from is not available');
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    let query = null;
    try {
      query = typeof tableRef.select === 'function' ? tableRef.select('*') : null;
    } catch (e) {
      console.error('[/api/attempts/load] supabase select init failure', e);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    if (!query || typeof query.eq !== 'function') {
      console.error('[/api/attempts/load] unexpected supabase query shape', query && Object.keys(query));
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    try {
      resp = await query
        .eq('user_id', user_id)
        .eq('scenario', scenario)
        .order('created_at', { ascending: false })
        .limit(1);

---

# SOURCE 16: api\attempts\load.js

} catch (e) {
      console.error('[/api/attempts/load] supabase query failure', e);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }
    if (resp.error) {
      console.error('[/api/attempts/load] supabase select error', resp.error);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    const row = Array.isArray(resp.data) && resp.data.length ? resp.data[0] : null;
    return res.status(200).json({ ok: true, attempt: row });
  } catch (err) {
    console.error('[/api/attempts/load] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};

---

# SOURCE 17: api\attempts\save.js

const { setAppVersionHeader } = require('../_utils/app-version');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });
const bodySchema = {
  type: 'object',
  required: ['scenario', 'workflow_type'],
  properties: {
    user_id: { type: 'string' },
    scenario: { type: 'string', minLength: 1 },
    workflow_type: { type: 'string', minLength: 1 },
    payload_json: { type: 'object' },
    score: { type: 'number' },
    completion_state: { type: 'string' },
  },
  additionalProperties: false,
};
const validateBody = ajv.compile(bodySchema);

module.exports = async (req, res) => {
  setAppVersionHeader(res);
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const body = req.body || {};
    const { user_id, scenario, workflow_type, payload_json, score, completion_state } = body;

    if (!validateBody(body)) {
      return res.status(400).json({ ok: false, error: 'validation', details: validateBody.errors });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || null;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;
    const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      // Graceful: indicate remote persistence unavailable
      return res.status(503).json({ ok: false, error: 'supabase_unavailable' });
    }

    // Lazy-require supabase so tests don't need the package installed
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Insert attempt record
    const payload = {
      user_id: user_id || null,
      scenario,
      workflow_type,
      payload_json: payload_json || null,
      score: typeof score === 'number' ? score : null,
      completion_state: completion_state || null,
    };

    const resp = await client.from('attempts').insert([payload]).select('id').single();
    if (resp.error) {
      console.error('[/api/attempts/save] supabase insert error', resp.error);
      return res.status(502).json({ ok: false, error: 'supabase_error' });
    }

    const id = resp.data && resp.data.id ? resp.data.id : null;
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('[/api/attempts/save] unexpected error', err);
    return

---

# SOURCE 18: api\attempts\save.js

res.status(500).json({ ok: false, error: 'internal_error' });
  }
};

---

# SOURCE 19: api\auth\role.js

// Role resolution: tries Supabase token verification when env vars are set
const { verifyToken } = require('./supabase-token');

async function resolveUserRole(req, clientFactory) {
  let role = 'anonymous';
  let userId = null;
  let source = 'none';

  if (req && req.headers) {
    // If Authorization header present and Supabase env configured, attempt token verification
    if (req.headers.authorization) {
      const tokenInfo = await verifyToken(req.headers.authorization, clientFactory);
      // If verifier returns an explicit denial (object with `denied: true`), treat as authoritative
      if (tokenInfo && tokenInfo.denied) {
        return { role: 'anonymous', userId: null, source: tokenInfo.source || 'supabase' };
      }
      if (tokenInfo) {
        return { role: tokenInfo.role || 'anonymous', userId: tokenInfo.userId || null, source: tokenInfo.source || 'supabase' };
      }
      // token verification failed or not configured; fall through to header-based (demo) behavior
    }

    if (req.headers['x-torquemind-role']) {
      role = req.headers['x-torquemind-role'];
      source = 'header';
    }

    if (req.headers.authorization && source === 'header') {
      source = 'header+token';
    } else if (req.headers.authorization) {
      source = 'token';
    }
  }

  return { role, userId, source };
}

module.exports = { resolveUserRole };

---

# SOURCE 20: dashboard\analytics.html

<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Analytics Dashboard</title>
  <link rel="stylesheet" href="../theme.css" />
</head>
<body>
  <main class="container">
    <h1>Instructor Analytics <a href="/dashboard/live-session" style="font-size:0.6rem;margin-left:1rem;">(Live Session)</a></h1>

    <section class="cards" id="summary-cards">
      <div class="tm-card" id="card-total">
        <div class="label">Total Sessions</div>
        <div class="value">—</div>
      </div>
      <div class="tm-card" id="card-confidence">
        <div class="label">Average Confidence</div>
        <div class="value">—</div>
      </div>
      <div class="tm-card" id="card-time">
        <div class="label">Average Time</div>
        <div class="value">—</div>
      </div>
      <div class="tm-card" id="card-safety">
        <div class="label">Safety Misses</div>
        <div class="value">—</div>
      </div>
    </section>

    <section class="exports">
      <button id="download-csv" class="btn btn-ghost">Download CSV</button>
      <button id="download-xapi" class="btn btn-ghost">Download xAPI JSON</button>
    </section>

    <section class="students">
      <h2>Student Performance</h2>
      <table id="student-table" class="tm-table">
        <thead>
          <tr class="tm-table-header"><th>Student</th><th>Sessions</th><th>Avg Score</th><th>Avg Confidence</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>

    <section class="ase-weakness">
      <h2>ASE Weaknesses</h2>
      <div id="ase-chart">(Chart placeholder)</div>
    </section>
  </main>

  <script src="./analytics.js"></script>
</body>
</html>

---

# SOURCE 21: dashboard\analytics.js

document.addEventListener('DOMContentLoaded', ()=>{
  const cardTotal = document.querySelector('#card-total .value')
  const cardConfidence = document.querySelector('#card-confidence .value')
  const cardTime = document.querySelector('#card-time .value')
  const cardSafety = document.querySelector('#card-safety .value')
  const studentTbody = document.querySelector('#student-table tbody')
  const downloadCsv = document.getElementById('download-csv')
  const downloadXapi = document.getElementById('download-xapi')

  async function fetchJson(path){
    const res = await fetch(path);
    if (!res.ok) throw new Error('Fetch failed: '+res.status)
    return res.json()
  }

  function fmtNumber(n, digits=1){ return (Math.round(n*10**digits)/10**digits).toString() }

  function isFiniteNumber(value){
    return typeof value === 'number' && Number.isFinite(value)
  }

  function readFirstNumber(source, keys){
    for (const key of keys){
      if (isFiniteNumber(source?.[key])) return source[key]
    }
    return null
  }

  function deriveSessionSummary(data){
    const summary = {
      averageTime: isFiniteNumber(data?.averageTime) ? data.averageTime : null,
      safetyMisses: isFiniteNumber(data?.safetyMisses) ? data.safetyMisses : null,
    }

    if (summary.averageTime != null && summary.safetyMisses != null) return summary

    const sessions = Array.isArray(data?.sessions)
      ? data.sessions
      : Array.isArray(data?.items)
        ? data.items
        : []

    if (!sessions.length) return summary

    if (summary.averageTime == null){
      const durations = sessions
        .map(session=>readFirstNumber(session, ['averageTime', 'duration', 'durationSeconds', 'timeSeconds', 'timeSpent']))
        .filter(value=>value != null)
      if (durations.length){
        summary.averageTime = durations.reduce((total, value)=>total + value, 0) / durations.length
      }
    }

    if (summary.safetyMisses == null){
      const misses = sessions
        .map(session=>readFirstNumber(session, ['safetyMisses', 'misses', 'safetyErrors', 'unsafeActions']))
        .filter(value=>value != null)
      if (misses.length){
        summary.safetyMisses = misses.reduce((total, value)=>total + value, 0)
      }
    }

    return summary
  }

  // populate summary
  fetchJson('/api/analytics/sessions').then(data=>{
    if (!data || !data.ok) return
    const summary = deriveSessionSummary(data)
    car

---

# SOURCE 22: dashboard\analytics.js

dTotal.textContent = data.totalSessions ?? '0'
    cardConfidence.textContent = (data.averageConfidence!=null) ? (fmtNumber(data.averageConfidence)+'%') : '—'
    cardTime.textContent = (summary.averageTime!=null) ? `${Math.round(summary.averageTime)}s` : '—'
    cardSafety.textContent = summary.safetyMisses ?? '0'
  }).catch(e=>{ console.warn('sessions fetch failed', e); });

  // students
  fetchJson('/api/analytics/students').then(data=>{
    if (!data || !data.ok) return
    while (studentTbody.firstChild) studentTbody.removeChild(studentTbody.firstChild);
    (data.students||[]).forEach(s=>{
      const tr = document.createElement('tr')
      tr.className = 'tm-table-row'

      const name = document.createElement('td'); name.textContent = s.name || s.id || '—'

      const sessions = document.createElement('td');
      sessions.className = 'metric-small';
      sessions.textContent = (s.sessions||0)

      const avgScoreValue = s.averageScore != null ? s.averageScore : s.avgScore
      const avgConfidenceValue = s.averageConfidence != null ? s.averageConfidence : s.avgConfidence

      const avgScore = document.createElement('td');
      const scoreSpan = document.createElement('span');
      if (avgScoreValue == null) { scoreSpan.textContent = '—'; scoreSpan.className='metric' }
      else { scoreSpan.textContent = fmtNumber(avgScoreValue)+'%'; scoreSpan.className='metric'; }
      // badge color by thresholds
      if (avgScoreValue != null){
        if (avgScoreValue >= 85) scoreSpan.classList.add('badge-success')
        else if (avgScoreValue >= 70) scoreSpan.classList.add('badge-warn')
        else scoreSpan.classList.add('badge-danger')
      }
      avgScore.appendChild(scoreSpan)

      const avgConfidence = document.createElement('td');
      const confSpan = document.createElement('span');
      if (avgConfidenceValue == null) { confSpan.textContent = '—'; confSpan.className='metric' }
      else { confSpan.textContent = fmtNumber(avgConfidenceValue)+'%'; confSpan.className='metric' }
      if (avgConfidenceValue != null){
        if (avgConfidenceValue >= 80) confSpan.classList.add('badge-success')
        else if (avgConfidenceValue >= 60) confSpan.classList.add('badge-warn')
        else confSpan.classList.add('badge-danger')
      }
      avgConfidence.appendChild(confSpan)

      tr.appendChild(name); tr.appendChild(sessions); tr.appendChild(avgScore); tr.appendChild(avgConfidence)

---

# SOURCE 23: dashboard\analytics.js

studentTbody.appendChild(tr)
    })
  }).catch(e=>{ console.warn('students fetch failed', e); });

  // download helpers
  async function download(path, filename){
    try{
      const res = await fetch(path)
      if (!res.ok) { alert('Download failed: '+res.status); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch(err){ alert('Download error') }
  }

  downloadCsv.addEventListener('click', ()=>{
    download('/api/analytics/export?format=csv','student-performance.csv')
  });
  downloadXapi.addEventListener('click', ()=>{
    download('/api/analytics/export?format=xapi','xapi-statements.json')
  });

  // --- Live telemetry (SSE) hookup ---
  (function attachLiveTelemetry(){
    try{
      const wrapper = document.createElement('div');
      wrapper.id = 'telemetry-panel';
      wrapper.style.marginTop = '1rem';
      const title = document.createElement('h3'); title.textContent = 'Live Telemetry';
      wrapper.appendChild(title);
      const list = document.createElement('ul'); list.id = 'telemetry-events-list'; list.style.maxHeight = '200px'; list.style.overflow = 'auto'; list.style.fontSize = '0.9rem';
      wrapper.appendChild(list);
      document.body.appendChild(wrapper);

      const s = document.createElement('script');
      s.src = '/dashboard/live-telemetry.js';
      s.onload = function(){
        try{
          const live = (window.liveTelemetry || {}).initLiveTelemetry(function(evt){
            const li = document.createElement('li');
            const ts = evt.timestamp || (new Date()).toISOString();
            li.textContent = `[${ts}] ${evt.type} ${evt.id ? '('+evt.id+')' : ''} ` + (evt.payload ? JSON.stringify(evt.payload) : JSON.stringify(evt));
            list.insertBefore(li, list.firstChild);
            // cap UI list to 200
            while(list.children.length > 200) list.removeChild(list.lastChild);
          });
          // expose for debugging
          window._liveTelemetryHandle = live;
        }catch(e){ console.warn('live telemetry init failed', e) }
      };
      document.body.appendChild(s);
    }catch(e){ /* ignore */ }
  })();

});

// Expose a summary function so other pages (homepage CTA) can consume
window.getD

---

# SOURCE 24: dashboard\analytics.js

ashboardAnalyticsSummary = async function getDashboardAnalyticsSummary(){
  async function safeFetchJson(path){
    try{
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    }catch(e){return null}
  }

  function isFiniteNumber(value){ return typeof value === 'number' && Number.isFinite(value) }

  try{
    const sessionsData = await safeFetchJson('/api/analytics/sessions')
    const studentsData = await safeFetchJson('/api/analytics/students')

    let avgScore = null
    let completionRate = null
    let weakAreas = null

    if (sessionsData && sessionsData.ok){
      if (isFiniteNumber(sessionsData.averageScore)) avgScore = sessionsData.averageScore
      completionRate = sessionsData.completionRate ?? sessionsData.completion ?? null
      weakAreas = sessionsData.weakAreas ?? sessionsData.aseWeaknessesCount ?? null
    }

    if (avgScore == null && studentsData && Array.isArray(studentsData.students)){
      const vals = studentsData.students.map(s=>{
        if (isFiniteNumber(s.averageScore)) return s.averageScore
        if (isFiniteNumber(s.avgScore)) return s.avgScore
        return null
      }).filter(v=>v!=null)
      if (vals.length) avgScore = vals.reduce((a,b)=>a+b,0)/vals.length
    }

    // Top student calculation (if student list available)
    let topStudent = null
    if (studentsData && Array.isArray(studentsData.students) && studentsData.students.length) {
      const best = studentsData.students.reduce((bestSoFar, s) => {
        const val = (isFiniteNumber(s.averageScore) ? s.averageScore : (isFiniteNumber(s.avgScore) ? s.avgScore : -Infinity))
        if (val > (bestSoFar.score ?? -Infinity)) return { name: s.name || s.id || '—', score: Math.round(val) }
        return bestSoFar
      }, null)
      if (best && best.score != null) topStudent = best
      // include id when present
      if (topStudent && !topStudent.id){
        const s = studentsData.students.find(ss=> (ss.name||ss.id) === topStudent.name)
        if (s && s.id) topStudent.id = s.id
      }
    }

    // Ensure numeric rounding for display
    if (avgScore != null) avgScore = Math.round(avgScore)
    if (completionRate != null) completionRate = Math.round(completionRate)

    return { avgScore, completionRate, weakAreas, topStudent }
  }catch(e){ return null }
}

---

# SOURCE 25: dashboard\api-client.js

// Simple fetch wrapper to detect API `x-app-version` mismatches.
// Usage: require('./api-client').initApiClient({ onStale })

function getClientVersion() {
  try {
    return (typeof window !== 'undefined' && (window.APP_VERSION || window.localStorage && window.localStorage.getItem('app_version'))) || null;
  } catch (e) {
    // swallow errors accessing window/localStorage in test envs
    return null;
  }
}

function defaultOnStale(serverVersion, info) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('__version_reload_request', Date.now().toString());
    }
  } catch {
    // Ignore storage errors
  }
}

function initApiClient({ onStale = defaultOnStale, retryOnce = true } = {}) {
  if (typeof window === 'undefined' || !window.fetch) return;
  const originalFetch = window.fetch.bind(window);

  // lazy init version sync (browser-only)
  const { createVersionSync } = require('./version-sync');
  let versionSync = null;

  window.fetch = async function(input, init) {
    const resp = await originalFetch(input, init);
    try {
      const serverVersion = resp && resp.headers && typeof resp.headers.get === 'function' ? resp.headers.get('x-app-version') : null;
      if (!serverVersion) return resp;

      const clientVersion = getClientVersion();
      if (clientVersion && serverVersion !== clientVersion) {
        // ensure version-sync is available and trigger a check after this response
        try {
          if (!versionSync) {
            versionSync = createVersionSync({ url: '/version.json', interval: 30000, onStale });
          }
          // do not trigger a background check here to avoid extra fetch calls
        } catch (e) {
          // ignore version-sync init errors
        }

        // immediate stale notification
        onStale && onStale(serverVersion, { input, init });

        if (retryOnce) {
          // attempt one retry
          const retryResp = await originalFetch(input, init);
          const retryServerVersion = retryResp && retryResp.headers && typeof retryResp.headers.get === 'function' ? retryResp.headers.get('x-app-version') : null;
          if (retryServerVersion && retryServerVersion === clientVersion) {
            return retryResp;
          }
          // still stale -> notify with forceReload hint
          onStale && onStale(serverVersion, { input, init, forceReload: true });
          retur

---

# SOURCE 26: dashboard\api-client.js

n retryResp;
        }
      }
    } catch (e) {
      // ignore header parsing errors
    }
    return resp;
  };
}

module.exports = { initApiClient };

---

# SOURCE 27: dashboard\attempt-adapter.js

/* Adapter that selects Supabase adapter when enabled, otherwise falls back to in-memory attemptStore */
(function(){
  function useSupabase(){
    // feature flag via window.USE_SUPABASE_ATTEMPTS (truthy string '1' or boolean true) or presence of SUPABASE_URL
    if(typeof window === 'undefined') return false;
    if(window.USE_SUPABASE_ATTEMPTS === true || window.USE_SUPABASE_ATTEMPTS === '1') return true;
    if(window.SUPABASE_URL) return true;
    return false;
  }

  function getAdapter(){
    if(useSupabase() && window.attemptSupabase) return window.attemptSupabase;
    if(window.attemptStore) return window.attemptStore;
    // minimal no-op adapter
    return { saveAttempt: ()=>{}, loadAttempt: ()=>null, resetAttempt: ()=>{} };
  }

  function saveAttempt(scenario, attempt){
    const a = getAdapter();
    try{ return a.saveAttempt(scenario, attempt); }catch(e){ /* swallow */ }
  }

  function loadAttempt(scenario){
    const a = getAdapter();
    try{ return a.loadAttempt(scenario); }catch(e){ return null; }
  }

  function resetAttempt(scenario){
    const a = getAdapter();
    try{ return a.resetAttempt && a.resetAttempt(scenario); }catch(e){ /* ignore */ }
  }

  window.attemptAdapter = { saveAttempt, loadAttempt, resetAttempt, _getAdapter: getAdapter };
})();

---

# SOURCE 28: dashboard\attempt-store.js

(function(){
  // Simple in-memory attempt store for current browser session only.
  const store = {};

  function saveAttempt(scenario, data){
    if(!scenario) return;
    store[scenario] = Object.assign({}, data);
    return store[scenario];
  }

  function loadAttempt(scenario){
    if(!scenario) return null;
    return store[scenario] ? Object.assign({}, store[scenario]) : null;
  }

  function resetAttempt(scenario){
    if(scenario){ delete store[scenario]; } else { Object.keys(store).forEach(k=>delete store[k]); }
  }

  function getAll(){ return Object.assign({}, store); }

  window.attemptStore = { saveAttempt, loadAttempt, resetAttempt, getAll };
})();

---

# SOURCE 29: dashboard\attempt-supabase.js

/* Supabase attempt persistence adapter (client-side) - graceful fallback to in-memory store */
/* global supabase */
(function(){
  const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) || window.SUPABASE_URL || null;
  const SUPABASE_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_KEY) || window.SUPABASE_KEY || null;

  // Lazy client creation to allow tests to mock
  let _client = null;
  function getClient(){
    if(_client) return _client;
    if(!SUPABASE_URL || !SUPABASE_KEY) return null;
    // create supabase client if available
    if(typeof supabase !== 'undefined' && supabase.createClient){
      _client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return _client;
    }
    return null;
  }

  async function saveAttemptRemote(scenario, attempt){
    const client = getClient();
    if(!client) return Promise.reject(new Error('Supabase client not configured'));
    // This implementation is a stub for future server integration.
    // Save to `attempts` table: { scenario, data }
    return client.from('attempts').upsert({ scenario, data: attempt });
  }

  async function loadAttemptRemote(scenario){
    const client = getClient();
    if(!client) return Promise.reject(new Error('Supabase client not configured'));
    const { data, error } = await client.from('attempts').select('data').eq('scenario', scenario).limit(1).single();
    if(error) throw error;
    return data ? data.data : null;
  }

  async function saveAttempt(scenario, attempt){
    // try remote first, otherwise fallback to in-memory attemptStore
    try{
      const res = await saveAttemptRemote(scenario, attempt);
      return res;
    }catch(e){
      if(window.attemptStore) return window.attemptStore.saveAttempt(scenario, attempt);
      void e;
      throw e;
    }
  }

  async function loadAttempt(scenario){
    try{
      const res = await loadAttemptRemote(scenario);
      return res;
    }catch(e){
      if(window.attemptStore) return window.attemptStore.loadAttempt(scenario);
      void e;
      return null;
    }
  }

  window.attemptSupabase = { saveAttempt, loadAttempt, _getClient:getClient };
})();

---

# SOURCE 30: lib\telemetry\index.js

// Telemetry facade selects an adapter based on environment/configuration
const inMemory = require('./inMemoryAdapter');
const supabase = require('./supabaseAdapter');

let adapter = inMemory;
// prefer supabase when configured
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  // if supabaseAdapter is available and reports list/save functions, use it
  if (supabase && typeof supabase.listEvents === 'function' && typeof supabase.saveEvent === 'function') {
    adapter = supabase;
  }
}

module.exports = {
  saveEvent: adapter.saveEvent,
  listEvents: adapter.listEvents,
  streamEmitter: adapter.streamEmitter,
  getRecentEvents: adapter.getRecentEvents,
};

---

# SOURCE 31: lib\telemetry\inMemoryAdapter.js

const { telemetryEmitter, addTelemetryEvent, getRecentEvents } = require('../../api/telemetry/events');

async function saveEvent(event = {}) {
  try {
    const ok = addTelemetryEvent(event);
    return ok ? { ok: true, data: event } : { ok: false, error: new Error('invalid_event') };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function listEvents({ sessionId, limit = 50 } = {}) {
  try {
    // in-memory only exposes recent events; filter by sessionId if requested
    const recent = getRecentEvents() || [];
    let data = recent.slice().reverse(); // newest-first
    if (sessionId) data = data.filter(e => (e.session_id || e.session || e.sessionId) == sessionId);
    if (limit && Number.isFinite(limit)) data = data.slice(0, limit);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err, data: [] };
  }
}

module.exports = {
  saveEvent,
  listEvents,
  streamEmitter: telemetryEmitter,
  getRecentEvents,
};

---

# SOURCE 32: lib\telemetry\supabaseAdapter.js

let storage = null;
try {
  storage = require('../../api/telemetry/storage');
} catch (e) {
  storage = null;
}

async function saveEvent(event = {}) {
  if (!storage || typeof storage.saveTelemetryEvent !== 'function') return { ok: false, error: new Error('supabase_not_configured') };
  try {
    const res = await storage.saveTelemetryEvent(event);
    return res;
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function listEvents({ sessionId, limit = 50 } = {}) {
  if (!storage || typeof storage.listTelemetryEvents !== 'function') return { ok: false, error: new Error('supabase_not_configured'), data: [] };
  try {
    const res = await storage.listTelemetryEvents({ sessionId, limit });
    return res;
  } catch (err) {
    return { ok: false, error: err, data: [] };
  }
}

module.exports = {
  saveEvent,
  listEvents,
  streamEmitter: null,
  getRecentEvents: () => []
};

function createAdapter(client, opts = {}) {
  const flushIntervalMs = opts.flushIntervalMs || 1000;
  const flushSize = opts.flushSize || 10;
  const retryBaseMs = opts.retryBaseMs || 100;
  const maxRetries = opts.maxRetries || 3;
  const ingestUrl = opts.ingestUrl;

  let queue = [];
  let timer = null;

  async function doInsert(batch, attempt = 0) {
    try {
      const from = client.from('telemetry_events');
      const res = await from.insert(batch);
      if (res && res.error) {
        if (attempt < maxRetries) {
          setTimeout(() => doInsert(batch, attempt + 1), retryBaseMs * Math.pow(2, attempt));
        }
      }
    } catch (err) {
      if (attempt < maxRetries) {
        setTimeout(() => doInsert(batch, attempt + 1), retryBaseMs * Math.pow(2, attempt));
      }
    }
  }

  function flush() {
    if (!queue.length) return;
    const batch = queue.slice();
    queue = [];
    void doInsert(batch, 0);
  }

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, flushIntervalMs);
  }

  return {
    saveEvent: async (ev) => {
      // If an ingest URL is provided, POST immediately (tests mock global.fetch)
      if (ingestUrl) {
        try {
          if (typeof fetch === 'function') {
            void fetch(ingestUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev) });
          }
        } catch (e) {
          // swallow - best effort ingest

---

# SOURCE 33: lib\telemetry\supabaseAdapter.js

}
      }
      queue.push(ev);
      if (queue.length >= flushSize) {
        setTimeout(() => flush(), 0);
      } else {
        scheduleFlush();
      }
    },
    recordSessionStep: async (row) => {
      const from = client.from('session_history');
      return from.insert(row);
    },
    close: async () => {
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
    }
  };
}

module.exports.createAdapter = createAdapter;

---

# SOURCE 34: lib\worker.js

const crypto = require('crypto');

// Deterministic JSON serializer: sorts object keys recursively and
// serializes Buffers/ArrayBuffers and Dates in a stable way. Use this
// for job/artifact fingerprinting to avoid nondeterminism from
// unordered object key iteration.
function stableStringify(value) {
  const seen = new WeakSet();
  function _serialize(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Buffer.isBuffer(v)) return JSON.stringify({ __type: 'Buffer', data: v.toString('hex') });
    if (v instanceof ArrayBuffer) return JSON.stringify({ __type: 'ArrayBuffer', data: Buffer.from(v).toString('hex') });
    if (v instanceof Date) return JSON.stringify({ __type: 'Date', data: v.toISOString() });
    if (seen.has(v)) return JSON.stringify('[Circular]');
    seen.add(v);
    if (Array.isArray(v)) {
      return '[' + v.map(_serialize).join(',') + ']';
    }
    // plain object: sort keys
    const keys = Object.keys(v).sort();
    const parts = keys.map(k => JSON.stringify(k) + ':' + _serialize(v[k]));
    return '{' + parts.join(',') + '}';
  }
  return _serialize(value);
}

class Job {
  constructor({ id, type, input }) {
    this.id = id || `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
    this.type = type || 'JOB';
    this.input = input || {};
    this.status = 'pending';
    this.startedAt = null;
    this.finishedAt = null;
    this.result = null;
    this.error = null;
  }
}

function _fingerprintJob(job) {
  const payload = stableStringify({ type: job.type, input: job.input });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function _sanitizeJobForCheckpoint(job) {
  try {
    const copy = Object.assign({}, job);
    if (copy && copy.input && typeof copy.input === 'object') {
      copy.input = Object.assign({}, copy.input);
      if (typeof copy.input.token === 'string') copy.input.token = '[REDACTED]';
    }
    return copy;
  } catch (e) {
    return job; // best-effort
  }
}

// Default checkpoint store is pluggable; require it lazily to avoid boot-time issues
let checkpointStore;
try {
  checkpointStore = require('../core/checkpoint');
} catch (e) {
  checkpointStore = null;
}

// in-memory cache fallback when no persistent store available
const seenJobs = new Map();

class InMemoryQueue {
  constructor() {
    this._q = [];
  }
  enqueue(job) {
    this._q.push(job);

---

# SOURCE 35: lib\worker.js

return job;
  }
  dequeue() {
    return this._q.shift();
  }
  isEmpty() { return this._q.length === 0; }
}

async function runJob(job, handlers = {}) {
  if (!job || typeof job !== 'object') throw new Error('job required');
  // compute a deterministic key for idempotency
  const key = job.id || _fingerprintJob(job);
  // augment job with attempt tracking defaults
  job.attempt = Number(job.attempt || 0);
  job.maxAttempts = Number(job.maxAttempts || process.env.WORKER_MAX_ATTEMPTS || 3);

  // If a checkpoint store is available, consult it first for idempotency
  if (checkpointStore) {
    try {
      const finalKey = `job:${key}:final`;
      if (await checkpointStore.has(finalKey)) {
        return await checkpointStore.get(finalKey);
      }
    } catch (e) {
      // fallback to in-memory behavior
    }
  } else {
    // If we've already seen this job in-memory, return the stored job/result
    if (seenJobs.has(key)) return seenJobs.get(key);
  }

  // Retry loop owned by worker
  while (job.attempt < job.maxAttempts) {
    job.attempt += 1;
    job.status = job.attempt === 1 ? 'running' : 'retrying';
    job.startedAt = job.startedAt || new Date().toISOString();
    // store early so concurrent duplicates observe 'running' state and avoid duplicate execution
    seenJobs.set(key, job);
    if (checkpointStore) {
      try { await checkpointStore.set(`job:${key}:attempts`, { attempt: job.attempt, status: job.status, ts: Date.now() }); } catch (e) {}
      try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
    }

    try {
      // handlers.run is expected to be an async function that performs the pipeline
      if (typeof handlers.run !== 'function') throw new Error('handlers.run must be a function');
      // invoke onAttempt hook if provided
      try {
        if (typeof handlers.onAttempt === 'function') {
          // provide lightweight snapshot for observers
          const attemptInfo = { attempt: job.attempt, maxAttempts: job.maxAttempts, status: job.status, ts: Date.now() };
          // allow onAttempt to be sync or async
          await handlers.onAttempt(job, attemptInfo);
        }
      } catch (hookErr) {
        // don't fail job because observer hook failed
        try { console.error('onAttempt hook error', hookErr && hookErr.message); } catch (e) {}
      }
      // pass onEvent context explicitly to the pipeline
      const res

---

# SOURCE 36: lib\worker.js

= await handlers.run(job.input.owner, job.input.repo, job.input.token, { onEvent: typeof handlers.onEvent === 'function' ? handlers.onEvent : undefined, jobId: key });
      job.result = res;
      job.status = 'success';
      job.finishedAt = new Date().toISOString();
      // onFinal hook for success — include aggregated metrics when available
      try {
        if (typeof handlers.onFinal === 'function') {
          const durationMs = job.startedAt ? (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) : undefined;
          const metrics = (job.result && typeof job.result === 'object') ? {
            processedArtifacts: job.result.processedArtifacts || 0,
            skippedArtifacts: job.result.skippedArtifacts || 0,
            skippedReasons: job.result.skippedReasons || {},
            artifactHashes: job.result.artifactHashes || []
          } : undefined;
          const resultInfo = { status: job.status, attempts: job.attempt, finishedAt: job.finishedAt, durationMs, metrics };
          await handlers.onFinal(job, resultInfo);
        }
      } catch (hookErr) {
        try { console.error('onFinal hook error', hookErr && hookErr.message); } catch (e) {}
      }
      // persist final job state
      seenJobs.set(key, job);
      if (checkpointStore) {
        try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
        try { await checkpointStore.set(`job:${key}:final`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
      }
      return job;
    } catch (err) {
      job.error = err && (err.message || String(err));
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      // persist failure snapshot
      seenJobs.set(key, job);
      if (checkpointStore) {
        try { await checkpointStore.set(`job:${key}`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
      }
      // if this is terminal (no more attempts) call onFinal hook with failure
      // decide whether to retry
      if (job.attempt >= job.maxAttempts) {
        try {
          if (typeof handlers.onFinal === 'function') {
            const durationMs = job.startedAt ? (Date.parse(job.finishedAt) - Date.parse(job.startedAt)) : undefined;
            const metrics = (job.result && typeof job.result === 'object') ? {
              processedArtifacts: job.result.processedArtifacts || 0,
              skippedArtifacts: job.result.skippedArtifacts || 0,

---

# SOURCE 37: lib\worker.js

skippedReasons: job.result.skippedReasons || {},
              artifactHashes: job.result.artifactHashes || []
            } : undefined;
            const resultInfo = { status: job.status, attempts: job.attempt, error: job.error, finishedAt: job.finishedAt, durationMs, metrics };
            await handlers.onFinal(job, resultInfo);
          }
        } catch (hookErr) {
          try { console.error('onFinal hook error', hookErr && hookErr.message); } catch (e) {}
        }
        // mark final failure
        if (checkpointStore) {
          try { await checkpointStore.set(`job:${key}:final`, _sanitizeJobForCheckpoint(job)); } catch (e) {}
        }
        return job;
      }
      // backoff before next attempt
      const base = Number(job.retryBaseMs || process.env.WORKER_RETRY_BASE_MS || 1000);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = Math.round(base * Math.pow(2, job.attempt - 1)) + jitter;
      await new Promise(r => setTimeout(r, delay));
      // continue loop to retry
    }
  }
  // if we exit loop unexpectedly, return job (shouldn't normally reach here)
  return job;
}

async function runAll(queue, handlers) {
  const results = [];
  while (!queue.isEmpty()) {
    const job = queue.dequeue();
    // run sequentially for simplicity
    const r = await runJob(job, handlers);
    results.push(r);
  }
  return results;
}

module.exports = { Job, InMemoryQueue, runJob, runAll };

---

# SOURCE 38: services\githubClient.js

let _fetch = null;
function getFetch() {
  if (_fetch) return _fetch;
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    _fetch = globalThis.fetch.bind(globalThis);
    return _fetch;
  }
  try {
    const undici = require('undici');
    if (undici && undici.fetch) {
      _fetch = undici.fetch.bind(undici);
      return _fetch;
    }
  } catch (e) {
    // ignore
  }
  throw new Error('No fetch available; please provide global fetch or install undici');
}

function _normalizeResponse(res) {
  const normalized = Object.create(null);
  normalized.ok = res && Boolean(res.ok);
  normalized.status = res && res.status;
  normalized.headers = res && res.headers;
  normalized.raw = res;
  normalized.json = async () => {
    if (!res) return null;
    if (typeof res.json === 'function') return res.json();
    const t = await (typeof res.text === 'function' ? res.text() : '');
    try { return JSON.parse(t); } catch (e) { return null; }
  };
  normalized.text = async () => {
    if (!res) return '';
    if (typeof res.text === 'function') return res.text();
    if (typeof res.arrayBuffer === 'function') {
      const buf = await res.arrayBuffer();
      return Buffer.from(buf).toString('utf8');
    }
    return '';
  };
  normalized.arrayBuffer = async () => {
    if (!res) return Buffer.from([]).buffer;
    if (typeof res.arrayBuffer === 'function') return res.arrayBuffer();
    if (typeof res.buffer === 'function') {
      const b = await res.buffer();
      return b.buffer ? b.buffer : Buffer.from(b).buffer;
    }
    const txt = await normalized.text();
    return Buffer.from(txt, 'utf8').buffer;
  };
  return normalized;
}

function _parseRetryAfter(header) {
  if (!header) return null;
  const s = String(header).trim();
  const n = Number(s);
  if (!Number.isNaN(n)) return n * 1000;
  const date = Date.parse(s);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options = {}, retryOpts = {}) {
  const fetchImpl = getFetch();
  const envMaxRetries = Number(process && process.env && process.env.GITHUB_MAX_RETRIES);
  const envTimeout = Number(process && process.env && process.env.GITHUB_TIMEOUT_MS);
  const envBackoff = Number(process && process.env && process.env.GITHUB_RETRY_BASE_MS);
  const maxRetries = typeof retryOpts.retries === 'n

---

# SOURCE 39: services\githubClient.js

umber'
    ? retryOpts.retries
    : (!Number.isNaN(envMaxRetries) ? envMaxRetries : 2);
  const timeout = typeof retryOpts.timeout === 'number'
    ? retryOpts.timeout
    : (!Number.isNaN(envTimeout) ? envTimeout : 15000);
  const backoffBase = typeof retryOpts.backoffBase === 'number'
    ? retryOpts.backoffBase
    : (!Number.isNaN(envBackoff) ? envBackoff : 200);
  const onRetry = typeof retryOpts.onRetry === 'function' ? retryOpts.onRetry : undefined;
  const onEvent = typeof retryOpts.onEvent === 'function' ? retryOpts.onEvent : undefined;
  const headers = Object.assign({}, options.headers || {});
  if (!headers.accept) headers.accept = 'application/vnd.github+json';
  if (process && process.env && process.env.GITHUB_TOKEN && !headers.authorization && !headers.Authorization) {
    headers.authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  let attempt = 0;
  // generate a lightweight correlation id for this logical request
  const generateId = () => {
    try {
      if (typeof (globalThis.crypto && globalThis.crypto.randomUUID) === 'function') return globalThis.crypto.randomUUID();
      if (typeof require === 'function') {
        try { const c = require('crypto'); if (typeof c.randomUUID === 'function') return c.randomUUID(); } catch (_) {}
      }
    } catch (_) {}
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xfffffff).toString(36)}`;
  };
  const requestId = generateId();
  if (onEvent) {
    try { onEvent({ type: 'request.start', id: requestId, url, options }); } catch (_) {}
  }
  let lastErr = null;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = typeof globalThis.AbortController === 'function' ? new globalThis.AbortController() : null;
    const sig = controller ? controller.signal : undefined;
    let timer = null;
    try {
      if (controller) timer = setTimeout(() => controller.abort(), timeout);
      // attach correlation id header if not present
      if (headers && !headers['x-request-id'] && !headers['X-Request-Id']) {
        headers['x-request-id'] = requestId;
      }
      const res = await fetchImpl(url, Object.assign({}, options, { headers, signal: sig }));
      if (timer) clearTimeout(timer);
      // If status is rate limited or server error, consider retry
      const status = res && res.status ? res.status : 0;
      if ((status === 429 || (status >= 500 && status < 600)) && attempt <= maxRetries) {
        cons

---

# SOURCE 40: services\githubClient.js

t ra = _parseRetryAfter(res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : res.headers && res.headers['retry-after']);
        const delay = ra !== null ? ra : Math.min(10000, backoffBase * Math.pow(2, attempt - 1));
        if (onRetry) {
          try { onRetry({ attempt, url, reason: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, id: requestId }); } catch (_) {}
        }
        if (onEvent) {
          try { onEvent({ type: 'request.retry', id: requestId, attempt, url, reason: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, delay }); } catch (_) {}
        }
        
        await _sleep(delay + Math.floor(Math.random() * 50));
        lastErr = { type: status === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR', status, retryAfter: ra, message: `Retrying on status ${status}` };
        continue;
      }
      return _normalizeResponse(res);
    } catch (err) {
      if (timer) clearTimeout(timer);
      // AbortError or network error
      const isAbort = err && err.name === 'AbortError';
      if (isAbort && attempt > maxRetries) {
        const e = { type: 'TIMEOUT', message: 'Request timed out', original: err };
        if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt, error: e }); } catch (_) {} }
        throw e;
      }
      if (attempt <= maxRetries) {
        const delay = Math.min(10000, backoffBase * Math.pow(2, attempt - 1));
        if (onRetry) {
          try { onRetry({ attempt, url, reason: isAbort ? 'ABORT' : 'NETWORK', message: err && err.message, id: requestId }); } catch (_) {}
        }
        if (onEvent) {
          try { onEvent({ type: 'request.retry', id: requestId, attempt, url, reason: isAbort ? 'ABORT' : 'NETWORK', message: err && err.message, delay }); } catch (_) {}
        }
        
        await _sleep(delay + Math.floor(Math.random() * 50));
        lastErr = { type: isAbort ? 'TIMEOUT' : 'NETWORK', message: err && err.message, original: err };
        continue;
      }
      if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt, error: err }); } catch (_) {} }
      throw { type: 'NETWORK', message: err && err.message, original: err };
    }
  }
  // If we exit loop, throw lastErr or generic
  if (onEvent) { try { onEvent({ type: 'request.failure', id: requestId, url, attempt: maxRetries + 1, error: lastErr || { type: 'NETWORK', message: 'fetc
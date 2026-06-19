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

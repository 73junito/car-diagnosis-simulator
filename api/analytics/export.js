const fs = require('fs');
const path = require('path');

function availableExports() {
  const exports = [];

  const files = [
    {
      format: 'csv',
      name: 'student-performance.csv',
      path: path.resolve('reports', 'student-performance.csv')
    },
    {
      format: 'json',
      name: 'student-performance-report.json',
      path: path.resolve('reports', 'student-performance-report.json')
    },
    {
      format: 'xapi',
      name: 'xapi-statements.json',
      path: path.resolve('reports', 'xapi-statements.json')
    },
    {
      format: 'validation',
      name: 'scenario-validation-report.json',
      path: path.resolve('reports', 'scenario-validation-report.json')
    }
  ];

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      exports.push(file);
    }
  }

  return exports;
}

function fallbackContent(format) {
  switch (format) {
    case 'csv':
      return 'studentId,totalEvents,sessions\n';

    case 'json':
    case 'xapi':
      return JSON.stringify(
        {
          ok: true,
          generated: new Date().toISOString(),
          rows: []
        },
        null,
        2
      );

    default:
      return null;
  }
}

function getExportContent(format = 'csv') {
  format = String(format).toLowerCase();

  // Only supported formats
  const supported = ['csv', 'json', 'xapi'];

  if (!supported.includes(format)) {
    return null;
  }

  const files = availableExports();

  const match = files.find((file) => {
    if (format === 'csv') return file.format === 'csv';
    if (format === 'json') return file.format === 'json';
    if (format === 'xapi') return file.format === 'xapi';
    return false;
  });

  if (match) {
    return {
      format,
      content: fs.readFileSync(match.path, 'utf8')
    };
  }

  return {
    format,
    content: fallbackContent(format)
  };
}

function registerExportRoutes(app) {
  app.get('/api/analytics/export', (req, res) => {
    const format = (req.query.format || 'csv').toLowerCase();

    const result = getExportContent(format);

    if (!result) {
      return res.status(404).json({
        ok: false,
        message: 'export not found'
      });
    }

    if (format === 'csv') {
      res.type('text/csv');
      return res.status(200).send(result.content);
    }

    res.type('application/json');

    try {
      return res.status(200).json(JSON.parse(result.content));
    } catch {
      return res.status(200).send(result.content);
    }
  });
}

module.exports = {
  registerExportRoutes,
  availableExports,
  getExportContent
};
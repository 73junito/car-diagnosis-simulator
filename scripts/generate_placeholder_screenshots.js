const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'docs', 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 1x1 transparent PNG base64
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
const buf = Buffer.from(pngBase64, 'base64');

const files = [
  'analytics-dashboard-overview.png',
  'analytics-student-table.png',
  'analytics-export-buttons.png'
];

files.forEach(f => {
  const p = path.join(outDir, f);
  fs.writeFileSync(p, buf);
  console.log('Wrote', p);
});

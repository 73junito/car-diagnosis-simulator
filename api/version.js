const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    const raw = fs.readFileSync(versionPath, 'utf8');

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).send(raw);
  } catch (err) {
    return res.status(500).json({
      error: 'version_unavailable',
      message: err.message
    });
  }
};

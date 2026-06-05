// Compatibility shim for ESLint v9+/v10 when repository uses legacy .eslintrc.* files
// Prefer using the official FlatCompat transformer from @eslint/eslintrc when available.
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname);
const rcPath = path.join(root, '.eslintrc.json');

// If @eslint/eslintrc is installed, use FlatCompat to convert legacy config.
try {
  const { FlatCompat } = require('@eslint/eslintrc');
  if (fs.existsSync(rcPath)) {
    const compat = new FlatCompat({ baseDirectory: root });
    // require the legacy config and convert to flat config
    const legacy = require(rcPath);
    module.exports = compat.extendFlatConfig(legacy);
  } else {
    module.exports = [];
  }
} catch (e) {
  // Fallback minimal flat config if @eslint/eslintrc isn't available.
  let legacy = {};
  try {
    if (fs.existsSync(rcPath)) {
      legacy = require(rcPath);
    }
  } catch (er) {
    legacy = {};
  }

  module.exports = [
    {
      files: ['**/*.js'],
      languageOptions: {
        ecmaVersion: (legacy.parserOptions && legacy.parserOptions.ecmaVersion) || 2021,
        sourceType: (legacy.parserOptions && legacy.parserOptions.sourceType) || 'module'
      },
      rules: legacy.rules || {},
      settings: legacy.settings || {}
    },
    {
      files: ['**/*.test.js', 'tests/**', '**/__tests__/**'],
      languageOptions: {
        globals: { jest: true }
      }
    }
  ];
}

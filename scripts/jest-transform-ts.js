/**
 * Jest transform for TypeScript solver sources.
 *
 * Uses esbuild, which is already a development dependency, so no additional
 * toolchain is introduced. This transpiles the solver sources for the test
 * runner only; it produces no browser artifact. The browser bundle is produced
 * separately by scripts/build-simulation.js.
 */
'use strict';

const crypto = require('crypto');
const esbuild = require('esbuild');

module.exports = {
  process(sourceText, sourcePath) {
    const result = esbuild.transformSync(sourceText, {
      loader: 'ts',
      format: 'cjs',
      target: 'node22',
      sourcefile: sourcePath,
      sourcemap: false
    });
    return { code: result.code };
  },
  // The key must depend on the source text, otherwise a cached transform from an
  // earlier revision would be reused and edits would appear to have no effect.
  getCacheKey(sourceText, sourcePath, configString) {
    return crypto
      .createHash('md5')
      .update('esbuild-typescript-transform-v2')
      .update(sourceText)
      .update(sourcePath)
      .update(typeof configString === 'string' ? configString : JSON.stringify(configString ?? ''))
      .digest('hex');
  }
};

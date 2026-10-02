const { resolveVersion } = require('../scripts/write-version');

describe('write-version commit source', () => {
  test('uses Cloudflare Workers CI commit SHA when GitHub SHA is absent', () => {
    expect(
      resolveVersion({
        WORKERS_CI_COMMIT_SHA: 'cf-commit',
        GIT_COMMIT: 'git-commit',
        APP_VERSION: 'app-version'
      })
    ).toBe('cf-commit');
  });

  test('preserves source priority and dev fallback', () => {
    expect(
      resolveVersion({
        GITHUB_SHA: 'github-commit',
        WORKERS_CI_COMMIT_SHA: 'cf-commit',
        GIT_COMMIT: 'git-commit',
        APP_VERSION: 'app-version'
      })
    ).toBe('github-commit');

    expect(resolveVersion({ GIT_COMMIT: 'git-commit', APP_VERSION: 'app-version' })).toBe(
      'git-commit'
    );
    expect(resolveVersion({ APP_VERSION: 'app-version' })).toBe('app-version');
    expect(resolveVersion({})).toBe('dev');
  });
});

function setAppVersionHeader(res) {
  const version =
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.APP_VERSION ||
    'dev';

  try {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('x-app-version', version);
    }
  } catch (e) {
    // swallow — header setting should not break handlers
  }
}

module.exports = { setAppVersionHeader };

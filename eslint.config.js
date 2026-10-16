export default [
  {
    ignores: [
      ".github/",
      "node_modules/",
      "test-results/",
      "playwright-report/",
      "review-dist/",
      ".wrangler/",
      // Third-party MIT-licensed Three.js 0.186.1 source, kept byte-for-byte upstream.
      "animation/cadquery/review/vendor/three/**"
    ]
  }
];

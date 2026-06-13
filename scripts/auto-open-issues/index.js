const github = require('../../services/githubClient');
const artifactParser = require('../../core/diagnosis/artifactParser');
const ruleEngine = require('../../core/diagnosis/ruleEngine');
const inference = require('../../core/diagnosis/inference');
const graphModel = require('../../core/diagnosis/graphModel');

/**
 * Orchestrator: pure pipeline coordinator.
 * Options may include owner, repo, issueNumber, and inference context (flapCount, runsSinceClose)
 */
async function run(options = {}) {
  const owner = options.owner;
  const repo = options.repo;
  const issueNumber = options.issueNumber;

  // 1. fetch artifacts (service boundary)
  const artifacts = await github.listArtifacts({ owner, repo });

  const results = [];

  for (const art of artifacts || []) {
    try {
      // 2. download artifact zip (service boundary)
      const zipBuf = await github.downloadArtifactZip(art.id, { owner, repo });

      // 3. parse artifact (ingestion layer)
      const parsed = await artifactParser.parseArtifact(zipBuf, { runId: art.runId, repo: `${owner}/${repo}` });

      // 4. normalize findings & detect signals (rule engine)
      const findings = ruleEngine.normalizeFindings(parsed);
      const signals = ruleEngine.detectRegressionSignals(findings, graphModel);

      // 5. evaluate decision (inference layer)
      const decision = inference.evaluateSignals(signals, Object.assign({}, options.context || {}, { flapCount: art.flap_count || 0 }));

      // 6. side effects (only here)
      if (decision && decision.shouldReopen && issueNumber) {
        const commentBody = options.commentBody || `Automated reopen: score=${decision.score}`;
        await github.postComment(owner, repo, issueNumber, commentBody);
        await github.patchIssue(owner, repo, issueNumber, { state: 'open', body: options.patchBody || '' });
      }

      results.push({ artifact: art, parsedCount: parsed.tests.length, findingsCount: findings.length, signalsCount: signals.length, decision });
    } catch (err) {
      results.push({ artifact: art, error: String(err) });
    }
  }

  return results;
}

module.exports = { run };

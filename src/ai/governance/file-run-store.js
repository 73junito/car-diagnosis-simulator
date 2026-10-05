'use strict';

const fs = require('fs');
const path = require('path');

class FileRunStore {
  constructor({ directory }) {
    if (!directory || typeof directory !== 'string') {
      throw new Error('FileRunStore requires a directory');
    }

    this.directory = path.resolve(directory);
    fs.mkdirSync(this.directory, { recursive: true });
    this.ledgerPath = path.join(this.directory, 'run-ledger.jsonl');
    this.checkpointDirectory = path.join(this.directory, 'checkpoints');
    fs.mkdirSync(this.checkpointDirectory, { recursive: true });
  }

  loadEntries() {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }

    return fs
      .readFileSync(this.ledgerPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  appendEntry(entry) {
    fs.appendFileSync(this.ledgerPath, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  readCheckpoint(runId) {
    const checkpointPath = this.getCheckpointPath(runId);
    if (!fs.existsSync(checkpointPath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  }

  writeCheckpoint(runId, checkpoint) {
    const checkpointPath = this.getCheckpointPath(runId);
    const tempPath = checkpointPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(checkpoint, null, 2) + '\n', 'utf8');
    fs.renameSync(tempPath, checkpointPath);
    return checkpoint;
  }

  getCheckpointPath(runId) {
    const safeRunId = String(runId).replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.checkpointDirectory, safeRunId + '.json');
  }
}

module.exports = FileRunStore;

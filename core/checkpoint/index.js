const FileCheckpointStore = require('./fileStore');
const { createMemoryStore } = require('./store');

// Export a default pluggable store. By default use a file-backed store but allow
// consumers to require and create their own stores if they prefer.
function defaultStore() {
  try {
    return new FileCheckpointStore('.checkpoints/checkpoints.json');
  } catch (e) {
    return createMemoryStore();
  }
}

module.exports = defaultStore();

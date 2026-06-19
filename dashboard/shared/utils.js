function qs(selector, root = document) {
  return root.querySelector(selector);
}
function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}
function safeJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}
module.exports = { qs, qsa, safeJson };

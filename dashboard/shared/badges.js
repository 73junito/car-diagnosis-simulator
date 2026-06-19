function badge(label, type = "default") {
  return `<span class="badge badge-${type}">${String(label)}</span>`;
}
module.exports = { badge };

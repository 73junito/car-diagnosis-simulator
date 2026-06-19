function ensureReportHeading(report, purpose = "report") {
  const safePurpose = String(purpose || "report").replace(/_/g, " ");

  const title =
    purpose === "architecture"
      ? "# Architecture Report"
      : `# ${safePurpose.charAt(0).toUpperCase()}${safePurpose.slice(1)} Report`;

  const body = String(report || "").trim();

  if (!body) {
    return `${title}\n\nNo response generated.`;
  }

  if (body.startsWith("# ")) {
    return body;
  }

  return `${title}\n\n${body}`;
}

module.exports = {
  ensureReportHeading
};

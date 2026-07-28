const fs = require("fs");
const path = require("path");

describe("recoverable UI error logging", () => {
  test("student scenario treats optional AI feedback failure as recoverable", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../dashboard/student/scenario/scenario.js"
      ),
      "utf8"
    );

    expect(source).toContain("AI feedback unavailable:");
    expect(source).toContain(
      "AI explanation is currently unavailable."
    );

    expect(source).not.toMatch(
      /console\.error\(err\);\s*aiBody\.innerHTML/
    );
  });

  test("analytics treats unavailable ASE readiness data as recoverable", () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../dashboard/instructor/analytics.js"
      ),
      "utf8"
    );

    expect(source).toContain("ASE readiness data unavailable:");
    expect(source).not.toContain(
      'console.error("ASE readiness load failed", err);'
    );
  });
});

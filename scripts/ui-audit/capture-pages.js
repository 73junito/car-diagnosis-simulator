const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const baseUrl =
  process.env.UI_AUDIT_BASE_URL ||
  "https://car-diagnosis-simulator.vercel.app";

const outputDirectory =
  process.env.UI_AUDIT_OUTPUT ||
  path.resolve("reports/ui-audit/before");

const routes = JSON.parse(
  fs.readFileSync(path.resolve("scripts/ui-audit/urls.json"), "utf8")
);

(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });

  const report = [];

  for (const route of routes) {
    const url = new URL(route.url, baseUrl).toString();
    const consoleErrors = [];
    const pageErrors = [];

    const onConsole = (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    };

    const onPageError = (error) => {
      pageErrors.push(error.message);
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);

    let status = null;
    let title = "";
    let finalUrl = url;
    let error = null;

    try {
      const response = await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000
      });

      status = response ? response.status() : null;
      title = await page.title();
      finalUrl = page.url();

      await page.screenshot({
        path: path.join(outputDirectory, `${route.name}.png`),
        fullPage: true
      });
    } catch (navigationError) {
      error = navigationError.message;
    }

    report.push({
      name: route.name,
      requestedUrl: url,
      finalUrl,
      status,
      title,
      consoleErrors,
      pageErrors,
      error
    });

    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }

  fs.writeFileSync(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2)
  );

  await browser.close();

  console.table(
    report.map((item) => ({
      name: item.name,
      status: item.status,
      errors: item.consoleErrors.length + item.pageErrors.length,
      finalUrl: item.finalUrl
    }))
  );
})();

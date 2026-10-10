const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "curriculum", "course-catalog.json"), "utf8")
);
const courses = catalog.courses;
const examBase = "http://127.0.0.1:3012";
const apiUrl = "https://app.autolearnpro.com/api/curriculum";

test.describe("academic course catalog", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(apiUrl, (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: "1.0.0", catalogCourses: courses })
    }));
  });

  test("catalog renders all 68 unique courses from the API", async ({ page }) => {
    await page.goto(examBase + "/catalog/");
    await expect(page.locator("html")).toHaveAttribute("data-catalog-status", "loaded");
    await expect(page.locator("html")).toHaveAttribute("data-catalog-source", "api");
    await expect(page.locator(".catalog-course-card")).toHaveCount(68);
    await expect(page.locator("[data-catalog-count]")).toContainText("68 courses shown");
  });

  test("every generated course URL renders its matching catalog record", async ({ page }) => {
    test.setTimeout(120000);
    for (const course of courses) {
      const response = await page.goto(examBase + course.url, { waitUntil: "domcontentloaded" });
      expect(response && response.status(), course.code + " HTTP status").toBe(200);
      await expect(page.locator("html")).toHaveAttribute("data-course-catalog-record", course.id);
      await expect(page.locator(".catalog-detail-card h1")).toHaveText(course.title);
      await expect(page.locator(".catalog-course-code")).toHaveText(course.code);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", course.canonicalUrl);
    }
  });

  test("falls back to static catalog when the API fails", async ({ page }) => {
    await page.unroute(apiUrl);
    await page.route(apiUrl, (route) => route.fulfill({ status: 503, body: "unavailable" }));
    await page.goto(examBase + "/catalog/");
    await expect(page.locator("html")).toHaveAttribute("data-catalog-source", "static");
    await expect(page.locator(".catalog-course-card")).toHaveCount(68);
  });

  test("built course pages are linked while AUT 250/330 crosswalk remains correct", async ({ page }) => {
    await page.goto(examBase + "/catalog/course/?course=AUT-101");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Introduction to Automotive Technology");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-101/");

    await page.goto(examBase + "/catalog/course/?course=AUT-130");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Engine Systems I");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-130/");

    await page.goto(examBase + "/catalog/course/?course=AUT-250");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Diagnostics I");
    await expect(page.locator(".catalog-training-link")).toHaveCount(0);

    await page.goto(examBase + "/catalog/course/?course=AUT-330");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Electric Vehicle Technology");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-250/");
  });
});

const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "data", "curriculum", "course-catalog.json"), "utf8")
);
const courses = catalog.courses;
const examBase = "http://127.0.0.1:3012";

test.describe("academic course catalog", () => {
  test("catalog renders all 68 unique courses", async ({ page }) => {
    await page.goto(examBase + "/catalog/");
    await expect(page.locator("html")).toHaveAttribute("data-catalog-status", "loaded");
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

  test("AUT 250 resolves to Diagnostics I and EV training is crosswalked from AUT 330", async ({ page }) => {
    await page.goto(examBase + "/catalog/course/?course=AUT-250");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Diagnostics I");
    await expect(page.locator(".catalog-training-link")).toHaveCount(0);

    await page.goto(examBase + "/catalog/course/?course=AUT-330");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Electric Vehicle Technology");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-250/");
  });
});

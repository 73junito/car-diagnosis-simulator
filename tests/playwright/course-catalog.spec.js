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

    await page.goto(examBase + "/catalog/course/?course=AUT-120");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Electrical Systems I");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-120/");

    await page.goto(examBase + "/catalog/course/?course=AUT-121");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Electrical Systems I Laboratory");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-121/");

    await page.goto(examBase + "/catalog/course/?course=AUT-170");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive HVAC Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-170/");

    await page.goto(examBase + "/catalog/course/?course=AUT-130");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Engine Systems I");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-130/");

    await page.goto(examBase + "/catalog/course/?course=AUT-200");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Engine Systems II");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-200/");

    await page.goto(examBase + "/catalog/course/?course=AUT-150");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Steering, Suspension, and Wheel Alignment");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-150/");

    await page.goto(examBase + "/catalog/course/?course=AUT-210");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Engine Performance and Fuel Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-210/");

    await page.goto(examBase + "/catalog/course/?course=AUT-525");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Experimental Methods in Automotive Technology");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-525/");

    await page.goto(examBase + "/catalog/course/?course=AUT-230");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Electronics");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-230/");

    await page.goto(examBase + "/catalog/course/?course=AUT-240");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Electrical Systems II");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-240/");

    await page.goto(examBase + "/catalog/course/?course=AUT-501");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Advanced Automotive Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-501/");

    await page.goto(examBase + "/catalog/course/?course=AUT-520");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Advanced Vehicle Data Analytics");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-520/");

    await page.goto(examBase + "/catalog/course/?course=AUT-535");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Advanced Battery Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-535/");

    await page.goto(examBase + "/catalog/course/?course=AUT-545");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Advanced Vehicle Energy Management");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-545/");

    await page.goto(examBase + "/catalog/course/?course=AUT-211");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Engine Performance Laboratory");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-211/");

    await page.goto(examBase + "/catalog/course/?course=AUT-250");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Diagnostics I");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-250-diagnostics/");

    await page.goto(examBase + "/catalog/course/?course=AUT-260");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Vehicle Dynamics");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-260/");

    await page.goto(examBase + "/catalog/course/?course=AUT-270");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Emissions and Environmental Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-270/");

    await page.goto(examBase + "/catalog/course/?course=AUT-251");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Diagnostics I Laboratory");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-251/");

    await page.goto(examBase + "/catalog/course/?course=AUT-280");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Automotive Control Systems");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-280/");

    await page.goto(examBase + "/catalog/course/?course=AUT-300");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Advanced Automotive Diagnostics");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-300/");

    await page.goto(examBase + "/catalog/course/?course=AUT-310");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Vehicle Network Communications");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-310/");

    await page.goto(examBase + "/catalog/course/?course=AUT-320");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Hybrid Vehicle Technology");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-320/");

    await page.goto(examBase + "/catalog/course/?course=AUT-330");
    await expect(page.locator(".catalog-detail-card h1")).toHaveText("Electric Vehicle Technology");
    await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
    await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", "/courses/aut-330/");

    for (const [code, title, href] of [
      ["AUT-301", "Advanced Automotive Diagnostics Laboratory", "/courses/aut-301/"],
      ["AUT-321", "Hybrid Vehicle Laboratory", "/courses/aut-321/"],
      ["AUT-331", "Electric Vehicle Laboratory", "/courses/aut-331/"],
      ["AUT-340", "Battery Systems and Battery Management", "/courses/aut-340/"],
      ["AUT-350", "Advanced Driver Assistance Systems", "/courses/aut-350/"],
      ["AUT-360", "Automotive Data Acquisition and Analysis", "/courses/aut-360/"],
      ["AUT-370", "Automotive Embedded Systems", "/courses/aut-370/"],
      ["AUT-380", "Automotive Cybersecurity", "/courses/aut-380/"],
      ["AUT-390", "Connected and Software-Defined Vehicles", "/courses/aut-390/"],
      ["AUT-410", "Automotive Systems Integration", "/courses/aut-410/"]
    ]) {
      await page.goto(examBase + "/catalog/course/?course=" + code);
      await expect(page.locator(".catalog-detail-card h1")).toHaveText(title);
      await expect(page.locator(".catalog-training-link strong")).toHaveText("Dedicated instructional course page available");
      await expect(page.locator(".catalog-training-link a")).toHaveAttribute("href", href);
    }
  });
});

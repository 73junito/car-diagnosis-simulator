const { test, expect } = require("@playwright/test");

const base = "http://127.0.0.1:3012";
const pages = [
  ["/", "Exam home"],
  ["/catalog/", "Course catalog"],
  ["/catalog/course/?course=AUT-101", "Course catalog"],
  ["/learning-path/", "Academic pathways"],
  ["/lesson-plans/", "Lesson plans"],
  ["/program-architecture/", "Program architecture"],
  ["/curriculum-standards/", "Curriculum standards"],
  ["/exam/", "Exam preview"]
];

test.describe("shared exam sidebar navigation", () => {
  for (const [path, activeLabel] of pages) {
    test(path + " uses the shared left sidebar", async ({ page }) => {
      await page.goto(base + path);
      await expect(page.locator("body")).toHaveClass(/has-exam-sidebar/);
      await expect(page.locator(".exam-sidebar")).toBeVisible();
      await expect(page.locator(".exam-sidebar nav a")).toHaveCount(8);
      await expect(page.locator('.exam-sidebar a[aria-current="page"]')).toHaveText(activeLabel);
      await expect(page.locator('.site-header nav[aria-label="Primary"]')).toBeHidden();
      const footerLinks = page.locator("footer .footer-links");
      if (await footerLinks.count()) await expect(footerLinks).toBeHidden();

      const sidebarBox = await page.locator(".exam-sidebar").boundingBox();
      const mainBox = await page.locator("main#main").boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      expect(mainBox.x).toBeGreaterThan(sidebarBox.x + sidebarBox.width - 2);
    });
  }

  test("sidebar contains the authoritative navigation destinations", async ({ page }) => {
    await page.goto(base + "/catalog/");
    const hrefs = await page.locator(".exam-sidebar nav a").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    );
    expect(hrefs).toEqual([
      "/", "/catalog/", "/learning-path/", "/lesson-plans/",
      "/program-architecture/", "/curriculum-standards/", "/exam/",
      "https://app.autolearnpro.com/"
    ]);
  });
});

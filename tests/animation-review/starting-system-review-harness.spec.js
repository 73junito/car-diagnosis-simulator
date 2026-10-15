const { test, expect } = require('@playwright/test')

test.describe('Starting System animation review harness', () => {
  test('loads the review-only GLB and exposes all four named clips', async ({ page }) => {
    await page.goto('/animation/review-harness/starting-system.html')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reviewHarnessReady)).toBe('true')

    await expect(page.locator('[data-review-governance]')).toContainText('Publication: denied')
    await expect(page.locator('[data-review-clip-count]')).toHaveText('4')
    await expect(page.locator('[data-review-publication]')).toHaveText('false')
    await expect(page.locator('[data-review-assessment]')).toHaveText('false')
    await expect(page.locator('[data-review-runtime-clips]')).toContainText('identify-current-path')
    await expect(page.locator('[data-review-runtime-clips]')).toContainText('interpret-with-evidence')
  })

  test('navigates manifest steps and plays only the selected named clip', async ({ page }) => {
    await page.goto('/animation/review-harness/starting-system.html')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reviewHarnessReady)).toBe('true')

    const status = page.locator('[role="status"]')
    await expect(page.locator('.tm-animation-player__step strong')).toContainText('Identify the crank-current path')

    await page.locator('[data-animation-action="next-step"]').click()
    await expect(page.locator('.tm-animation-player__step strong')).toContainText('Identify the start-control path')
    await expect(status).toContainText('Step 2 of 4')

    await page.locator('[data-animation-action="play"]').click()
    await expect(status).toContainText('Playing step 2 of 4')

    await page.locator('[data-animation-action="pause"]').click()
    await expect(status).toHaveText('Paused')
  })
})

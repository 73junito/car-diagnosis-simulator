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

    const status = page.locator('.tm-animation-player [role="status"]')
    await expect(page.locator('.tm-animation-player__step strong')).toContainText('Identify the crank-current path')

    await page.locator('[data-animation-action="next-step"]').click()
    await expect(page.locator('.tm-animation-player__step strong')).toContainText('Identify the start-control path')
    await expect(status).toContainText('Step 2 of 4')

    await page.locator('[data-animation-action="play"]').click()
    await expect(status).toContainText('Playing step 2 of 4')

    await page.locator('[data-animation-action="pause"]').click()
    await expect(status).toHaveText('Paused')
  })

  test('generates a human technical review record without changing publication or final approval state', async ({ page }) => {
    await page.goto('/animation/review-harness/starting-system.html')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reviewHarnessReady)).toBe('true')

    await page.locator('[data-human-review-name]').fill('Review Test User')
    const criteria = page.locator('[data-review-criterion]')
    await expect(criteria).toHaveCount(4)
    for (let index = 0; index < 4; index += 1) {
      await criteria.nth(index).locator('input[value="pass"]').check()
    }

    await page.locator('[data-human-review-generate]').click()
    const reviewStatus = page.locator('[data-human-review-status]')
    await expect(reviewStatus).toHaveAttribute('data-review-decision', 'pass')
    await expect(reviewStatus).toContainText('no publication, assessment, or final-approval effect')

    const record = JSON.parse(await page.locator('[data-human-review-output]').textContent())
    expect(record.reviewRole).toBe('technical-reviewer')
    expect(record.reviewerName).toBe('Review Test User')
    expect(record.overallDecision).toBe('pass')
    expect(record.governance.publicationEffect).toBe('none')
    expect(record.governance.assessmentEffect).toBe('none')
    expect(record.governance.finalApprovalEffect).toBe('none')
    expect(record.governance.agentMayApprove).toBe(false)
    expect(record.governance.agentMayRelease).toBe(false)
  })

  test('requires every human criterion and does not synthesize a decision', async ({ page }) => {
    await page.goto('/animation/review-harness/starting-system.html')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reviewHarnessReady)).toBe('true')

    await page.locator('[data-human-review-name]').fill('Review Test User')
    await page.locator('[data-human-review-generate]').click()
    await expect(page.locator('[data-human-review-status]')).toContainText('Complete every review criterion')
    await expect(page.locator('[data-human-review-output]')).toBeHidden()
  })
})

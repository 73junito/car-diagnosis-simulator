const { test, expect } = require('@playwright/test')

test.use({ baseURL: 'http://127.0.0.1:3003' })

test.describe('ANIM-2A Starting System governed animation integration', () => {
  test('mounts fail-closed and preserves the 2D fallback until publication approval', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/dashboard/student/starting-system-lab/')

    const player = page.locator('#startingAnimationPlayer')
    await expect(player).toHaveAttribute('data-animation-publication-state', 'fail-closed')
    await expect(player).toHaveAttribute('data-animation-source-of-truth', '/data/architecture/student-lab-animation-source-of-truth.json')
    await expect(player.getByRole('status')).toContainText(/Unavailable/i)
    await expect(player).toContainText(/not approved for publication/i)

    const fallback = page.locator('#startingLegacyVisualization')
    await expect(fallback).toBeVisible()
    await expect(fallback).toHaveAttribute('data-animation-fallback-role', 'transitional-static-and-2d-fallback')
    await expect(page.locator('#circuitSvg')).toBeVisible()
    expect(errors).toEqual([])
  })
})

const { test, expect } = require('@playwright/test')

test.use({ baseURL: 'http://127.0.0.1:3003' })

test.describe('Circuit Lab 3D Equipment Bay', () => {
  test('loads runtime-enabled DMM and current clamp from real GLB assets', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/dashboard/student/circuit-lab/')
    await expect(page.locator('html')).toHaveAttribute('data-circuit-lab-3d', 'presentation-only')

    await expect(page.locator('[data-asset-id="equipment.dmm"]')).toHaveAttribute('data-enabled', 'true')
    await expect(page.locator('[data-asset-id="equipment.current-clamp"]')).toHaveAttribute('data-enabled', 'true')
    await expect(page.locator('#lab3dStatus')).toContainText('Digital Multimeter loaded')

    await page.locator('[data-asset-id="equipment.current-clamp"] button').click()
    await expect(page.locator('#lab3dModelTitle')).toHaveText('Current Clamp')
    await expect(page.locator('#lab3dStatus')).toContainText('Current Clamp loaded')
    await expect(page.locator('#lab3dModelRole')).toContainText('declared by the Circuit Lab runtime')
    expect(errors).toEqual([])
  })

  test('oscilloscope asset fails closed because tool.oscilloscope is not declared', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/')

    const oscilloscope = page.locator('[data-asset-id="equipment.oscilloscope"]')
    await expect(oscilloscope).toHaveAttribute('data-enabled', 'false')
    await expect(oscilloscope.getByRole('button')).toBeDisabled()
    await expect(oscilloscope).toContainText('Not enabled in this lab')
  })

  test('visual scene models remain explicitly presentation only', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/')

    const battery = page.locator('[data-asset-id="scene.battery"]')
    await expect(battery).toContainText('Presentation-only scene asset')
    await battery.getByRole('button').click()
    await expect(page.locator('#lab3dModelTitle')).toHaveText('12 V Battery')
    await expect(page.locator('#lab3dModelRole')).toContainText('does not create measurements, faults, or engineering state')
  })

  test('viewer is keyboard operable and contained on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard/student/circuit-lab/')

    const canvas = page.locator('#lab3dCanvas')
    await canvas.focus()
    await expect(canvas).toBeFocused()
    await canvas.press('ArrowRight')
    await canvas.press('+')

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      canvasWidth: document.querySelector('#lab3dCanvas').getBoundingClientRect().width
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1)
    expect(dimensions.canvasWidth).toBeLessThanOrEqual(dimensions.viewport)
  })
})

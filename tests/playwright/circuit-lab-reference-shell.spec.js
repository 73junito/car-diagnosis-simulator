const { test, expect } = require('@playwright/test')

test.use({ baseURL: 'http://127.0.0.1:3003' })

test.describe('Circuit Lab reference shell', () => {
  test('renders contract-driven capability and model-status regions', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/')

    await expect(page.getByRole('heading', { name: 'Available in this lab' })).toBeVisible()
    await expect(page.locator('#labToolList')).toContainText('Dmm')
    await expect(page.locator('#labToolList')).toContainText('Current Clamp')
    await expect(page.locator('#labMeasurementList')).toContainText('Voltage Drop')
    await expect(page.locator('#labFaultList')).toContainText('High Resistance')
    await expect(page.locator('#labModelStatus')).toContainText('Electrical Circuit')
    await expect(page.locator('#labModelStatus')).toContainText('External Governance Only')
    await expect(page.locator('#labModelStatus')).toContainText('External Human Governance Only')
  })

  test('keeps the existing engineering work area functional after presentation restructuring', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/')

    await page.locator('#faultSelect').selectOption('FAULT_OPEN_CHARGE_FEED')
    await page.getByRole('button', { name: 'Trace B+ path' }).click()
    await expect(page.locator('.wire.fault-open')).toHaveCount(1)
    await expect(page.locator('#inspectorContent')).toContainText('B+ path is open')

    await page.getByRole('button', { name: 'Reset view' }).click()
    await expect(page.locator('#faultSelect')).toHaveValue('FAULT_OPEN_CHARGE_FEED')
    await expect(page.locator('#flowNote')).toContainText('conceptual training aids')
    await expect(page.locator('#inspectorContent')).toContainText('Select an electrical symbol')
  })

  test('mobile layout contains wide schematic overflow inside its scroll region', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard/student/circuit-lab/')

    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      diagramClientWidth: document.querySelector('.diagram-scroll').clientWidth,
      diagramScrollWidth: document.querySelector('.diagram-scroll').scrollWidth
    }))

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1)
    expect(dimensions.diagramScrollWidth).toBeGreaterThan(dimensions.diagramClientWidth)
  })

  test('core controls retain accessible names and keyboard focus', async ({ page }) => {
    await page.goto('/dashboard/student/circuit-lab/')

    const operatingState = page.getByLabel('Operating state')
    const trainingFault = page.getByLabel('Training fault')
    const reset = page.getByRole('button', { name: 'Reset view' })

    await expect(operatingState).toBeVisible()
    await expect(trainingFault).toBeVisible()
    await reset.focus()
    await expect(reset).toBeFocused()
  })
})

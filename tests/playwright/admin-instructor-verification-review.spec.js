const { test, expect } = require('@playwright/test')

test.use({ baseURL: 'http://127.0.0.1:3003' })

test('admin review queue renders and submits an approved decision through the Worker API', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('supabase_access_token', 'test-admin-token')
  })

  let queueReads = 0
  await page.route('**/api/admin/instructor-verification/requests?status=pending', async (route) => {
    queueReads += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'pending',
        requests: queueReads === 1 ? [{
          id: '11111111-1111-4111-8111-111111111111',
          userId: 'instructor-user',
          schoolCode: '001234',
          status: 'pending',
          verificationMethod: 'school_code_plus_affiliation_review',
          requestedAt: '2026-10-11T20:00:00.000Z',
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
          institution: { schoolName: 'Example College', city: 'Example', stateCode: 'KS' }
        }] : []
      })
    })
  })

  let decisionPayload = null
  await page.route('**/api/admin/instructor-verification/requests/11111111-1111-4111-8111-111111111111', async (route) => {
    decisionPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verification: { id: '11111111-1111-4111-8111-111111111111', status: 'approved' },
        authorizationGranted: false,
        message: 'Instructor affiliation approved. A trusted instructor role is still required for privileged access.'
      })
    })
  })

  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/dashboard/admin/index.html', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Instructor affiliation review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Example College — Example, KS' })).toBeVisible()
  await expect(page.getByText('Applicant user ID: instructor-user')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()

  await page.getByRole('button', { name: 'Approve' }).click()
  await expect.poll(() => decisionPayload).toEqual({ decision: 'approved', reviewNote: '' })
  await expect(page.getByText('No pending instructor verification requests.')).toBeVisible()
  expect(queueReads).toBeGreaterThanOrEqual(2)
})
